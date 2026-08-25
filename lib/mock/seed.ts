import { money } from "@/lib/format";
import { computeTax } from "@/lib/vat";
import { STATUS_META } from "@/lib/status";
import { Rng } from "@/lib/mock/rng";
import { mockPhotoUrl, PHOTO_CAPTIONS } from "@/lib/mock/photos";
import {
  ACCESSORIES,
  BARANGAYS,
  COLORS,
  DIAGNOSIS_NOTES,
  FIRST_NAMES,
  LAST_NAMES,
  MOBILE_PREFIXES,
  MODELS,
  PROBLEM_TAGS,
  REPORTED_PROBLEM,
  ROOT_CAUSES,
  SERVICES,
  SPARE_PARTS,
  SUPPLIERS,
  type ModelRef,
} from "@/lib/mock/catalog";
import type {
  AppNotification,
  ConditionCheck,
  Customer,
  Database,
  HandsetUnit,
  InventoryItem,
  MovementReason,
  Payment,
  PaymentMethod,
  ProblemTag,
  Sale,
  SaleLine,
  SalePayment,
  Shift,
  StockMovement,
  Supplier,
  Ticket,
  TicketStatus,
  TimelineEvent,
  TurnedOverAccessory,
  User,
} from "@/lib/types";

/* ── Time helpers (all seed dates are relative to "now") ─────────────── */

const DAY = 86_400_000;
const HOUR = 3_600_000;

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY);
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * HOUR);
const iso = (date: Date) => date.toISOString();

function atTime(date: Date, hour: number, minute = 0): Date {
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function ymd(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function ym(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Sequence numbers reset per month, the way a paper pad does. */
function makeSequencer(prefix: string) {
  const counters = new Map<string, number>();
  return (date: Date) => {
    const key = ym(date);
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    return `${prefix}-${key}-${String(next).padStart(4, "0")}`;
  };
}

/** Real IMEIs carry a Luhn check digit; staff scanners validate it. */
function imeiFrom(rng: Rng): string {
  const body = `35${rng.digits(12)}`;
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    let digit = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

const CONDITION_POOL: ConditionCheck[] = [
  "screen_cracked",
  "back_cracked",
  "dents",
  "scratches",
  "water_indicator",
  "missing_screws",
  "prior_repair",
  "powers_on",
  "buttons_ok",
  "camera_ok",
];

const TURNED_OVER_POOL: TurnedOverAccessory[] = ["sim", "sd_card", "case", "charger", "box"];

/** How long each status has typically been sitting, and how old the job is. */
const STATUS_PLAN: { status: TicketStatus; n: number; ageDays: [number, number] }[] = [
  { status: "received", n: 5, ageDays: [0, 2] },
  { status: "diagnosed", n: 4, ageDays: [1, 4] },
  { status: "awaiting_approval", n: 4, ageDays: [1, 7] },
  { status: "awaiting_parts", n: 5, ageDays: [3, 16] },
  { status: "in_repair", n: 6, ageDays: [2, 9] },
  { status: "qc", n: 3, ageDays: [2, 7] },
  { status: "ready_for_pickup", n: 6, ageDays: [2, 14] },
  { status: "released", n: 8, ageDays: [8, 80] },
  { status: "unrepairable", n: 2, ageDays: [6, 22] },
  { status: "unclaimed", n: 2, ageDays: [38, 75] },
];

const SERVICE_FOR_TAG: Record<ProblemTag, string> = {
  screen: "SVC-SCRN",
  battery: "SVC-BATT",
  charging_port: "SVC-PORT",
  water_damage: "SVC-LIQ",
  no_power: "SVC-BOARD",
  software: "SVC-SOFT",
  camera: "SVC-SCRN",
  speaker: "SVC-PORT",
  board_level: "SVC-BOARD",
};

const PART_CATEGORY_FOR_TAG: Record<ProblemTag, string[]> = {
  screen: ["Display", "Consumable"],
  battery: ["Power"],
  charging_port: ["Charging"],
  water_damage: ["Consumable", "Charging"],
  no_power: ["Power", "Consumable"],
  software: [],
  camera: ["Camera"],
  speaker: ["Audio"],
  board_level: ["Consumable"],
};

interface PendingMove {
  itemId: string;
  quantity: number;
  reason: MovementReason;
  at: Date;
  reference?: string;
  ticketId?: string;
  saleId?: string;
  by: string;
}

/**
 * Builds the whole shop, deterministically, relative to `now`.
 * Called once per session by the store; a real backend replaces this file
 * and nothing else in `lib/mock/` needs to change shape.
 */
export function buildDatabase(now: Date = new Date()): Database {
  const rng = new Rng(20260825);
  const ticketNo = makeSequencer("JO");
  const saleNo = makeSequencer("SI");
  const today = atTime(now, 0);

  /* ── Shop ─────────────────────────────────────────────────────────── */

  const shop: Database["shop"] = {
    name: "Bagong Buhay Cellphone Repair",
    addressLine: "Stall 14, Ground Floor, Sto. Cristo Commercial Center",
    city: "Quezon City, Metro Manila",
    mobile: "0917 555 0142",
    email: "bagongbuhay.repair@gmail.com",
    vatRegistered: true,
    vatRate: 0.12,
    showBirDetails: true,
    tin: "009-123-456-000",
    birPermitNo: "FP092024-054-0123456-00001",
    serialNo: "SN-2024-000142",
    receiptFooter:
      "Thank you! Keep this slip — you need it to claim your unit. No slip, valid ID required.",
    unclaimedAfterDays: 30,
  };

  /* ── Users ────────────────────────────────────────────────────────── */

  const users: User[] = [
    { id: "u-owner", name: "Ador Bernardo", initials: "AB", role: "owner", mobile: "09175550101", active: true, isTechnician: false },
    { id: "u-manager", name: "Lourdes Fajardo", initials: "LF", role: "manager", mobile: "09175550102", active: true, isTechnician: false },
    { id: "u-cashier-1", name: "Bea Marasigan", initials: "BM", role: "cashier", mobile: "09175550103", active: true, isTechnician: false },
    { id: "u-cashier-2", name: "Kyle Ordoñez", initials: "KO", role: "cashier", mobile: "09175550104", active: true, isTechnician: false },
    { id: "u-tech-1", name: "Jomar Delos Santos", initials: "JD", role: "technician", mobile: "09175550105", active: true, isTechnician: true },
    { id: "u-tech-2", name: "Rhea Bantugan", initials: "RB", role: "technician", mobile: "09175550106", active: true, isTechnician: true },
    { id: "u-tech-3", name: "Elmer Pacheco", initials: "EP", role: "technician", mobile: "09175550107", active: true, isTechnician: true },
  ];

  const technicians = users.filter((user) => user.isTechnician);
  const cashiers = users.filter((user) => user.role === "cashier");

  /* ── Suppliers ────────────────────────────────────────────────────── */

  const suppliers: Supplier[] = SUPPLIERS.map((supplier, index) => ({
    id: `sup-${index + 1}`,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    mobile: `${rng.pick(MOBILE_PREFIXES)}${rng.digits(7)}`,
    email: undefined,
    address: rng.pick(BARANGAYS),
    terms: supplier.terms,
    active: true,
  }));

  /* ── Customers ────────────────────────────────────────────────────── */

  const customers: Customer[] = [];
  const usedNames = new Set<string>();
  while (customers.length < 25) {
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    const index = customers.length;
    const isSenior = rng.bool(0.16);
    customers.push({
      id: `cus-${index + 1}`,
      name,
      mobile: `${rng.pick(MOBILE_PREFIXES)}${rng.digits(7)}`,
      email: rng.bool(0.35)
        ? `${name.split(" ")[0]!.toLowerCase()}${rng.int(10, 99)}@gmail.com`
        : undefined,
      address: rng.bool(0.6) ? rng.pick(BARANGAYS) : undefined,
      seniorPwdId: isSenior ? `${rng.bool(0.6) ? "OSCA" : "PWD"}-${rng.digits(6)}` : undefined,
      seniorPwdType: isSenior ? (rng.bool(0.6) ? "senior" : "pwd") : undefined,
      notes: undefined,
      createdAt: iso(addDays(now, -rng.int(20, 700))),
    });
  }

  /* ── Inventory: three classes that behave differently ─────────────── */

  const items: InventoryItem[] = [];
  const movements: StockMovement[] = [];
  const pending: PendingMove[] = [];

  const handsetModels = MODELS.filter((model) => model.type === "phone").slice(0, 10);
  handsetModels.forEach((model, index) => {
    items.push({
      id: `itm-hs-${index + 1}`,
      itemClass: "handset",
      sku: `HS-${model.brand.slice(0, 3).toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
      name: `${model.brand} ${model.model}`,
      brand: model.brand,
      category: "Handset",
      barcode: `48${rng.digits(11)}`,
      supplierId: rng.pick(suppliers).id,
      quantityOnHand: 0,
      reorderPoint: 1,
      unitCost: 0,
      sellingPrice: model.tier,
      units: [],
      location: `Display case ${String.fromCharCode(65 + (index % 3))}`,
      active: true,
      createdAt: iso(addDays(now, -rng.int(120, 400))),
    });
  });

  ACCESSORIES.forEach((accessory, index) => {
    items.push({
      id: `itm-ac-${index + 1}`,
      itemClass: "accessory",
      sku: `AC-${String(index + 1).padStart(3, "0")}`,
      name: accessory.name,
      brand: accessory.brand,
      category: accessory.category,
      barcode: `49${rng.digits(11)}`,
      supplierId: rng.pick(suppliers).id,
      quantityOnHand: 0,
      reorderPoint: rng.int(3, 10),
      unitCost: accessory.cost,
      sellingPrice: accessory.price,
      location: `Rack ${rng.int(1, 4)}-${rng.pick(["A", "B", "C"])}`,
      active: true,
      createdAt: iso(addDays(now, -rng.int(120, 400))),
    });
  });

  SPARE_PARTS.forEach((part, index) => {
    items.push({
      id: `itm-sp-${index + 1}`,
      itemClass: "spare_part",
      sku: `SP-${String(index + 1).padStart(3, "0")}`,
      name: part.name,
      brand: part.models[0] === "Universal" ? "Universal" : part.models.join(" / "),
      category: part.category,
      barcode: `47${rng.digits(11)}`,
      supplierId: rng.pick(suppliers).id,
      quantityOnHand: 0,
      reorderPoint: rng.int(2, 6),
      unitCost: part.cost,
      sellingPrice: part.price,
      compatibleModels: part.models,
      location: `Bin ${String(index + 1).padStart(2, "0")}`,
      active: true,
      createdAt: iso(addDays(now, -rng.int(120, 400))),
    });
  });

  const spareParts = items.filter((item) => item.itemClass === "spare_part");
  const accessories = items.filter((item) => item.itemClass === "accessory");
  const handsets = items.filter((item) => item.itemClass === "handset");

  /* Handset units currently on the shelf. */
  handsets.forEach((item, index) => {
    const model = handsetModels[index]!;
    const unitCount = rng.int(1, 4);
    for (let i = 0; i < unitCount; i += 1) {
      const condition = rng.weighted([
        ["brand_new", 5],
        ["open_box", 2],
        ["secondhand", 3],
        ["refurbished", 1],
      ] as const);
      const factor =
        condition === "brand_new" ? 1 : condition === "open_box" ? 0.92 : condition === "refurbished" ? 0.78 : 0.68;
      const price = money(Math.round((model.tier * factor) / 50) * 50);
      const receivedAt = addDays(now, -rng.int(3, 70));
      const unit: HandsetUnit = {
        id: `unit-${item.id}-${i + 1}`,
        itemId: item.id,
        imei: imeiFrom(rng),
        condition,
        status: rng.bool(0.12) ? "reserved" : "in_stock",
        cost: money(price * rng.float(0.78, 0.87)),
        price,
        storage: rng.pick(["64GB", "128GB", "256GB"]),
        color: rng.pick(COLORS),
        batteryHealth: condition === "brand_new" ? 100 : rng.int(82, 99),
        warrantyDays: condition === "brand_new" ? 365 : condition === "refurbished" ? 90 : 30,
        supplierId: item.supplierId,
        receivedAt: iso(receivedAt),
        fromTradeIn: condition === "secondhand" && rng.bool(0.4),
      };
      item.units!.push(unit);
      movements.push({
        id: `mv-${movements.length + 1}`,
        itemId: item.id,
        unitId: unit.id,
        quantity: 1,
        reason: unit.fromTradeIn ? "trade_in" : "receiving",
        reference: unit.fromTradeIn ? "Trade-in" : `DR-${rng.digits(5)}`,
        unitCost: unit.cost,
        at: unit.receivedAt,
        by: rng.pick(cashiers).id,
      });
    }
  });

  /* ── Tickets ──────────────────────────────────────────────────────── */

  const tickets: Ticket[] = [];
  const timeline: TimelineEvent[] = [];
  const notifications: AppNotification[] = [];
  let eventSeq = 0;

  const pushEvent = (
    ticket: Ticket,
    type: TimelineEvent["type"],
    message: string,
    at: Date,
    actorId: string,
    meta?: TimelineEvent["meta"],
  ) => {
    eventSeq += 1;
    timeline.push({
      id: `evt-${eventSeq}`,
      ticketId: ticket.id,
      type,
      message,
      actorId,
      at: iso(at),
      meta,
    });
  };

  const ticketSpecs: { status: TicketStatus; ageDays: number }[] = [];
  STATUS_PLAN.forEach((plan) => {
    for (let i = 0; i < plan.n; i += 1) {
      ticketSpecs.push({
        status: plan.status,
        ageDays: rng.int(plan.ageDays[0], plan.ageDays[1]),
      });
    }
  });
  ticketSpecs.sort((a, b) => b.ageDays - a.ageDays);

  ticketSpecs.forEach((spec, index) => {
    const customer = rng.pick(customers);
    const model: ModelRef = rng.weighted(
      MODELS.map((entry) => [entry, entry.type === "phone" ? 6 : 1] as const),
    );
    const primaryTag = rng.weighted([
      ["screen", 8],
      ["battery", 6],
      ["charging_port", 5],
      ["water_damage", 3],
      ["no_power", 3],
      ["software", 4],
      ["camera", 2],
      ["speaker", 2],
      ["board_level", 2],
    ] as const);
    const tags: ProblemTag[] = [primaryTag];
    if (rng.bool(0.25)) {
      const extra = rng.pick(PROBLEM_TAGS);
      if (extra !== primaryTag) tags.push(extra);
    }

    const createdAt = atTime(addDays(now, -spec.ageDays), rng.int(9, 18), rng.int(0, 59));

    /* Lateness is designed, not incidental: the board needs a believable mix
       of late, due-today, and comfortable jobs, weighted by where the job is
       stuck. Parts holds run late; QC does not. */
    const promisedAt = (() => {
      const terminal = ["released", "unrepairable", "unclaimed"].includes(spec.status);
      if (terminal) return atTime(addDays(createdAt, rng.int(2, 5)), 17, 0);

      const lateChance: Partial<Record<TicketStatus, number>> = {
        received: 0,
        diagnosed: 0.1,
        awaiting_approval: 0.25,
        awaiting_parts: 0.5,
        in_repair: 0.2,
        qc: 0.1,
        ready_for_pickup: 0.3,
      };
      const late = rng.bool(lateChance[spec.status] ?? 0.15);
      const target = late
        ? atTime(addDays(now, -rng.int(1, 5)), 17, 0)
        : atTime(
            addDays(
              now,
              rng.weighted([
                [0, 3],
                [1, 3],
                [2, 2],
                [3, 2],
                [4, 1],
                [5, 1],
                [6, 1],
              ] as const),
            ),
            17,
            0,
          );
      const floor = atTime(addDays(createdAt, 1), 17, 0);
      return target < floor ? floor : target;
    })();
    const service = SERVICES.find((entry) => entry.code === SERVICE_FOR_TAG[primaryTag])!;
    const laborCharge = money(service.standardPrice * rng.float(0.9, 1.3));

    const candidateParts = spareParts.filter((part) => {
      const categories = PART_CATEGORY_FOR_TAG[primaryTag];
      if (!categories.length) return false;
      if (!categories.includes(part.category)) return false;
      const compatible = part.compatibleModels ?? [];
      return compatible.includes("Universal") || compatible.includes(model.model);
    });
    const fallbackParts = spareParts.filter((part) =>
      (part.compatibleModels ?? []).includes(model.model),
    );
    const partPool = candidateParts.length ? candidateParts : fallbackParts;

    const statusOrder = [
      "received",
      "diagnosed",
      "awaiting_approval",
      "awaiting_parts",
      "in_repair",
      "qc",
      "ready_for_pickup",
      "released",
    ];
    const reachedRepair =
      statusOrder.indexOf(spec.status) >= statusOrder.indexOf("in_repair") ||
      spec.status === "unclaimed";

    const ticket: Ticket = {
      id: `tkt-${index + 1}`,
      ticketNo: ticketNo(createdAt),
      claimCode: rng.code(6),
      status: spec.status,
      customerId: customer.id,
      device: {
        type: model.type,
        brand: model.brand,
        model: model.model,
        color: rng.pick(COLORS),
        imei: imeiFrom(rng),
        unlockMethod: rng.weighted([
          ["pin", 5],
          ["pattern", 3],
          ["password", 1],
          ["none", 2],
        ] as const),
        unlockValue: undefined,
      },
      reportedProblem: rng.pick(REPORTED_PROBLEM[primaryTag]),
      problemTags: tags,
      turnedOver: rng.sample(TURNED_OVER_POOL, rng.int(1, 3)),
      conditionChecks: rng.sample(CONDITION_POOL, rng.int(2, 5)),
      photos: [],
      estimatedCost: 0,
      laborCharge,
      partsTotal: 0,
      totalDue: 0,
      amountPaid: 0,
      balance: 0,
      promisedAt: iso(promisedAt),
      warrantyDays: service.warrantyDays,
      technicianId: rng.bool(0.85) ? rng.pick(technicians).id : undefined,
      partsUsed: [],
      quoteState: "none",
      payments: [],
      isWarrantyClaim: false,
      termsAcceptedAt: iso(createdAt),
      createdAt: iso(createdAt),
      createdBy: rng.pick(cashiers).id,
      updatedAt: iso(createdAt),
      statusChangedAt: iso(createdAt),
    };

    if (ticket.device.unlockMethod === "pin") ticket.device.unlockValue = rng.digits(4);
    if (ticket.device.unlockMethod === "password") ticket.device.unlockValue = `pass${rng.digits(3)}`;
    if (ticket.device.unlockMethod === "pattern") {
      ticket.device.unlockValue = rng.sample([0, 1, 2, 3, 4, 5, 6, 7, 8], rng.int(4, 6)).join("-");
    }

    const photoCount = rng.int(2, 4);
    for (let i = 0; i < photoCount; i += 1) {
      ticket.photos.push({
        id: `pho-${ticket.id}-${i + 1}`,
        url: mockPhotoUrl(`${model.model} ${i + 1}`, index + i),
        caption: PHOTO_CAPTIONS[i % PHOTO_CAPTIONS.length],
        stage: "intake",
        takenAt: iso(addHours(createdAt, 0.05 * (i + 1))),
      });
    }

    const expectedPart = partPool.length ? rng.pick(partPool) : undefined;
    ticket.estimatedCost = money(
      Math.round((laborCharge + (expectedPart?.sellingPrice ?? 0)) / 50) * 50,
    );

    pushEvent(
      ticket,
      "created",
      `Received ${model.brand} ${model.model} from ${customer.name}.`,
      createdAt,
      ticket.createdBy,
    );
    if (ticket.technicianId) {
      const tech = users.find((user) => user.id === ticket.technicianId)!;
      pushEvent(ticket, "assigned", `Assigned to ${tech.name}.`, addHours(createdAt, 0.5), ticket.createdBy);
    }

    /* Downpayment at intake, the way the pad works. */
    if (rng.bool(0.7)) {
      const downpayment = money(Math.round((ticket.estimatedCost * rng.float(0.2, 0.5)) / 50) * 50);
      const payment: Payment = {
        id: `pay-${ticket.id}-1`,
        amount: downpayment,
        method: rng.weighted([
          ["cash", 7],
          ["gcash", 3],
          ["maya", 1],
        ] as const),
        kind: "downpayment",
        receivedAt: iso(addHours(createdAt, 0.1)),
        receivedBy: ticket.createdBy,
      };
      ticket.payments.push(payment);
      pushEvent(
        ticket,
        "payment",
        `Downpayment of ₱${downpayment.toLocaleString("en-PH")} received (${payment.method}).`,
        addHours(createdAt, 0.1),
        ticket.createdBy,
        { amount: downpayment, method: payment.method },
      );
    }

    /* Diagnosis and quote for anything past "received". */
    if (spec.status !== "received") {
      const diagnosedAt = addHours(createdAt, rng.int(3, 20));
      ticket.diagnosis = rng.pick(DIAGNOSIS_NOTES);
      ticket.rootCause = rng.pick(ROOT_CAUSES);
      pushEvent(ticket, "status_changed", "Diagnosis recorded.", diagnosedAt, ticket.technicianId ?? ticket.createdBy, {
        to: "diagnosed",
      });

      if (["awaiting_approval", "awaiting_parts", "in_repair", "qc", "ready_for_pickup", "released", "unclaimed", "unrepairable"].includes(spec.status)) {
        const quotedAt = addHours(diagnosedAt, rng.int(1, 6));
        const quoteAmount = money(Math.round((ticket.estimatedCost * rng.float(0.9, 1.35)) / 50) * 50);
        ticket.quoteState = spec.status === "awaiting_approval" ? "sent" : "approved";
        ticket.quoteSentAt = iso(quotedAt);
        pushEvent(
          ticket,
          "quote_sent",
          `Quote of ₱${quoteAmount.toLocaleString("en-PH")} sent by Viber.`,
          quotedAt,
          ticket.technicianId ?? ticket.createdBy,
          { amount: quoteAmount },
        );
        if (ticket.quoteState === "approved") {
          const repliedAt = addHours(quotedAt, rng.int(1, 30));
          ticket.quoteRepliedAt = iso(repliedAt);
          ticket.approvedAmount = quoteAmount;
          pushEvent(ticket, "quote_replied", "Customer approved the quote.", repliedAt, ticket.createdBy, {
            approved: true,
          });
        }
      }
    }

    /* Parts consumption once the job is actually on the bench. */
    if (reachedRepair && partPool.length) {
      const chosen = rng.sample(partPool, rng.int(1, Math.min(2, partPool.length)));
      chosen.forEach((part, partIndex) => {
        const quantity = part.category === "Consumable" ? rng.int(1, 2) : 1;
        const consumedAt = addHours(createdAt, rng.int(20, 60));
        ticket.partsUsed.push({
          id: `prt-${ticket.id}-${partIndex + 1}`,
          itemId: part.id,
          sku: part.sku,
          name: part.name,
          quantity,
          unitCost: part.unitCost,
          unitPrice: part.sellingPrice,
          consumedAt: iso(consumedAt),
          consumedBy: ticket.technicianId ?? ticket.createdBy,
        });
        pending.push({
          itemId: part.id,
          quantity: -quantity,
          reason: "repair_consumption",
          at: consumedAt,
          reference: ticket.ticketNo,
          ticketId: ticket.id,
          by: ticket.technicianId ?? ticket.createdBy,
        });
        pushEvent(
          ticket,
          "part_consumed",
          `Used ${quantity} × ${part.name} (${part.sku}).`,
          consumedAt,
          ticket.technicianId ?? ticket.createdBy,
          { sku: part.sku, quantity },
        );
      });
    }

    ticket.partsTotal = money(
      ticket.partsUsed.reduce((sum, part) => sum + part.quantity * part.unitPrice, 0),
    );

    ticket.totalDue = ticket.partsUsed.length
      ? money(ticket.partsTotal + ticket.laborCharge)
      : (ticket.approvedAmount ?? ticket.estimatedCost);
    if (spec.status === "unrepairable") {
      ticket.totalDue = money(rng.bool(0.5) ? 0 : 200);
    }

    /* How long the job has sat in its current status. Expressed against the
       status dwell limit so roughly a quarter of the board reads as stalled —
       enough to exercise the treatment, not enough to cry wolf. */
    const statusChangedAt = (() => {
      const meta = STATUS_META[spec.status];
      if (meta.terminal) {
        const settled = addDays(createdAt, rng.float(1.5, 4));
        return settled > now ? addHours(now, -rng.int(2, 12)) : settled;
      }
      if (spec.status === "received") return createdAt;

      const limit = meta.dwellLimitHours;
      const dwell = rng.bool(0.25)
        ? limit * rng.float(1.1, 2.2)
        : limit * rng.float(0.1, 0.8);
      const stamped = addHours(now, -dwell);
      return stamped < createdAt ? addHours(createdAt, rng.float(0.5, 2)) : stamped;
    })();
    ticket.statusChangedAt = iso(statusChangedAt > now ? now : statusChangedAt);
    ticket.updatedAt = ticket.statusChangedAt;

    if (spec.status !== "received" && spec.status !== "diagnosed") {
      pushEvent(
        ticket,
        "status_changed",
        `Moved to ${spec.status.replace(/_/g, " ")}.`,
        new Date(ticket.statusChangedAt),
        ticket.technicianId ?? ticket.createdBy,
        { to: spec.status },
      );
    }

    if (spec.status === "ready_for_pickup" || spec.status === "unclaimed") {
      const notifiedAt = new Date(ticket.statusChangedAt);
      notifications.push({
        id: `ntf-${notifications.length + 1}`,
        ticketId: ticket.id,
        customerId: customer.id,
        channel: rng.bool(0.7) ? "viber" : "sms",
        body: `Hi ${customer.name.split(" ")[0]}, ready na po ang ${model.brand} ${model.model} ninyo. Ticket ${ticket.ticketNo}, balance ₱${money(ticket.totalDue).toLocaleString("en-PH")}. Salamat po!`,
        state: rng.bool(0.85) ? "sent" : "queued",
        queuedAt: iso(notifiedAt),
      });
      pushEvent(ticket, "notified", "Pickup notice sent to the customer.", notifiedAt, ticket.createdBy);
    }

    /* Released tickets are paid in full and carry a warranty slip. */
    if (spec.status === "released") {
      const releasedAt = new Date(ticket.statusChangedAt);
      const paidSoFar = ticket.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const remaining = money(Math.max(0, ticket.totalDue - paidSoFar));
      if (remaining > 0) {
        ticket.payments.push({
          id: `pay-${ticket.id}-2`,
          amount: remaining,
          method: rng.weighted([
            ["cash", 6],
            ["gcash", 3],
            ["maya", 1],
            ["card", 1],
          ] as const),
          kind: "balance",
          receivedAt: iso(releasedAt),
          receivedBy: rng.pick(cashiers).id,
        });
      }
      ticket.releasedAt = iso(releasedAt);
      ticket.releasedBy = rng.pick(cashiers).id;
      ticket.releasedTo = rng.bool(0.85) ? customer.name : `${rng.pick(FIRST_NAMES)} ${customer.name.split(" ").slice(-1)[0]}`;
      ticket.warranty = {
        claimCode: `W${rng.code(5)}`,
        scope: `${service.name} and the parts replaced on this job order.`,
        periodDays: ticket.warrantyDays,
        startsAt: iso(releasedAt),
        expiresAt: iso(addDays(releasedAt, ticket.warrantyDays)),
        exclusions: [
          "Liquid damage after release",
          "Physical damage, drops, or bends",
          "Third-party tampering or repair by another shop",
          "Software issues from user-installed apps",
        ],
      };
      pushEvent(
        ticket,
        "released",
        `Unit released to ${ticket.releasedTo}. Warranty ${ticket.warrantyDays} days.`,
        releasedAt,
        ticket.releasedBy,
      );
    }

    ticket.amountPaid = money(ticket.payments.reduce((sum, payment) => sum + payment.amount, 0));
    ticket.balance = money(Math.max(0, ticket.totalDue - ticket.amountPaid));

    tickets.push(ticket);
  });

  /* One warranty rework, so the linked child-ticket path has real data. */
  const warrantyParent = tickets.find(
    (ticket) => ticket.status === "released" && ticket.warranty && new Date(ticket.warranty.expiresAt) > now,
  );
  if (warrantyParent) {
    const createdAt = addDays(now, -rng.int(1, 4));
    const child: Ticket = {
      ...warrantyParent,
      id: `tkt-${tickets.length + 1}`,
      ticketNo: ticketNo(createdAt),
      claimCode: rng.code(6),
      status: "in_repair",
      parentTicketId: warrantyParent.id,
      isWarrantyClaim: true,
      reportedProblem: `Warranty rework: same fault returned after ${Math.round((now.getTime() - new Date(warrantyParent.releasedAt!).getTime()) / DAY)} days.`,
      estimatedCost: 0,
      laborCharge: 0,
      partsTotal: 0,
      totalDue: 0,
      amountPaid: 0,
      balance: 0,
      payments: [],
      partsUsed: [],
      photos: warrantyParent.photos,
      quoteState: "none",
      quoteSentAt: undefined,
      quoteRepliedAt: undefined,
      approvedAmount: undefined,
      warranty: undefined,
      releasedAt: undefined,
      releasedBy: undefined,
      releasedTo: undefined,
      promisedAt: iso(atTime(addDays(createdAt, 2), 17)),
      createdAt: iso(createdAt),
      statusChangedAt: iso(addHours(createdAt, 6)),
      updatedAt: iso(addHours(createdAt, 6)),
    };
    tickets.push(child);
    pushEvent(child, "warranty_claim", `Warranty claim filed against ${warrantyParent.ticketNo}. No charge.`, createdAt, "u-cashier-1");
    pushEvent(child, "status_changed", "Moved to in repair.", addHours(createdAt, 6), child.technicianId ?? "u-tech-1");
  }

  /* ── 90 days of sales, one shift per day ──────────────────────────── */

  const sales: Sale[] = [];
  const shifts: Shift[] = [];

  for (let dayOffset = 89; dayOffset >= 0; dayOffset -= 1) {
    const day = addDays(today, -dayOffset);
    const isToday = dayOffset === 0;
    const openedAt = atTime(day, 9, rng.int(0, 20));
    const cashier = rng.pick(cashiers);
    const shift: Shift = {
      id: `shf-${ymd(day)}`,
      shiftNo: `SH-${ymd(day)}`,
      openedBy: cashier.id,
      openedAt: iso(openedAt),
      startingCash: 3000,
      movements: [],
      status: isToday ? "open" : "closed",
    };

    const weekday = day.getDay();
    const busy = weekday === 0 || weekday === 6 ? 1.4 : 1;
    const saleCount = Math.max(1, Math.round(rng.int(3, 8) * busy));
    let cashTaken = 0;

    for (let i = 0; i < saleCount; i += 1) {
      const soldAt = atTime(day, rng.int(9, isToday ? Math.max(10, now.getHours()) : 19), rng.int(0, 59));
      if (isToday && soldAt > now) continue;

      const lines: SaleLine[] = [];
      const kind = rng.weighted([
        ["accessory", 6],
        ["service", 3],
        ["handset", 1],
      ] as const);

      if (kind === "handset") {
        const item = rng.pick(handsets);
        const model = handsetModels[handsets.indexOf(item)]!;
        const condition = rng.weighted([
          ["brand_new", 5],
          ["open_box", 2],
          ["secondhand", 3],
        ] as const);
        const factor = condition === "brand_new" ? 1 : condition === "open_box" ? 0.92 : 0.68;
        const price = money(Math.round((model.tier * factor) / 50) * 50);
        const unit: HandsetUnit = {
          id: `unit-${item.id}-s${sales.length + 1}`,
          itemId: item.id,
          imei: imeiFrom(rng),
          condition,
          status: "sold",
          cost: money(price * rng.float(0.78, 0.88)),
          price,
          storage: rng.pick(["64GB", "128GB", "256GB"]),
          color: rng.pick(COLORS),
          warrantyDays: condition === "brand_new" ? 365 : 30,
          supplierId: item.supplierId,
          receivedAt: iso(addDays(soldAt, -rng.int(3, 30))),
          soldAt: iso(soldAt),
        };
        item.units!.push(unit);
        movements.push({
          id: `mv-${movements.length + 1}`,
          itemId: item.id,
          unitId: unit.id,
          quantity: 1,
          reason: "receiving",
          reference: `DR-${rng.digits(5)}`,
          unitCost: unit.cost,
          at: unit.receivedAt,
          by: cashier.id,
        });
        lines.push({
          id: `ln-${sales.length + 1}-1`,
          kind: "handset",
          itemId: item.id,
          unitId: unit.id,
          sku: item.sku,
          name: `${item.name} ${unit.storage} (${unit.condition.replace(/_/g, " ")})`,
          quantity: 1,
          unitPrice: unit.price,
          unitCost: unit.cost,
          lineTotal: unit.price,
        });
      } else if (kind === "service") {
        const service = rng.pick(SERVICES);
        const price = money(Math.round((service.standardPrice * rng.float(0.9, 1.2)) / 10) * 10);
        lines.push({
          id: `ln-${sales.length + 1}-1`,
          kind: "service",
          sku: service.code,
          name: service.name,
          quantity: 1,
          unitPrice: price,
          unitCost: 0,
          lineTotal: price,
        });
      }

      const accessoryLines = kind === "accessory" ? rng.int(1, 3) : rng.int(0, 1);
      for (let a = 0; a < accessoryLines; a += 1) {
        const item = rng.pick(accessories);
        if (lines.some((line) => line.itemId === item.id)) continue;
        const quantity = rng.weighted([
          [1, 8],
          [2, 3],
          [3, 1],
        ] as const);
        lines.push({
          id: `ln-${sales.length + 1}-${lines.length + 1}`,
          kind: "accessory",
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          quantity,
          unitPrice: item.sellingPrice,
          unitCost: item.unitCost,
          lineTotal: money(item.sellingPrice * quantity),
        });
      }

      if (!lines.length) continue;

      const subtotal = money(lines.reduce((sum, line) => sum + line.lineTotal, 0));
      const seniorCustomer = rng.bool(0.09)
        ? customers.find((entry) => entry.seniorPwdId)
        : undefined;
      const orderDiscount = rng.bool(0.1)
        ? ({ kind: "percent", value: rng.pick([5, 10]), label: "Suki discount" } as const)
        : undefined;

      const tax = computeTax({
        subtotal,
        orderDiscount,
        seniorPwd: { applies: Boolean(seniorCustomer) },
        vatRegistered: shop.vatRegistered,
        vatRate: shop.vatRate,
      });

      const id = `sal-${sales.length + 1}`;
      const payments: SalePayment[] = [];
      const method = rng.weighted([
        ["cash", 60],
        ["gcash", 22],
        ["maya", 8],
        ["card", 6],
        ["bank_transfer", 2],
      ] as const) as PaymentMethod;

      if (method === "cash") {
        const tendered = Math.ceil(tax.totalDue / 100) * 100;
        payments.push({
          id: `spm-${id}-1`,
          method: "cash",
          amount: tax.totalDue,
          tendered,
          change: money(tendered - tax.totalDue),
        });
        cashTaken += tax.totalDue;
      } else if (rng.bool(0.12)) {
        const half = money(tax.totalDue / 2);
        payments.push({ id: `spm-${id}-1`, method: "cash", amount: half, tendered: half, change: 0 });
        payments.push({
          id: `spm-${id}-2`,
          method,
          amount: money(tax.totalDue - half),
          reference: rng.digits(10),
        });
        cashTaken += half;
      } else {
        payments.push({ id: `spm-${id}-1`, method, amount: tax.totalDue, reference: rng.digits(10) });
      }

      const sale: Sale = {
        id,
        saleNo: saleNo(soldAt),
        officialReceiptNo: rng.bool(0.4) ? `OR-${rng.digits(6)}` : undefined,
        customerId: seniorCustomer?.id ?? (rng.bool(0.4) ? rng.pick(customers).id : undefined),
        lines,
        subtotal,
        orderDiscount,
        seniorPwdDiscount: seniorCustomer
          ? {
              idNumber: seniorCustomer.seniorPwdId!,
              type: seniorCustomer.seniorPwdType ?? "senior",
              name: seniorCustomer.name,
              beneficiaries: 1,
              vatExemptSales: tax.vatExemptSales,
              discountAmount: tax.seniorPwdDiscount,
            }
          : undefined,
        vatableSales: tax.vatableSales,
        vatExemptSales: tax.vatExemptSales,
        vatAmount: tax.vatAmount,
        zeroRatedSales: 0,
        totalDue: tax.totalDue,
        payments,
        status: "completed",
        cashierId: cashier.id,
        shiftId: shift.id,
        soldAt: iso(soldAt),
      };
      sales.push(sale);

      lines
        .filter((line) => line.kind === "accessory" && line.itemId)
        .forEach((line) => {
          pending.push({
            itemId: line.itemId!,
            quantity: -line.quantity,
            reason: "sale",
            at: soldAt,
            reference: sale.saleNo,
            saleId: sale.id,
            by: cashier.id,
          });
        });
      lines
        .filter((line) => line.kind === "handset" && line.unitId)
        .forEach((line) => {
          movements.push({
            id: `mv-${movements.length + 1}`,
            itemId: line.itemId!,
            unitId: line.unitId,
            quantity: -1,
            reason: "sale",
            reference: sale.saleNo,
            saleId: sale.id,
            at: iso(soldAt),
            by: cashier.id,
          });
        });
    }

    if (rng.bool(0.15)) {
      const out = rng.price(200, 800, 50);
      shift.movements.push({
        id: `csh-${shift.id}-1`,
        shiftId: shift.id,
        kind: "cash_out",
        amount: out,
        reason: rng.pick(["Parts run to Raon", "Load and supplies", "Meryenda", "Delivery fee"]),
        at: iso(atTime(day, rng.int(11, 16), 0)),
        by: cashier.id,
      });
      cashTaken -= out;
    }

    if (!isToday) {
      const expected = money(shift.startingCash + cashTaken);
      const variance = rng.bool(0.3) ? money(rng.pick([-50, -20, 20, 100]) / 1) : 0;
      shift.closedAt = iso(atTime(day, 20, rng.int(0, 30)));
      shift.closedBy = cashier.id;
      shift.expectedCash = expected;
      shift.countedCash = money(expected + variance);
      shift.variance = variance;
    }

    shifts.push(shift);
  }

  /* ── Resolve stock levels from the movement history ───────────────── */

  const grouped = new Map<string, PendingMove[]>();
  pending.forEach((move) => {
    const list = grouped.get(move.itemId) ?? [];
    list.push(move);
    grouped.set(move.itemId, list);
  });

  items
    .filter((item) => item.itemClass !== "handset")
    .forEach((item) => {
      const list = (grouped.get(item.id) ?? []).sort(
        (a, b) => a.at.getTime() - b.at.getTime(),
      );
      const consumed = list.reduce((sum, move) => sum + Math.abs(move.quantity), 0);
      const lot = Math.max(item.reorderPoint * 3, Math.ceil(consumed / 3), 6);

      let balance = lot + item.reorderPoint;
      const openingAt = addDays(now, -95);
      movements.push({
        id: `mv-${movements.length + 1}`,
        itemId: item.id,
        quantity: balance,
        reason: "receiving",
        reference: `DR-${rng.digits(5)}`,
        unitCost: item.unitCost,
        at: iso(openingAt),
        by: "u-manager",
        note: "Opening stock",
      });

      list.forEach((move) => {
        if (balance + move.quantity < 0) {
          balance += lot;
          movements.push({
            id: `mv-${movements.length + 1}`,
            itemId: item.id,
            quantity: lot,
            reason: "receiving",
            reference: `DR-${rng.digits(5)}`,
            unitCost: item.unitCost,
            at: iso(addHours(move.at, -6)),
            by: "u-manager",
          });
        }
        balance += move.quantity;
        movements.push({
          id: `mv-${movements.length + 1}`,
          itemId: item.id,
          quantity: move.quantity,
          reason: move.reason,
          reference: move.reference,
          ticketId: move.ticketId,
          saleId: move.saleId,
          at: iso(move.at),
          by: move.by,
        });
      });

      /* A few real-world corrections so the adjustment screen has history. */
      if (rng.bool(0.18) && balance > 2) {
        const adjustment = -rng.int(1, 2);
        balance += adjustment;
        movements.push({
          id: `mv-${movements.length + 1}`,
          itemId: item.id,
          quantity: adjustment,
          reason: rng.pick(["damaged", "lost", "count_correction"] as MovementReason[]),
          at: iso(addDays(now, -rng.int(2, 40))),
          by: "u-manager",
          note: "Physical count",
        });
      }

      item.quantityOnHand = Math.max(0, balance);
    });

  /* Push a handful of items under their reorder point on purpose. */
  items
    .filter((item) => item.itemClass !== "handset")
    .forEach((item, index) => {
      if (index % 9 === 0) item.quantityOnHand = Math.max(0, item.reorderPoint - rng.int(0, 2));
    });

  handsets.forEach((item) => {
    const inStock = (item.units ?? []).filter((unit) => unit.status === "in_stock" || unit.status === "reserved");
    item.quantityOnHand = inStock.length;
    item.unitCost = inStock.length
      ? money(inStock.reduce((sum, unit) => sum + unit.cost, 0) / inStock.length)
      : 0;
  });

  movements.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  items.forEach((item) => {
    const last = movements.find((movement) => movement.itemId === item.id);
    item.lastMovementAt = last?.at;
  });

  /* ── Settings reference data ──────────────────────────────────────── */

  const services = SERVICES.map((service, index) => ({
    id: `svc-${index + 1}`,
    ...service,
    active: true,
  }));

  const warrantyTemplates: Database["warrantyTemplates"] = [
    {
      id: "wtp-1",
      name: "Standard parts and labor — 30 days",
      periodDays: 30,
      scope: "The specific fault repaired and the parts replaced on this job order.",
      exclusions: [
        "Liquid damage after release",
        "Physical damage, drops, or bends",
        "Third-party tampering or repair by another shop",
        "Software issues from user-installed apps",
      ],
      isDefault: true,
    },
    {
      id: "wtp-2",
      name: "Battery replacement — 90 days",
      periodDays: 90,
      scope: "The replacement battery only.",
      exclusions: ["Liquid damage", "Physical damage", "Charging with a non-original adapter"],
      isDefault: false,
    },
    {
      id: "wtp-3",
      name: "Board-level work — 15 days",
      periodDays: 15,
      scope: "The board repair performed on this job order.",
      exclusions: [
        "Liquid damage after release",
        "Any new fault unrelated to the repaired section",
        "Physical damage",
      ],
      isDefault: false,
    },
    {
      id: "wtp-4",
      name: "Liquid damage treatment — no warranty",
      periodDays: 0,
      scope: "None. Liquid damage treatment is best-effort.",
      exclusions: ["All faults, including recurrence of the original fault"],
      isDefault: false,
    },
  ];

  const notificationTemplates: Database["notificationTemplates"] = [
    {
      id: "ntp-1",
      key: "ready_for_pickup",
      name: "Ready for pickup",
      channel: "viber",
      body: "Hi {customer}, ready na po ang {device} ninyo. Ticket {ticket_no}, balance {balance}. Dalhin po ang claim stub. — {shop}",
    },
    {
      id: "ntp-2",
      key: "quote_sent",
      name: "Quote sent",
      channel: "viber",
      body: "Hi {customer}, na-check na po namin ang {device}. Total {balance} kasama parts at labor. Sagot po kung tuloy: OO or HINDI. Ticket {ticket_no}. — {shop}",
    },
    {
      id: "ntp-3",
      key: "overdue_followup",
      name: "Delay notice",
      channel: "sms",
      body: "Hi {customer}, medyo na-delay po ang {device} (ticket {ticket_no}). Hinihintay pa po ang parts. Update namin kayo agad. — {shop}",
    },
    {
      id: "ntp-4",
      key: "unclaimed_notice",
      name: "Unclaimed unit notice",
      channel: "sms",
      body: "Hi {customer}, hindi pa po nakukuha ang {device}, ticket {ticket_no}, claim code {claim_code}. Pakikuha po within 30 days. — {shop}",
    },
  ];

  return {
    users,
    customers,
    tickets,
    timeline: timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    items,
    movements,
    suppliers,
    sales,
    returns: [],
    shifts,
    services,
    warrantyTemplates,
    notificationTemplates,
    notifications,
    shop,
  };
}

/** Used by the intake form and POS so new records keep the paper sequence. */
export function nextSequence(prefix: string, existing: string[], date: Date): string {
  const key = ym(date);
  const current = existing
    .filter((value) => value.startsWith(`${prefix}-${key}-`))
    .map((value) => Number(value.split("-")[2]))
    .filter((value) => Number.isFinite(value));
  const next = (current.length ? Math.max(...current) : 0) + 1;
  return `${prefix}-${key}-${String(next).padStart(4, "0")}`;
}
