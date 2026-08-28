/**
 * One error type for both data sources.
 *
 * The API always answers `{ error: { code, message, details } }` and clients
 * are told to switch on `code`, never on message text. `hint` is ours: the
 * sentence the UI shows under the message telling staff what to do next.
 */

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "IDEMPOTENCY_CONFLICT"
  | "VALIDATION_FAILED"
  | "INVALID_STATUS_TRANSITION"
  | "PAYMENT_SUM_MISMATCH"
  | "IMEI_MISMATCH"
  | "SHIFT_NOT_OPEN"
  | "INSUFFICIENT_STOCK"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  /* Client-side, never returned by the server. */
  | "NETWORK_UNREACHABLE"
  | "NOT_IMPLEMENTED"
  | "MOCK_FAILURE";

export interface ApiErrorDetail {
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly hint: string;
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: ApiErrorDetail[];

  constructor(
    message: string,
    hint: string,
    options: {
      code?: ApiErrorCode;
      status?: number;
      details?: ApiErrorDetail[];
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.hint = hint;
    this.code = options.code ?? "INTERNAL_ERROR";
    this.status = options.status ?? 0;
    this.details = options.details ?? [];
  }

  /**
   * Field-keyed messages, for wiring a 422 back onto a form.
   *
   * Laravel sends `{ field, messages: [...] }` — plural, because one field can
   * fail several rules at once. A singular `message` is accepted too so this
   * keeps working if the envelope is ever flattened.
   */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const detail of this.details) {
      const field = typeof detail.field === "string" ? detail.field : undefined;
      if (!field) continue;

      const message = Array.isArray(detail.messages)
        ? detail.messages.filter((m): m is string => typeof m === "string").join(" ")
        : typeof detail.message === "string"
          ? detail.message
          : undefined;

      if (message) out[field] = message;
    }
    return out;
  }

  /** "imei: The imei must be valid." — for a toast, when there is no field to pin it to. */
  get fieldSummary(): string {
    return Object.entries(this.fieldErrors)
      .map(([field, message]) => `${humaniseField(field)}: ${humaniseMessage(message)}`)
      .join("\n");
  }
}

/**
 * What a `toast.error(...)` should say for any thrown value.
 *
 * A 422 puts the useful text in `details[].messages` ("The mobile has already
 * been taken."), not the top-level `message` ("The given data was invalid.") —
 * so lead with the field summary and let `hint` be the description. Anything
 * that isn't an `ApiError` falls back to its own message.
 */
export function toastError(caught: unknown, fallback = "Something went wrong."): {
  message: string;
  description?: string;
} {
  if (caught instanceof ApiError) {
    const fields = caught.fieldSummary;
    return {
      message: fields || caught.message,
      description: fields ? caught.hint : caught.hint || undefined,
    };
  }
  if (caught instanceof Error && caught.message) {
    return { message: caught.message };
  }
  return { message: fallback };
}

/** The sentence staff read under the red headline, chosen by error code. */
export function hintForCode(code: ApiErrorCode, status: number): string {
  switch (code) {
    case "UNAUTHENTICATED":
      return "Your session expired. Sign in again to continue.";
    case "FORBIDDEN":
      return "Your account does not have permission for this. Ask the owner to do it.";
    case "NOT_FOUND":
      return "That record is not in the system, or belongs to another branch.";
    case "VALIDATION_FAILED":
      return "Check the highlighted fields and try again. Nothing was saved.";
    case "INVALID_STATUS_TRANSITION":
      return "That move is not allowed from the ticket's current status.";
    case "IDEMPOTENCY_CONFLICT":
      return "This looks like a repeat of a different request. Reload and try once more.";
    case "RATE_LIMITED":
      return "Too many requests. Wait a moment and try again.";
    case "SERVICE_UNAVAILABLE":
      return "The server is up but a dependency (database or queue) is down.";
    case "NETWORK_UNREACHABLE":
      return "The API did not answer. Check that it is running, then try again.";
    case "NOT_IMPLEMENTED":
      return "The API does not cover this part of the shop yet.";
    default:
      return status >= 500
        ? "The server failed on its side. Nothing was saved — try again."
        : "Try again. If it keeps failing, reload the page.";
  }
}

/**
 * `lines.0.service_ulid` is a field path, not something to show a cashier.
 *
 * Validation errors surface at the counter mid-sale, so the field is turned
 * into the thing on screen — "Line 1 service" — and the server's echo of the
 * raw path inside its own message is stripped out with it.
 */
function humaniseField(field: string): string {
  const line = field.match(/^lines\.(\d+)\.(.+)$/);
  if (line) {
    return `Line ${Number(line[1]) + 1} ${labelFor(line[2]!)}`;
  }
  return capitalise(labelFor(field));
}

function labelFor(field: string): string {
  return field
    /* Every foreign key on the wire is a ULID; the customer never sees that. */
    .replace(/_ulids?$/, "")
    .replace(/_/g, " ")
    .trim();
}

function humaniseMessage(message: string): string {
  /* Laravel echoes the field path into the sentence ("The selected
     lines.0.service_ulid is invalid."), which reads as noise once the field
     is already named beside it. */
  return message.replace(/\b(lines\.\d+\.)?[a-z_]+_ulids?\b/g, "value");
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
