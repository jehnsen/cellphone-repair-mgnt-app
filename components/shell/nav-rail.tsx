"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, type NavItem } from "@/components/shell/nav";
import { useShop } from "@/lib/mock/store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface NavCounts {
  overdue: number;
  ready: number;
  lowStock: number;
}

interface NavRailProps {
  counts: NavCounts;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

/**
 * Text-label rail, set like the divider tabs of a filing cabinet. Icons are
 * secondary at full width — under fluorescent light a word is faster than a
 * glyph — and only take over when the rail collapses on a narrow laptop.
 */
export function NavRail({
  counts,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: NavRailProps) {
  const pathname = usePathname();
  const { can, db } = useShop();

  const isActive = (item: NavItem) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

  return (
    <nav
      aria-label="Main"
      className="flex h-full flex-col gap-5 overflow-hidden py-3"
    >
      <div className={cn("px-3", collapsed && "px-0")}>
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            "group block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            collapsed && "grid place-items-center",
          )}
          title={db.shop.name}
        >
          {collapsed ? (
            <span className="mono grid size-8 place-items-center bg-ink text-[0.6875rem] font-semibold text-paper">
              JO
            </span>
          ) : (
            <>
              <span className="label-pad block text-[0.625rem]">Job order</span>
              <span className="mt-0.5 block truncate font-display text-sm font-semibold leading-tight tracking-[-0.008em] text-ink">
                {db.shop.name || "Repair shop"}
              </span>
            </>
          )}
        </Link>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden">
        {NAV.map((section) => {
          const items = section.items.filter(
            (item) => item.permission === null || can(item.permission),
          );
          if (!items.length) return null;

          return (
            <div key={section.title}>
              {collapsed ? (
                <div className="mx-auto mb-1.5 h-px w-6 bg-rule" aria-hidden />
              ) : (
                <div className="flex items-center gap-2 px-3 pb-1.5">
                  <span className="label-pad">{section.title}</span>
                  <span className="h-px flex-1 bg-rule" aria-hidden />
                </div>
              )}

              <ul className={cn("space-y-px", collapsed && "space-y-1 px-2")}>
                {items.map((item) => (
                  <li key={item.href}>
                    <RailLink
                      item={item}
                      active={isActive(item)}
                      count={item.badge ? counts[item.badge] : 0}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {onToggleCollapsed ? (
        <div className={cn("hidden px-3 lg:block", collapsed && "px-2")}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm border border-transparent px-2 py-1.5 text-xs text-ink-soft transition-colors hover:border-rule hover:bg-copy hover:text-ink",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-4" aria-hidden />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </nav>
  );
}

function RailLink({
  item,
  active,
  count,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  count: number;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 text-sm transition-colors",
        collapsed
          ? "h-10 justify-center rounded-sm"
          : "tap border-l-[3px] py-2 pl-[13px] pr-3",
        active
          ? collapsed
            ? "bg-copy font-semibold text-ink shadow-panel ring-1 ring-rule"
            : "border-l-bench bg-copy font-semibold text-ink"
          : collapsed
            ? "text-ink-soft hover:bg-copy/70 hover:text-ink"
            : "border-l-transparent text-ink-soft hover:bg-copy/60 hover:text-ink",
      )}
    >
      {active && collapsed ? (
        <span
          className="absolute inset-y-1 left-0 w-[3px] bg-bench"
          aria-hidden
        />
      ) : null}
      <Icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-bench" : "text-ink-faint group-hover:text-ink-soft",
        )}
        aria-hidden
      />
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="flex-1 truncate">{item.label}</span>
      )}
      {count > 0 ? (
        <span
          className={cn(
            "mono text-center text-[0.6875rem] font-semibold leading-5",
            collapsed
              ? "absolute -right-0.5 -top-0.5 min-w-4 rounded-full px-1 text-[0.625rem] leading-4"
              : "min-w-5 rounded-sm px-1",
            item.badge === "overdue"
              ? "bg-stamp text-white"
              : "bg-secondary text-ink-soft",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        {item.label}
        {count > 0 ? <span className="mono opacity-80">{count}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}
