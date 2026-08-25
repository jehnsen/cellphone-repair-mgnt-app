"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "@/components/shell/nav";
import { useShop } from "@/lib/mock/store";
import type { NavCounts } from "@/components/shell/nav-rail";

/**
 * Phone navigation. A counter phone is held one-handed while a customer talks,
 * so the four things staff actually reach for live in a thumb-height bar and
 * everything else is one tap away behind More.
 */
export function MobileNav({
  counts,
  onOpenMore,
}: {
  counts: NavCounts;
  onOpenMore: () => void;
}) {
  const pathname = usePathname();
  const { can } = useShop();

  const primary = NAV.flatMap((section) => section.items)
    .filter((item) => item.permission === null || can(item.permission))
    .slice(0, 4);

  return (
    <nav
      aria-label="Primary"
      className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-flow-col border-t border-rule bg-copy shadow-[0_-6px_16px_-14px_rgb(0_0_0/0.5)] md:hidden"
    >
      {primary.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const count = item.badge ? counts[item.badge] : 0;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-1 text-[0.6875rem] font-medium transition-colors",
              active ? "text-ink" : "text-ink-soft",
            )}
          >
            {active ? (
              <span className="absolute inset-x-3 top-0 h-[2px] bg-bench" aria-hidden />
            ) : null}
            <span className="relative">
              <Icon
                className={cn("size-5", active ? "text-bench" : "text-ink-faint")}
                aria-hidden
              />
              {count > 0 ? (
                <span
                  className={cn(
                    "mono absolute -right-2.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-[0.625rem] font-semibold leading-4",
                    item.badge === "overdue"
                      ? "bg-stamp text-white"
                      : "bg-secondary text-ink-soft",
                  )}
                >
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate">{shortLabel(item.label)}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMore}
        className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-1 text-[0.6875rem] font-medium text-ink-soft"
      >
        <MoreHorizontal className="size-5 text-ink-faint" aria-hidden />
        <span>More</span>
      </button>
    </nav>
  );
}

/** Tab bars have room for one or two words, not four. */
function shortLabel(label: string): string {
  switch (label) {
    case "New job order":
      return "Intake";
    case "Repair board":
      return "Board";
    case "Point of sale":
      return "POS";
    case "Day sheet":
      return "Today";
    default:
      return label;
  }
}
