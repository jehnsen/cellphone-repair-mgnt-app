import type { Permission, Role } from "@/lib/types";

/**
 * The permission matrix Settings renders and every guard reads.
 * No auth logic here — the role switcher just changes who we pretend to be.
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
  cashier: "Counter work: intake, release, POS, and the drawer.",
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
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  manager: ALL.filter((p) => p !== "users.manage"),
  cashier: [
    "ticket.create",
    "ticket.edit",
    "ticket.release",
    "inventory.view",
    "pos.sell",
    "pos.return",
    "shift.open",
    "shift.close",
    "reports.view",
  ],
  technician: [
    "ticket.edit",
    "ticket.assign",
    "quote.send",
    "inventory.view",
    "inventory.adjust",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Navigation is filtered by this, so a technician never sees a dead link. */
export const NAV_PERMISSION: Record<string, Permission | null> = {
  "/": null,
  "/intake": "ticket.create",
  "/board": null,
  "/release": "ticket.release",
  "/pos": "pos.sell",
  "/inventory": "inventory.view",
  "/customers": null,
  "/reports": "reports.view",
  "/settings": "settings.manage",
};
