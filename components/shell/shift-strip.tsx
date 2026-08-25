"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { RoleSwitcher } from "@/components/shell/role-switcher";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardSummary } from "@/lib/mock/api";

interface ShiftStripProps {
  summary?: DashboardSummary;
  loading: boolean;
  onOpenNav: () => void;
}

/**
 * The one strip that never changes across screens. It exists to answer the
 * three questions a counter asks mid-transaction — how much is in the drawer,
 * what is waiting to be picked up, what is late — without leaving the page.
 */
export function ShiftStrip({ summary, loading, onOpenNav }: ShiftStripProps) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const { resolvedTheme, setTheme } = useTheme();

  const submit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    const value = term.trim();
    if (!value) return;
    router.push(`/board?q=${encodeURIComponent(value)}`);
  };

  return (
    <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-rule bg-copy px-2 sm:px-3">
      <button
        type="button"
        onClick={onOpenNav}
        className="grid size-8 place-items-center rounded-sm border border-rule text-ink-soft hover:bg-secondary lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-4" aria-hidden />
      </button>

      <form onSubmit={submit} className="relative min-w-0 flex-1 sm:max-w-md">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
          aria-hidden
        />
        <input
          value={term}
          onChange={(changeEvent) => setTerm(changeEvent.target.value)}
          placeholder="Ticket no., claim code, IMEI, name, or mobile"
          aria-label="Search tickets"
          className="h-8 w-full rounded-sm border border-rule bg-paper pl-8 pr-10 text-sm placeholder:text-ink-faint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
        />
        <kbd className="mono pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-[3px] border border-rule px-1 text-[0.625rem] text-ink-faint sm:block">
          /
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="hidden items-stretch divide-x divide-rule border-x border-rule md:flex">
          <StripStat
            label="Drawer"
            value={
              loading
                ? "—"
                : summary?.cashOnHand === null || summary?.cashOnHand === undefined
                  ? "No shift"
                  : peso(summary.cashOnHand, { whole: true })
            }
            href="/pos/shift"
            muted={summary?.cashOnHand === null}
          />
          <StripStat
            label="Ready"
            value={loading ? "—" : String(summary?.readyForPickup ?? 0)}
            href="/release"
          />
          <StripStat
            label="Overdue"
            value={loading ? "—" : String(summary?.overdue ?? 0)}
            href="/board?overdue=1"
            alert={(summary?.overdue ?? 0) > 0}
          />
        </div>

        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="grid size-8 place-items-center rounded-sm border border-rule text-ink-soft hover:bg-secondary"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4" aria-hidden />
          ) : (
            <Moon className="size-4" aria-hidden />
          )}
        </button>

        <RoleSwitcher />
      </div>
    </header>
  );
}

function StripStat({
  label,
  value,
  href,
  alert,
  muted,
}: {
  label: string;
  value: string;
  href: string;
  alert?: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-[5.5rem] flex-col justify-center px-3 leading-none hover:bg-secondary",
        alert && "bg-stamp-fill",
      )}
    >
      <span className="label-pad text-[0.625rem]">{label}</span>
      <span
        className={cn(
          "mono mt-0.5 text-sm font-semibold",
          alert ? "text-stamp-ink" : muted ? "text-ink-faint" : "text-ink",
        )}
      >
        {value}
      </span>
    </Link>
  );
}
