/**
 * Where the data comes from: the Laravel API, and nowhere else.
 *
 * There is no sample-data mode. If a record is on screen, it was read from the
 * shop database. The contexts the API has not built yet render empty rather
 * than filled with invented rows — see `createUnavailableApi`.
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1"
).replace(/\/+$/, "");

/** Session storage keys. Namespaced so they never collide with `jo.*` prefs. */
export const STORAGE = {
  token: "jo.auth.token",
  user: "jo.auth.user",
  branch: "jo.auth.branch",
} as const;

/** Endpoints that do not exist yet, named where the user can see them. */
export const PENDING_CONTEXTS = [
  "Point of sale, receipts, and returns",
  "Cash drawer and shifts",
  "Stock levels, movements, and suppliers",
  "Sales figures and margin reports",
] as const;
