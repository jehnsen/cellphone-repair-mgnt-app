"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, PanelLeftClose, PanelLeftOpen, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, type NavItem } from "@/components/shell/nav";
import { useShop } from "@/lib/shop/store";
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
 * The rail. Labels lead at full width — under fluorescent light a word is
 * faster than a glyph — and icons take over when it collapses on a narrow
 * laptop. The active row is a filled pill with a gradient marker down its
 * left edge, which is the one place navigation is allowed to carry the brand.
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
            <span className="brandmark notch [--notch-edge:transparent] mono grid size-9 place-items-center text-[0.6875rem] font-semibold">
              JO
            </span>
          ) : (
            <span className="flex items-center gap-2.5">
              <span className="brandmark notch [--notch-edge:transparent] grid size-9 shrink-0 place-items-center">
                <Wrench className="size-4.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-sm font-semibold leading-tight tracking-[-0.02em] text-ink">
                  {db.shop.name || "Repair shop"}
                </span>
                <span className="label-pad block text-[0.5625rem] text-ink-faint">
                  Repair &amp; retail
                </span>
              </span>
            </span>
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
                <div className="flex items-center gap-2 px-3 pb-1">
                  <span className="label-pad">{section.title}</span>
                  <span className="graduated h-[3px] flex-1 opacity-70" aria-hidden />
                </div>
              )}

              <ul className={cn("space-y-0.5 px-2", collapsed && "space-y-1")}>
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

      <div className={cn("border-t border-rule/70 px-2 pt-2", collapsed && "px-2")}>
        <HelpLink
          active={pathname.startsWith("/help")}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
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

/**
 * The guide, pinned under the menu rather than filed inside a section — it is
 * about the app, not the shop, so it does not belong under Counter / Shop /
 * Office. Styled like the Collapse control below it, not like a nav item.
 */
function HelpLink({
  active,
  collapsed,
  onNavigate,
}: {
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href="/help"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm border px-2 py-1.5 text-xs transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "border-rule bg-copy font-medium text-ink shadow-panel"
          : "border-transparent text-ink-soft hover:border-rule hover:bg-copy hover:text-ink",
      )}
    >
      <BookOpen className="size-4 shrink-0" aria-hidden />
      {collapsed ? (
        <span className="sr-only">Help &amp; guide</span>
      ) : (
        <span>Help &amp; guide</span>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">Help &amp; guide</TooltipContent>
    </Tooltip>
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
          : "tap rounded-sm py-2 pl-3 pr-2.5",
        active
          ? "bg-bench-fill font-semibold text-bench-ink shadow-panel ring-1 ring-bench/25"
          : "text-ink-soft hover:bg-copy hover:text-ink",
      )}
    >
      {/* The lit edge. Gradient rather than a flat rule, and the only brand
          colour in the rail besides the mark at the top. */}
      {active ? (
        <span className="rule-accent absolute inset-y-0 left-0 w-[3px]" aria-hidden />
      ) : null}
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-bench" : "text-ink-faint group-hover:text-bench",
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
              ? "absolute -right-0.5 -top-0.5 min-w-4 rounded-sm px-1 text-[0.625rem] leading-4"
              : "min-w-5 rounded-sm px-1.5",
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
