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
  "Standalone ticket notes without a status change",
  "Warranty slips and warranty claim tickets",
  "The Viber/SMS outbox (message templates are live under Settings)",
  "Buy-back / trade-in acquisitions (create, IMEI check, complete) — POS can spend a completed acquisition as tender, but not create one here",
] as const;
