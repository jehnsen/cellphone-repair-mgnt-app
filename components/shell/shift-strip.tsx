"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Moon, Search, Sun, X } from "lucide-react";
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
 *
 * Below md the three stats drop to their own scrollable row, because losing
 * them entirely on a phone would defeat the point of the strip.
 */
export function ShiftStrip({ summary, loading, onOpenNav }: ShiftStripProps) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* "/" jumps to search from anywhere, unless the user is already typing. */
  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "/" || keyEvent.metaKey || keyEvent.ctrlKey) return;
      const target = keyEvent.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;
      keyEvent.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    const value = term.trim();
    if (!value) return;
    router.push(`/board?q=${encodeURIComponent(value)}`);
  };

  const stats = (
    <>
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
    </>
  );

  return (
    <div
      className={cn(
        "no-print sticky top-0 z-30 border-b border-rule bg-copy transition-shadow",
        scrolled && "shadow-strip",
      )}
    >
      <header className="flex h-14 items-center gap-2 px-2 sm:h-12 sm:px-3">
        <button
          type="button"
          onClick={onOpenNav}
          className="hidden size-9 place-items-center rounded-sm border border-rule text-ink-soft transition-colors hover:bg-secondary md:grid lg:hidden"
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
            ref={inputRef}
            value={term}
            onChange={(changeEvent) => setTerm(changeEvent.target.value)}
            placeholder="Ticket, claim code, IMEI, or name"
            aria-label="Search tickets"
            className="h-9 w-full rounded-sm border border-rule bg-paper pl-8 pr-16 text-sm transition-colors placeholder:text-ink-faint hover:border-rule-strong focus:bg-copy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:h-8"
          />
          {term ? (
            <button
              type="button"
              onClick={() => {
                setTerm("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-sm text-ink-faint hover:bg-secondary hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : (
            <kbd className="mono pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-[3px] border border-rule px-1 text-[0.625rem] text-ink-faint sm:block">
              /
            </kbd>
          )}
        </form>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-stretch self-stretch divide-x divide-rule border-x border-rule md:flex">
            {stats}
          </div>

          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="grid size-9 place-items-center rounded-sm border border-rule text-ink-soft transition-colors hover:bg-secondary sm:size-8"
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

      <div className="flex items-stretch divide-x divide-rule border-t border-rule-soft md:hidden">
        {stats}
      </div>
    </div>
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
        "flex flex-1 flex-col justify-center px-3 py-1.5 leading-none transition-colors hover:bg-secondary md:min-w-[6rem] md:flex-none md:py-0",
        alert && "bg-stamp-fill hover:bg-stamp-fill/70",
      )}
    >
      <span className="label-pad text-[0.625rem]">{label}</span>
      <span
        className={cn(
          "mono mt-1 text-sm font-semibold md:mt-0.5",
          alert ? "text-stamp-ink" : muted ? "text-ink-faint" : "text-ink",
        )}
      >
        {value}
      </span>
    </Link>
  );
}
