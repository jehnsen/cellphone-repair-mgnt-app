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

Kill stray dev servers before screenshotting or driving the app; an old server
on port 3000 will happily serve a build from before your changes.

## What this is

A prototype front end for a single-branch Philippine cellphone repair shop:
intake → repair board → release, plus POS, inventory, customers, and reports.

**There is no backend.** The entire shop is generated in the browser and lives
in a reducer. Nothing persists across a reload except the `jo.*` localStorage
keys (chosen user, rail collapsed state).

**There is no authentication.** `/login` selects an identity; it does not verify
anyone, and every route is reachable by typing its URL. Don't add UI that
implies otherwise — the login screen carries an explicit disclaimer, and
`lib/roles.ts` documents why its permission matrix is currently dormant.

## Architecture

### The mock backend seam

`lib/mock/` is deliberately shaped like a network so it can be swapped for a
real one without touching screens:

- **`seed.ts`** — builds the whole database deterministically (seeded RNG),
  relative to `now`. Exports `OWNER_ID`.
- **`api.ts`** — `ShopApi`, ~30 methods. Every call `await wait()`s (simulated
  latency) and can throw `ApiError` when the failure-rate demo control is on.
  This interface is the contract: a fetch client implements it and screens are
  unchanged.
- **`reducer.ts`** — one reducer over the whole `Database`. The API decides
  *what* changed; the reducer only decides where it lands.
- **`store.tsx`** — `ShopProvider` plus the three hooks screens use:
  `useShop()`, `useQuery()`, `useMutation()`. A `version` counter bumps on every
  dispatch so `useQuery` refetches without manual wiring.

**Seeding is client-only** (inside `useEffect`), because seed dates are relative
to `now` and generating them during SSR guarantees a hydration mismatch. This is
why `useShop().ready` exists and why page HTML fetched with `curl` shows a
loading state rather than content — that is expected, not a bug. Anything else
deriving from `new Date()` at render time needs the same treatment (see the
greeting in `app/login/login-view.tsx`).

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

### Screen conventions

Routes live in `app/`. Most `page.tsx` files are 5-line wrappers around a
sibling `*-view.tsx` client component; `app/board` and `app/release` add a
`<Suspense>` boundary because their views call `useSearchParams()`.
`app/settings` is still a `StageStub` — the only unbuilt screen.

Cross-screen deep links already in use, worth preserving:
`/board?q=`, `/board?overdue=1`, `/release?code=<ticketNo|claimCode|IMEI>`.

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

There's no browser tool wired up, but Chrome is installed and works headless:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --virtual-time-budget=10000 --window-size=1440,900 \
  --screenshot=/tmp/shot.png http://localhost:3000/board
```

Then read the PNG. Notes learned the hard way: `--headless=new` doesn't write
screenshots; `--window-size` includes browser chrome, so use CDP
`Emulation.setDeviceMetricsOverride` for accurate mobile widths rather than
trusting a narrow window; and `timeout` isn't available on this machine.

Recharts animates marks in from zero on mount, so a headless screenshot catches
an empty plot — pass `isAnimationActive={false}` (also better for a dashboard).

Screenshots have caught real bugs that typecheck and build both passed
(collapsed flex children, inverted dark mode, unscaled bars). Render and look
before calling UI work done.
