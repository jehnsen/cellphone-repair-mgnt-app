"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import { useShop } from "@/lib/shop/store";
import { cn } from "@/lib/utils";

interface ShiftStripProps {
  onOpenNav: () => void;
}

/**
 * The one strip that never changes across screens: search, theme, who you are,
 * and the way out. The day's counts live on the day sheet rather than here.
 */
export function ShiftStrip({ onOpenNav }: ShiftStripProps) {
  const router = useRouter();
  const { user, signOut } = useShop();
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
          {/* Absent for a cashier: one branch, nothing to switch between. */}
          <BranchSwitcher />

          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="grid size-9 place-items-center rounded-full border border-rule text-ink-soft transition-colors hover:bg-secondary sm:size-8"
            aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" aria-hidden />
            ) : (
              <Moon className="size-4" aria-hidden />
            )}
          </button>

          {/* One operator, so this names them rather than offering a switch. */}
          <span className="flex items-center gap-2 rounded-full border border-rule bg-copy py-1 pl-1 pr-2.5">
            <span className="mono grid size-6 shrink-0 place-items-center rounded-full bg-ink text-[0.625rem] font-semibold text-paper">
              {user.initials}
            </span>
            <span className="hidden text-xs font-medium leading-none text-ink sm:block">
              {user.name}
            </span>
          </span>

          <button
            type="button"
            onClick={() => {
              signOut();
              router.push("/login");
            }}
            className="grid size-9 place-items-center rounded-full border border-rule text-ink-soft transition-colors hover:border-stamp/40 hover:bg-stamp-fill hover:text-stamp-ink sm:size-8"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </div>
      </header>
    </div>
  );
}
