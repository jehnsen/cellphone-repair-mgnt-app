# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Next dev server (port 3000; falls back to 3001 if taken)
npm run build      # Production build — the real gate, see below
npm run typecheck  # tsc --noEmit
```

There is **no test suite** and no configured linter (`npm run lint` drops into
Next's interactive ESLint setup prompt — don't run it). `npm run typecheck` plus
`npm run build` are the verification available.

Always run `npm run build`, not just `typecheck`: static generation catches
things `tsc` cannot, notably a `useSearchParams()` call that isn't wrapped in
`<Suspense>`. If a build fails with a `_document` / `PageNotFoundError` on
`/404`, that's a stale cache — `rm -rf .next` and rebuild.

On a memory-tight machine the build can OOM ("Fatal process out of memory:
Zone") during *Collecting page data* / static generation even though compile and
type-check passed. It is not a code fault — rerun with a bigger heap:
`NODE_OPTIONS=--max-old-space-size=8192 npm run build`.

Kill stray dev servers before screenshotting or driving the app; an old server
on port 3000 will happily serve a build from before your changes.

The app needs the API up and a session in `localStorage` to render anything —
without a token it redirects to `/login`, and without a reachable API it shows
the "could not reach the shop server" panel. To drive it headless, seed
`jo.auth.token` / `jo.auth.user` / `jo.auth.branch` on the app origin *before*
navigating (see `lib/api/session.ts` for the shapes). A small stub server that
answers the `{data, meta}` envelope is enough to exercise a screen, and is the
only way to see the loading, empty, and error states on demand.

## What this is

A front end for a single-branch Philippine cellphone repair shop: intake →
repair board → release, plus POS, inventory, customers, and reports.

The counter side also covers: a cash **drawer** that opens, takes cash in/out,
and closes against a counted total (`app/pos`); **store credit** per customer,
with a manager/owner adjustment (`app/customers`); a **trade-in** applied as
tender on a POS sale (the buy-back acquisition itself has no UI yet — see
`PENDING_CONTEXTS`); a **custom service** rung up at the counter (created as a
real catalog row, because the server prices a service line from the record —
there is no per-line override); and **device brand/model** CRUD under
Settings → Devices.

**The backend is a Laravel API.** There is no sample-data mode and no seeded
rows: if a record is on screen, it was read from the shop database. Point the
app at it with `NEXT_PUBLIC_API_URL` (see `.env.example`); the default is
`http://127.0.0.1:8000/api/v1`. **The API must be running** or the app renders
its "could not reach the shop server" state.

**Authentication is real.** `POST /auth/token` issues a bearer token, kept in
`localStorage` under `jo.auth.*` along with the signed-in user and their branch
(`lib/api/session.ts`). A 401 anywhere clears the session and drops the user at
`/login`. `lib/roles.ts` is live, not dormant — the nav rail filters on `can()`.

Two things to know about how permissions behave in practice:

- They are **not a security boundary here**. Every check runs in the browser and
  every route is still reachable by URL. The server is what enforces access; a
  403 is rendered as a plain "not permitted" state, not an error.
- Sign-in **falls back to a minimal `cashier` identity** when `/users` is
  unreadable (a cashier or technician cannot list staff). That is deliberate, but
  it means an owner can lose Settings from the rail after a transient failure.

## Architecture

### The API seam

`lib/shop/contract.ts` is the interface every screen codes against; nothing in
`app/` or `components/` knows about HTTP. Two implementations compose into one
object in `lib/api/shop-api.ts`:

- **`live-*.ts`** — the real client. `live-api.ts` (tickets, customers, store
  credit, users, the device brand/model catalog, ad-hoc services),
  `live-commerce.ts` (inventory, sales incl. trade-in payments, shifts and cash
  movements), `live-settings.ts` (branch, settings, message templates),
  `live-reports.ts` (the server's aggregates).
- **`unavailable.ts`** — the floor beneath them, so the object is always
  complete. Whatever the API has not built yet **reads empty and writes throw**
  `NOT_IMPLEMENTED` naming the missing endpoint. It never invents a row.

`lib/api/config.ts` lists what is still missing in `PENDING_CONTEXTS`, and the
Settings screen shows that list to the user. Keep it honest when an endpoint
ships. `README.md` has the four-step "wiring up a new endpoint" recipe.

- **`http.ts`** — the only place that knows about HTTP: bearer token, the
  `{data, meta, links}` envelope, `Idempotency-Key` on writes, `getAll()` to page
  a list to completion (capped at 40 pages), a 30s GET cache, and request
  coalescing. **Any write invalidates the whole read cache.**
- **`reducer.ts`** — one reducer over `Database`, a read-through cache of what
  has been fetched. It exists so a screen can resolve a ticket's customer
  without another round trip. It is *not* a source of truth.
- **`store.tsx`** — `ShopProvider` plus the hooks screens use: `useShop()`,
  `useQuery()`, `useMutation()`, and `useReport()`. A `version` counter bumps on
  every write so `useQuery` refetches without manual wiring.

**Fetching is client-only**, because there is no token during SSR. This is why
`useShop().ready` exists and why page HTML fetched with `curl` shows a loading
state rather than content — expected, not a bug. Anything deriving from
`new Date()` at render time needs the same treatment (see the greeting in
`app/login/login-view.tsx`).

### Reports come from the server, never from the cache

`db` holds only what this browser has fetched, and `getAll()` stops at 40 pages.
Any total derived from it silently goes wrong once the shop outgrows that — the
failure mode is a plausible number that is quietly too low.

So the figures of record are computed in SQL and read through **`ShopReports`**
(`lib/shop/contract.ts`, implemented by `lib/api/live-reports.ts`), reached with
the **`useReport()`** hook rather than `useQuery()`. `app/reports` uses it
exclusively and touches `db` nowhere. Keep it that way: a report that fails
loudly beats one that under-counts.

The server's payloads are `{ aggregate?, rows }` with numbers as decimal
strings; the mappers coerce and tolerate missing columns (a sales row with no
per-line split reports the whole day under `repair`, so the series still sum to
the gross).

The one deliberate exception is the day sheet's counts in `shop-api.ts`, which
re-read rather than counting the cache — overdue, ready, and drawer are the
numbers the shop is run on, and a count that lags an action is worse than a slow
one.

### Domain rules that live in one place

Don't reimplement these inline:

- **`lib/status.ts`** — `STATUS_META` (board order, dwell limits, fill weight),
  `agingOf()` (the fresh/soon/today/overdue tier), and `nextStatuses()` (legal
  transitions). Gate any "can this move to X" UI on `nextStatuses`.
- **`lib/vat.ts`** — `computeTax()`. Philippine VAT plus the statutory 20%
  senior/PWD relief (VAT comes off *first*, then the discount). POS, receipts,
  and reports must all agree, so they all call this.
- **`lib/format.ts`** — money, dates (always `Asia/Manila`), IMEI/claim-code
  grouping, and the terse durations the board reads constantly. Models hold
  numbers and ISO strings; these are the only place they become text.

### How the counter's money moves

The server, not the client, is the pricing authority for a sale — POS sends what
is being sold and how many; unit prices, VAT, and the statutory discount all
come back computed (`createSale` in `live-commerce.ts`). Consequences worth
knowing:

- **A service line is priced from the service record.** There is no per-line
  price override on the wire, so a walk-in / one-off charge must exist as a
  catalog row. `ServicePickerDialog`'s "Custom service" mode calls
  `createService` (`POST /services`) and then rings the new row like any other.
- **Payments are separate calls.** A sale is created, then each payment is
  POSTed to it — which is also how a split tender is expressed. A `trade_in`
  payment carries `acquisition_ulid` instead of a reference and never touches
  `expected_cash`; the server caps it at the acquisition's offered price.
- **Store credit** is customer-scoped and lives on `ShopApi`
  (`getStoreCredit` / `adjustStoreCredit`), not in `db` — the customer detail
  fetches it per-customer with `useQuery`. A manual adjustment is manager/owner
  only server-side; the UI gates the button on `can("settings.manage")` and
  still lets a 403 render as a plain message.
- **The drawer** opens, takes `addCashMovement` (cash in/out), and closes with
  `closeShift` against a counted total; `expected_cash` is the server's own
  reconciliation and is never recomputed here.
- **`getDeviceCatalog`** stays the active-only, flat feed for the intake
  pickers. The Settings → Devices tab manages the same rows through
  `getDeviceBrands` / `getDeviceModels` (everything, inactive included) plus
  create / update / delete.

### Screen conventions

Routes live in `app/`. Most `page.tsx` files are 5-line wrappers around a
sibling `*-view.tsx` client component; `app/board` and `app/release` add a
`<Suspense>` boundary because their views call `useSearchParams()`. Every
screen is built; `/specimen` is a design-system reference page, not a shop
screen.

Cross-screen deep links already in use, worth preserving:
`/board?q=`, `/board?overdue=1`, `/release?code=<ticketNo|claimCode|IMEI>`.

Every list screen owes the user three states — use `components/ui/states.tsx`
(`EmptyState`, `ErrorState`, `LoadingRows`) rather than ad-hoc markup, and give
`EmptyState` a body that says what to do next, never "No data found". A failed
read shows the server's own message; it must not fall back to a zero that reads
as a real figure.

### Design system

Tailwind v4, tokens in `app/globals.css`, shadcn/ui in `components/ui/`
(restyled onto the shop palette — check before assuming stock behaviour).

Components use **semantic tokens, never raw hex**: `bg-copy`, `text-ink`,
`border-rule`, plus `bench` (primary), `stamp` (danger/overdue), `flag`
(warning/due-soon), each with `-ink` (text-safe) and `-fill` (tinted bg)
variants. `--radius` and the shadow scale drive the whole look; changing a token
propagates everywhere, which is the point.

Two rules the existing code follows deliberately:

- **Colour is spent on urgency, not status.** Status is carried by column
  position, a two-letter mono code, and fill weight. `AgingStrip` is the one
  element allowed to carry hue for lateness.
- **Chart series colours are validated, not eyeballed.** `--series-repair` /
  `-handset` / `-accessory` in `globals.css` passed a CVD/contrast check against
  this app's own surfaces in both themes. Re-run the validator before changing
  them; the app's `--chart-2` (near-black ink) *fails* as a categorical series
  colour and must not be used as one.

Anything intentionally dark in both themes (the login brand panel) must be
pinned to literal values — `--ink`/`--paper` swap with the theme and will invert
it.

## Verifying UI work

There's no browser tool wired up, but Chrome is installed and works headless.
This machine is **Windows**; Chrome is at
`C:\Program Files\Google\Chrome\Application\chrome.exe`.

The one-shot `--screenshot=` flag is unreliable here (and `--headless=new`
ignores it). What works: launch with `--headless=new --remote-debugging-port=9222
--remote-allow-origins=*`, then drive it over the DevTools Protocol — Node 22 has
a global `WebSocket`, so a dependency-free CDP client is a ~40-line script
(`Page.navigate`, `Runtime.evaluate`, `Page.captureScreenshot`). CDP responses
nest the payload at `msg.result.result.value` for `Runtime.evaluate`; unwrap it.
`--window-size` includes browser chrome, so `Emulation.setDeviceMetricsOverride`
for accurate mobile widths.

**A real Laravel API is already running on this machine** at
`http://127.0.0.1:8000/api/v1` with a seeded shop. Sign in through the app's own
`/login` form (`ricardo.santos@fixmo.test` / `password`, an owner), or
`POST /auth/token` for a bearer token to probe endpoints directly. Because it is
the real shop DB, treat writes as real: void a stray probe sale
(`POST /sales/{ulid}/void` needs `void_reason`), delete a throwaway
brand/model/service. `next dev` falls back to **port 3001** when a stale server
holds 3000 — point the driver at the port it actually bound.

Recharts animates marks in from zero on mount, so a headless screenshot catches
an empty plot — pass `isAnimationActive={false}` (also better for a dashboard).

Screenshots have caught real bugs that typecheck and build both passed
(collapsed flex children, inverted dark mode, unscaled bars). Render and look
before calling UI work done.
