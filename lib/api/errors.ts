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

  /** Field-keyed messages, for wiring a 422 back onto a form. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const detail of this.details) {
      const field = typeof detail.field === "string" ? detail.field : undefined;
      const message =
        typeof detail.message === "string" ? detail.message : undefined;
      if (field && message) out[field] = message;
    }
    return out;
  }
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
