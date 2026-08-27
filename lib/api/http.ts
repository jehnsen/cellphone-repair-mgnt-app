import { API_BASE_URL } from "@/lib/api/config";
import { ApiError, hintForCode, type ApiErrorCode } from "@/lib/api/errors";

/**
 * The fetch client. Everything the app knows about HTTP lives here:
 * the bearer token, the `{data, meta, links}` envelope, the error envelope,
 * `Idempotency-Key` on writes, and paging a list endpoint to completion.
 */

export interface Envelope<T> {
  data: T;
  meta?: PageMeta;
  links?: Record<string, string | null>;
}

export interface PageMeta {
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  [key: string]: unknown;
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  /** `filter[status]=received` is written as `{ "filter[status]": "received" }`. */
  query?: Record<string, QueryValue>;
  body?: unknown;
  /** Writes get one automatically; pass your own to make a retry idempotent. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function idempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * How long an identical GET is served from memory instead of the network.
 *
 * Screens ask overlapping questions on the same paint — the shell wants the
 * nav counts, the day sheet wants the same summary, the board wants the same
 * tickets — and React's dev Strict Mode runs every effect twice on top of
 * that. Without this, one page load walked the ticket table four times over.
 *
 * Staleness is bounded by `invalidate()`, not by this number: every write
 * clears the whole cache, so anything the operator does is reflected at once.
 * The window only governs how long a *read* may lag a change made somewhere
 * else — another device, or the server on its own. For a single-counter shop
 * that is a rare case, so this is sized to survive a screen-to-screen
 * navigation rather than a single paint. Under ~2s, moving between the day
 * sheet, the board, and inventory re-walked the entire paginated catalog
 * (products + stock levels + serialized units) on every hop.
 */
const GET_CACHE_MS = 30_000;

interface CacheEntry {
  at: number;
  value: Envelope<unknown>;
}

export class HttpClient {
  private token: string | null = null;

  /** Identical GETs issued together share one request. */
  private inflight = new Map<string, Promise<Envelope<unknown>>>();
  private cache = new Map<string, CacheEntry>();

  /** Called when the server says the token is dead, so the app can sign out. */
  onUnauthenticated: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
    /* A different identity must never read the last one's responses. */
    this.invalidate();
  }

  hasToken(): boolean {
    return Boolean(this.token);
  }

  /** Drop every cached read. Called after any write. */
  invalidate() {
    this.cache.clear();
    this.inflight.clear();
  }

  async request<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    options: RequestOptions = {},
  ): Promise<Envelope<T>> {
    const isWrite = method !== "GET";

    if (!isWrite) {
      const key = buildUrl(path, options.query);

      const fresh = this.cache.get(key);
      if (fresh && Date.now() - fresh.at < GET_CACHE_MS) {
        return fresh.value as Envelope<T>;
      }

      const pending = this.inflight.get(key);
      if (pending) return pending as Promise<Envelope<T>>;

      const request = this.send<T>(method, path, options)
        .then((value) => {
          this.cache.set(key, { at: Date.now(), value });
          return value;
        })
        .finally(() => {
          this.inflight.delete(key);
        });

      this.inflight.set(key, request as Promise<Envelope<unknown>>);
      return request;
    }

    /* Any write makes every cached read suspect. */
    const result = await this.send<T>(method, path, options);
    this.invalidate();
    return result;
  }

  private async send<T>(
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    options: RequestOptions = {},
  ): Promise<Envelope<T>> {
    const isWrite = method !== "GET";
    const headers: Record<string, string> = { Accept: "application/json" };

    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (isWrite) {
      headers["Idempotency-Key"] = options.idempotencyKey ?? idempotencyKey();
      if (options.body !== undefined && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }
    }

    let response: Response;
    try {
      response = await fetch(buildUrl(path, options.query), {
        method,
        headers,
        signal: options.signal,
        body:
          options.body === undefined
            ? undefined
            : options.body instanceof FormData
              ? options.body
              : JSON.stringify(options.body),
      });
    } catch (caught) {
      /* fetch only rejects for transport failures: server down, DNS, CORS. */
      throw new ApiError(
        "Could not reach the shop server.",
        `No answer from ${API_BASE_URL}. Check that the API is running.`,
        { code: "NETWORK_UNREACHABLE" },
      );
    }

    if (response.status === 204) {
      return { data: undefined as T };
    }

    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      throw this.toApiError(response.status, payload);
    }

    /* Laravel resource collections put rows at `data` with sibling meta. */
    const envelope = (payload ?? {}) as Envelope<T>;
    return envelope;
  }

  private toApiError(status: number, payload: unknown): ApiError {
    const error =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as {
            error: { code?: string; message?: string; details?: unknown };
          }).error
        : null;

    const code = (error?.code ?? codeForStatus(status)) as ApiErrorCode;
    const message = error?.message ?? `The server answered ${status}.`;
    const details = Array.isArray(error?.details)
      ? (error.details as Record<string, unknown>[])
      : [];

    if (code === "UNAUTHENTICATED") this.onUnauthenticated?.();

    return new ApiError(message, hintForCode(code, status), {
      code,
      status,
      details,
    });
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, options);
  }

  post<T>(path: string, options?: RequestOptions) {
    return this.request<T>("POST", path, options);
  }

  patch<T>(path: string, options?: RequestOptions) {
    return this.request<T>("PATCH", path, options);
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, options);
  }

  /**
   * List endpoints paginate at 15 rows. The board, the customer directory, and
   * the catalog all want the whole set, so walk the pages and concatenate.
   * Capped so a runaway dataset can never hang the UI.
   */
  async getAll<T>(
    path: string,
    options: RequestOptions = {},
    maxPages = 40,
  ): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;

    for (;;) {
      const response = await this.get<T[]>(path, {
        ...options,
        query: { ...options.query, page },
      });
      rows.push(...(response.data ?? []));

      const meta = response.meta;
      const lastPage = Number(meta?.last_page ?? 1);
      const currentPage = Number(meta?.current_page ?? page);
      if (!meta || currentPage >= lastPage || page >= maxPages) break;
      page = currentPage + 1;
    }

    return rows;
  }
}

function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 405:
      return "METHOD_NOT_ALLOWED";
    case 409:
      return "IDEMPOTENCY_CONFLICT";
    case 422:
      return "VALIDATION_FAILED";
    case 429:
      return "RATE_LIMITED";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_ERROR";
  }
}
