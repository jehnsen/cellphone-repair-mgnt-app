import type { Permission, Role } from "@/lib/types";

/**
 * The permission matrix. Live, not dormant: the nav rail and mobile nav both
 * filter on `can()`, and a handful of screens gate controls on it.
 *
 * The shop runs two sites — the repair branch, and a sales-only floor
 * (appliances, handsets, laptops, accessories). Everyone is scoped to the
 * branch they work at; only the owner holds `branch.switch` — the client's
 * name for the server's `branches.view_all` — and can widen the view to
 * another branch or to all of them at once.
 *
 * Never a security boundary: every check here runs in the browser and every
 * route stays reachable by URL. The server enforces access — these checks only
 * keep the UI honest about what a role is meant to be doing. A 403 is rendered
 * as a plain "not permitted" state, not an error.
 */

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  technician: "Technician",
};

export const ROLE_BLURB: Record<Role, string> = {
  owner: "Sees margins, financial reports, and settings.",
  manager: "Runs the shop day to day, minus owner financials.",
  cashier: "One branch only: POS, intake, the board, release, and the drawer.",
  technician: "The job queue, diagnosis, and parts consumption.",
};

const ALL: Permission[] = [
  "ticket.create",
  "ticket.edit",
  "ticket.assign",
  "ticket.release",
  "ticket.void",
  "quote.send",
  "margin.view",
  "inventory.view",
  "inventory.receive",
  "inventory.adjust",
  "inventory.price",
  "pos.sell",
  "pos.discount.override",
  "pos.return",
  "shift.open",
  "shift.close",
  "reports.view",
  "reports.financial",
  "settings.manage",
  "users.manage",
  "branch.switch",
  "sales_warranty.view",
  "sales_warranty.manage",
  "supplier_returns.manage",
];

export const PERMISSION_LABEL: Record<Permission, string> = {
  "ticket.create": "Create tickets",
  "ticket.edit": "Edit tickets",
  "ticket.assign": "Assign technicians",
  "ticket.release": "Release units",
  "ticket.void": "Void tickets",
  "quote.send": "Send quotes",
  "margin.view": "See margin per ticket",
  "inventory.view": "View inventory",
  "inventory.receive": "Receive stock",
  "inventory.adjust": "Adjust stock",
  "inventory.price": "Change prices",
  "pos.sell": "Ring up sales",
  "pos.discount.override": "Override discounts",
  "pos.return": "Process returns",
  "shift.open": "Open a shift",
  "shift.close": "Close a shift",
  "reports.view": "View reports",
  "reports.financial": "View financial reports",
  "settings.manage": "Manage settings",
  "users.manage": "Manage users",
  "branch.switch": "See and switch between branches",
  "sales_warranty.view": "View sale warranties, claims, and supplier returns",
  "sales_warranty.manage": "File and resolve warranty claims",
  "supplier_returns.manage": "Create and close supplier returns",
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  /* `branch.switch` mirrors the server's `branches.view_all`, which is granted
     to the owner alone: a manager runs one branch. Asking to widen without it
     is a 403, so offering the control would only produce an error. */
  manager: ALL.filter((p) => p !== "users.manage" && p !== "branch.switch"),
  /* Counter work at their own branch: ring up sales, take a unit in, move it
     along the board, and hand it back. No reports, no stockroom, and no
     cross-branch view — the shop's figures are not theirs to see. Note that
     POS still sells stock: it reads the catalog through `getItems` directly,
     so dropping `inventory.view` hides the stockroom screen without taking
     anything off the counter. See ROLE_BLURB. */
  cashier: [
    "ticket.create",
    "ticket.edit",
    "ticket.release",
    "pos.sell",
    "pos.return",
    "shift.open",
    "shift.close",
    /* The counter owns the sales-side warranty end to end — issuing it at
       checkout, taking the claim, and sending a dud back to the vendor. */
    "sales_warranty.view",
    "sales_warranty.manage",
    "supplier_returns.manage",
  ],
  technician: [
    "ticket.edit",
    "ticket.assign",
    "quote.send",
    "inventory.view",
    "inventory.adjust",
    /* Read-only: a technician sees a claim to know what the bench is for,
       but the sales side files and resolves it. */
    "sales_warranty.view",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Navigation is filtered by this, so a technician never sees a dead link. */
export const NAV_PERMISSION: Record<string, Permission | null> = {
  "/": null,
  "/intake": "ticket.create",
  /* The board stays open to a cashier: they take the unit in and move it
     along, they just do not hand it back or see the shop's figures. */
  "/board": null,
  "/release": "ticket.release",
  "/pos": "pos.sell",
  "/inventory": "inventory.view",
  "/customers": null,
  "/warranties": "sales_warranty.view",
  "/reports": "reports.view",
  "/settings": "settings.manage",
  "/help": null,
};
