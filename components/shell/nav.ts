import {
  Boxes,
  ClipboardPen,
  Columns3,
  Gauge,
  PackageCheck,
  ScanBarcode,
  Settings2,
  Sheet,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission | null;
  /** Shown in the rail as a running count when the shell can compute one. */
  badge?: "overdue" | "ready" | "lowStock";
}

export interface NavSection {
  /** Filing-cabinet divider label. */
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: "Counter",
    items: [
      { href: "/", label: "Dashboard", icon: Gauge, permission: null },
      { href: "/intake", label: "New job order", icon: ClipboardPen, permission: "ticket.create" },
      { href: "/board", label: "Repair board", icon: Columns3, permission: null, badge: "overdue" },
      { href: "/release", label: "Release", icon: PackageCheck, permission: "ticket.release", badge: "ready" },
      { href: "/pos", label: "Point of sale", icon: ScanBarcode, permission: "pos.sell" },
    ],
  },
  {
    title: "Shop",
    items: [
      { href: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory.view", badge: "lowStock" },
      { href: "/customers", label: "Customers", icon: Users, permission: null },
      { href: "/warranties", label: "Warranties", icon: ShieldCheck, permission: "sales_warranty.view" },
    ],
  },
  {
    title: "Office",
    items: [
      { href: "/reports", label: "Reports", icon: Sheet, permission: "reports.view" },
      { href: "/settings", label: "Settings", icon: Settings2, permission: "settings.manage" },
    ],
  },
];
