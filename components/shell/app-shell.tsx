"use client";

import { useState } from "react";
import { NavRail } from "@/components/shell/nav-rail";
import { ShiftStrip } from "@/components/shell/shift-strip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useShop } from "@/lib/mock/store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready } = useShop();
  const [navOpen, setNavOpen] = useState(false);
  const { data: summary, loading } = useQuery((api) => api.getDashboard());

  const counts = {
    overdue: summary?.overdue ?? 0,
    ready: summary?.readyForPickup ?? 0,
    lowStock: summary?.lowStock ?? 0,
  };

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper p-6">
        <div className="w-full max-w-sm border border-rule bg-copy p-6">
          <p className="label-pad">Job order</p>
          <p className="mt-2 text-sm text-ink">Loading the shop&rsquo;s records.</p>
          <div className="mt-4 h-1 w-full overflow-hidden bg-secondary">
            <div className="h-full w-1/3 animate-pulse bg-bench" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-paper">
      <aside className="no-print sticky top-0 hidden h-dvh w-[216px] shrink-0 border-r border-rule bg-paper lg:block">
        <NavRail counts={counts} />
      </aside>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[248px] bg-paper p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <NavRail counts={counts} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <ShiftStrip
          summary={summary}
          loading={loading}
          onOpenNav={() => setNavOpen(true)}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
