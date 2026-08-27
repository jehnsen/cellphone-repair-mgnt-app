# Backend spec — Repair findings / defects

Status: **proposed**. Nothing in the frontend depends on this yet.
Audience: whoever owns the Laravel API.

## Why

`Ticket.diagnosis` and `Ticket.rootCause` exist in the frontend types, but
`lib/api/mappers.ts` hardcodes both to `undefined` because `RepairTicketDto`
carries no such field. There is today **no way to record what was actually
wrong with a unit** — only free-text timeline notes, which cannot be reported
on, cannot be shown on a warranty slip, and cannot answer "how often is it the
charging port on this model?".

This spec adds that record.

## Scope decision: one findings record per ticket, not many

A repair job has one conclusion, revised as work proceeds — not a log of
competing opinions. So: **one `repair_finding` row per ticket**, updated in
place, with history preserved on the ticket timeline rather than by keeping
superseded rows.

Parts consumed are already modelled separately and are **not** duplicated here.

---

## Schema

```sql
CREATE TABLE repair_findings (
    id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    ulid              CHAR(26) NOT NULL UNIQUE,

    -- One findings record per ticket.
    repair_ticket_id  BIGINT UNSIGNED NOT NULL,

    -- What the technician concluded.
    summary           VARCHAR(255) NOT NULL,
    details           TEXT NULL,

    -- Controlled vocabulary; see enum below. Drives reporting.
    root_cause        VARCHAR(32) NOT NULL,

    -- Component-level defects found, as a JSON array of enum values.
    defects           JSON NULL,

    -- Outcome of the work.
    resolution        VARCHAR(32) NOT NULL,

    -- Free text for anything the vocabulary cannot express.
    technician_notes  TEXT NULL,

    -- Whether the unit passed bench test after the repair.
    qc_passed         BOOLEAN NULL,
    qc_checked_at     TIMESTAMP NULL,
    qc_checked_by_id  BIGINT UNSIGNED NULL,

    recorded_by_id    BIGINT UNSIGNED NOT NULL,
    created_at        TIMESTAMP NULL,
    updated_at        TIMESTAMP NULL,

    CONSTRAINT uq_repair_findings_ticket UNIQUE (repair_ticket_id),
    CONSTRAINT fk_rf_ticket   FOREIGN KEY (repair_ticket_id)
        REFERENCES repair_tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_rf_recorder FOREIGN KEY (recorded_by_id) REFERENCES users(id),
    CONSTRAINT fk_rf_qc       FOREIGN KEY (qc_checked_by_id) REFERENCES users(id),

    INDEX idx_rf_root_cause (root_cause),
    INDEX idx_rf_resolution (resolution)
);
```

`UNIQUE (repair_ticket_id)` is what enforces "one per ticket" — the endpoint
below is an upsert, not a create.

### Enums

Keep these server-side as the source of truth and expose them via
`GET /meta/enums` so the frontend never hardcodes a second copy.

**`root_cause`** — why it failed. One value.

| value | meaning |
|---|---|
| `drop_impact` | Physical impact |
| `liquid_ingress` | Water or other liquid |
| `component_wear` | Age / normal wear |
| `power_surge` | Bad charger, surge |
| `third_party_repair` | Damage from a previous repair elsewhere |
| `firmware_corruption` | Software / firmware |
| `manufacturing_defect` | Faulty from new |
| `user_error` | Misuse, wrong settings |
| `no_fault_found` | Could not reproduce |
| `other` | Requires `details` |

**`defects[]`** — which components were faulty. Zero or more. Deliberately
mirrors the intake `ConditionCheck` vocabulary where they overlap, so intake
condition and post-repair findings can be compared.

```
screen, digitizer, battery, charging_port, motherboard, power_ic,
camera_rear, camera_front, speaker, earpiece, microphone, buttons,
back_cover, housing, sim_reader, sd_reader, wifi_antenna, other
```

**`resolution`** — what was done.

| value | meaning |
|---|---|
| `repaired` | Fixed |
| `part_replaced` | Fixed by replacing a part |
| `cleaned` | Cleaned / reseated, no part |
| `software_restored` | Reflash, reset |
| `no_fault_found` | Nothing wrong on bench |
| `unrepairable` | Cannot be fixed |
| `customer_declined` | Quote declined, returned as-is |

---

## Endpoints

All follow the existing envelope: `{ data: ... }` on success,
`{ error: { code, message, details } }` on failure. ULIDs in URLs.

### `GET /tickets/{ulid}/finding`

Returns the findings record, or `404 NOT_FOUND` if none recorded yet.

```json
{
  "data": {
    "ulid": "01J...",
    "summary": "Charging port pins corroded from liquid ingress.",
    "details": "Board otherwise clean. Ultrasonic cleaned, port flex replaced.",
    "root_cause": "liquid_ingress",
    "defects": ["charging_port", "sim_reader"],
    "resolution": "part_replaced",
    "technician_notes": "Advise customer against non-original chargers.",
    "qc_passed": true,
    "qc_checked_at": "2026-08-27T09:14:00Z",
    "qc_checked_by": { "ulid": "01J...", "name": "Ricardo Santos" },
    "recorded_by":   { "ulid": "01J...", "name": "Ricardo Santos" },
    "created_at": "2026-08-27T08:02:00Z",
    "updated_at": "2026-08-27T09:14:00Z"
  }
}
```

### `PUT /tickets/{ulid}/finding`

Upsert. Creates on first call, updates thereafter.

**Request**

```json
{
  "summary": "Charging port pins corroded from liquid ingress.",
  "details": "Board otherwise clean.",
  "root_cause": "liquid_ingress",
  "defects": ["charging_port", "sim_reader"],
  "resolution": "part_replaced",
  "technician_notes": "Advise against non-original chargers.",
  "qc_passed": true
}
```

**Validation**

| field | rule |
|---|---|
| `summary` | required, string, 3–255 |
| `details` | nullable, string, max 5000 |
| `root_cause` | required, in enum |
| `defects` | nullable, array; each in enum; distinct |
| `resolution` | required, in enum |
| `technician_notes` | nullable, string, max 5000 |
| `qc_passed` | nullable, boolean |

Conditional rules:

- `root_cause = other` → `details` required.
- `resolution = unrepairable` → `details` required (the customer is told this).
- Ticket already `released` → `409 INVALID_STATUS_TRANSITION`. A released
  ticket's record is closed; corrections go on the timeline.

`422` uses the existing shape, which the frontend already renders per-field:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "The given data was invalid.",
  "details": [{ "field": "root_cause", "messages": ["The selected root cause is invalid."] }] } }
```

**Side effects**

- Sets `qc_checked_at` / `qc_checked_by_id` when `qc_passed` transitions from
  null to non-null.
- Appends a timeline event (see below). This is what preserves history when
  the record is edited.
- Does **not** change ticket status. Findings and status are separate
  decisions; the board already drives transitions.

### Permissions

| action | permission |
|---|---|
| `GET .../finding` | `tickets.view` |
| `PUT .../finding` | `tickets.update` |

Cashiers can read (they answer the phone) but not write.

---

## Timeline

Add one event type so edits are auditable:

```
finding_recorded
```

Message, server-generated:

> Findings recorded: charging port, sim reader — liquid ingress (part replaced).

On a subsequent edit, emit the same type with "Findings updated: …". The
frontend `TimelineEventType` union needs `finding_recorded` added alongside the
existing `note`, `status_changed`, etc.

---

## Changes to the existing ticket resource

Add to `RepairTicketDto` **on show only** (keep the index payload small — the
board fetches every open ticket and does not need this):

```json
"finding": { "summary": "...", "root_cause": "liquid_ingress",
             "resolution": "part_replaced", "qc_passed": true }
```

A compact summary is enough for a detail header; the full record comes from
`GET /tickets/{ulid}/finding`.

---

## Reporting this unlocks

The reason for the controlled vocabulary rather than free text:

- Failures by `root_cause` over a period — is liquid damage seasonal?
- Most common `defects` per device model — what to stock.
- `no_fault_found` rate — how much bench time is spent on non-faults.
- `qc_passed = false` rate per technician — rework.

None of these are answerable from timeline notes.

---

## Assumptions taken (override if wrong)

The frontend is built and shipped against these. Each is a one-line change to
revisit, and none is baked into the UI.

1. **Warranty scope — slip keeps the template text.** The warranty slip
   continues to print the warranty *template* scope, not `finding.summary`.
   Quoting the finding verbatim is more honest but makes the printed text
   unpredictable in length and tone, and the slip is a fixed-height document.
   → *To change:* have the slip read `finding.summary` and cap it.
2. **`recorded_by` is the last editor**, not the person who did the work. A
   solo shop makes these the same person; if a job starts passing between
   technicians, add a separate `worked_by_id`.
3. **No immutability lock.** A released ticket's findings can still be edited.
   The frontend renders the panel read-only once a ticket is `released`, so
   this is enforced by convention, not by the server.
   → *To change:* add `locked_at`, set it on release, reject writes after it.
   Worth doing if findings are ever cited in a warranty dispute.

## Status of the frontend

Built and merged **ahead of this endpoint**:

- `ShopApi.getFinding` / `saveFinding` implemented against the contract above
  (`lib/api/live-api.ts`).
- Until the route exists, `GET` treats 404 as "none recorded" and `PUT`
  surfaces *"Recording findings is not in the API yet"* — the technician's
  typed work is kept on screen, not lost.
- The vocabulary is mirrored in `lib/findings.ts`; the **server enums remain
  the source of truth**. Consider exposing them at `GET /meta/enums` so the
  two cannot drift.
- Both conditional-required rules (`root_cause = other` and
  `resolution = unrepairable` need `details`) are enforced client-side too, so
  the bench is told before a round trip.

When the endpoint ships, no frontend change is required.
