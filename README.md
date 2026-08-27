# Job Order — cellphone repair shop front end

Next.js 15 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · lucide-react

Intake → repair board → release, plus POS, inventory, customers, and reports
for a single-branch Metro Manila repair shop.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # the real gate — static generation catches what tsc cannot
npm run typecheck  # tsc --noEmit
```

### Against the live API

The app talks to the Laravel API in `cellphone-repair-mgnt-backend`.

```bash
# 1. database
d:/xampp/mysql/bin/mysqld.exe --defaults-file=d:/xampp/mysql/bin/my.ini --standalone

# 2. API  (from the backend repo)
php artisan migrate --seed     # first run only
php artisan serve --host=127.0.0.1 --port=8000

# 3. this app
npm run dev
```

`.env.local`:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
```

Sign in with a seeded account — `ricardo.santos@fixmo.test` / `password` is the
owner; see the backend's `database/seeders/UserSeeder.php` for the rest.
**Settings → Connection** shows the API this browser is pointed at and what it
loaded.

---

## One data source

Every screen talks to `ShopApi` (`lib/shop/contract.ts`) and never to `fetch`.
There is one implementation — the Laravel API — plus a stub for the contexts
the API has not built yet:

| | |
|---|---|
| `createLiveApi` | The API over HTTP (`lib/api/live-api.ts`). |
| `createUnavailableApi` | Reads answer empty, writes throw `NOT_IMPLEMENTED` naming the missing endpoint (`lib/api/unavailable.ts`). |

`createShopApi` composes them. **There is no sample data anywhere.** If a
record is on screen, it came out of MySQL.

**Live**

- Repair tickets: list, detail, create, status transitions, technician
  assignment, release, timeline
- Customers and their devices, including find-or-create on intake
- Product catalog, services, device brands and models
- Users, branches, sign-in and sign-out (Sanctum bearer tokens)

**No endpoint yet — these screens render empty**

- Point of sale, receipts, returns
- Cash drawer and shifts
- Stock levels, movements, suppliers, receiving, adjustments
- Sales figures and margin reports

---

## The API layer

```
lib/api/
  config.ts     base URL, storage keys, and the list of pending contexts
  errors.ts     ApiError: server `code`, HTTP status, details, and the hint
                the UI shows under the message
  http.ts       fetch client — envelope unwrap, bearer token, Idempotency-Key
                on writes, getAll() to page a list endpoint to completion
  session.ts    token / user / branch persistence in localStorage
  dto.ts        the wire shapes, exactly as the Laravel resources emit them
  mappers.ts    DTO → domain. The only place the two vocabularies meet.
  live-api.ts   ShopApi over HTTP, plus signIn/signOutRemote
  unavailable.ts honest empties for what the API has not built
  shop-api.ts   composition, read-through cache sync, first-load bootstrap
```

Conventions the client honours, from the API's own contract:

- **Envelope** — `{data, meta?, links?}` on success, `{error:{code,message,details}}`
  on failure. Screens switch on `code`, never on message text.
- **ULIDs everywhere** — every id in a path or a request body. The internal
  `BIGINT` id is never exposed, which is why filters keyed to internal ids
  (`filter[assigned_technician_id]`) are applied client-side instead.
- **Idempotency-Key** — every write sends a fresh UUID.
- **Pagination** — list endpoints page at 15; `getAll()` walks `meta.last_page`
  (capped at 40 pages) because the board and the directory want the whole set.

### Three gaps bridged in `mappers.ts`

1. `promised_date` is a calendar day; the board reasons in instants, so a date
   becomes **5pm Manila** — close of business, which is what the shop means by
   "promised Thursday".
2. The API exposes no `status_changed_at`, and the board's *stalled* treatment
   needs one. A transition is the only thing that touches the row, so
   `updated_at` stands in for it.
3. MySQL sends money as decimal strings (`"1800.00"`). Everything is coerced
   through `num()` so no screen ever does arithmetic on a string.

### Known limits

- **Adding a standalone note** throws `NOT_IMPLEMENTED`: the event ledger only
  writes on create, update, and transition. There is no free-note endpoint.
- **Releasing a unit** settles the balance by patching `downpayment` before the
  transition (the API refuses edits once released, and that is its only money
  field). There is no payment-per-ticket endpoint yet.
- **Stock on hand** shows 0 for live products — `StockLevel` exists in the
  backend but has no route.
- **Diagnosis and root cause** are not on the ticket resource, so they render
  empty against live data.

---

## Domain model

`lib/types.ts` is the whole shop in one file: `Ticket`, `Customer`,
`InventoryItem` (three classes that behave differently — serialized handsets
by IMEI, accessories by quantity, spare parts consumed by tickets), `Sale`,
`Shift`, and the settings records.

Rules live in one place each, and screens must not reimplement them:

- **`lib/status.ts`** — `STATUS_META` (board order, dwell limits, fill weight),
  `agingOf()` (fresh / soon / today / overdue), and `nextStatuses()`, which
  mirrors the server's `TicketStateMachine` exactly so the UI never offers a
  move the API will reject with `409 INVALID_STATUS_TRANSITION`.
- **`lib/vat.ts`** — `computeTax()`. Philippine VAT plus the statutory 20%
  senior/PWD relief (VAT comes off *first*, then the discount).
- **`lib/format.ts`** — money, dates (always `Asia/Manila`), IMEI and claim-code
  grouping, and the terse durations the board reads constantly.

## Design system

Tailwind v4, tokens in `app/globals.css`, shadcn/ui in `components/ui/`
restyled onto the shop palette. Components use semantic tokens, never raw hex:
`bg-copy`, `text-ink`, `border-rule`, plus `bench` (primary), `stamp`
(danger/overdue), `flag` (warning), each with `-ink` and `-fill` variants.

Two rules the code follows deliberately:

- **Colour is spent on urgency, not status.** Status is carried by column
  position, a two-letter mono code, and fill weight. `AgingStrip` is the one
  element allowed to carry hue for lateness.
- **The tag is the signature.** `TagHead` — ticket number, claim code, and the
  urgency edge — is the same object on the board card, the detail header, and
  the printed claim stub.

---

## What a backend team would replace

Nothing in `app/` or `components/`. When an endpoint ships, wire it up in four
steps:

1. Add the DTO to `lib/api/dto.ts`.
2. Add the mapper to `lib/api/mappers.ts`.
3. Implement the `ShopApi` method in `lib/api/live-api.ts`.
4. Delete its stub from `lib/api/unavailable.ts`, add it to `MUTATIONS` in
   `lib/api/shop-api.ts` if it writes, and drop its line from
   `PENDING_CONTEXTS` in `lib/api/config.ts`.

When every method is live, `lib/api/unavailable.ts` can be deleted wholesale.
