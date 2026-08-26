"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavRail } from "@/components/shell/nav-rail";
import { MobileNav } from "@/components/shell/mobile-nav";
import { ShiftStrip } from "@/components/shell/shift-strip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useShop } from "@/lib/mock/store";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "jo.railCollapsed";

/** Routes that own the whole viewport and get no nav rail or shift strip. */
const BARE_ROUTES = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready } = useShop();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: summary } = useQuery((api) => api.getDashboard());

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      window.localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      return !value;
    });
  }, []);

  const counts = {
    overdue: summary?.overdue ?? 0,
    ready: summary?.readyForPickup ?? 0,
    lowStock: summary?.lowStock ?? 0,
  };

  /* Login owns its viewport and its own loading copy. */
  if (BARE_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper p-6">
        <div className="w-full max-w-sm border border-rule bg-copy p-6 shadow-panel">
          <p className="label-pad">Job order</p>
          <p className="mt-2 text-sm text-ink">Loading the shop&rsquo;s records.</p>
          <div
            className="mt-4 h-1 w-full overflow-hidden bg-secondary"
            role="progressbar"
            aria-label="Loading shop records"
          >
            <div className="h-full w-1/3 animate-pulse bg-bench" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-rule focus:bg-copy focus:px-3 focus:py-2 focus:text-sm focus:shadow-float"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 border-r border-rule bg-paper transition-[width] duration-200 lg:block",
          collapsed ? "w-14" : "w-[216px]",
        )}
      >
        <NavRail
          counts={counts}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[264px] bg-paper p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <NavRail counts={counts} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <ShiftStrip onOpenNav={() => setNavOpen(true)} />
        <main id="main" className="min-w-0 flex-1 pb-16 md:pb-0">
          {children}
        </main>
      </div>

      <MobileNav counts={counts} onOpenMore={() => setNavOpen(true)} />
    </div>
  );
}
