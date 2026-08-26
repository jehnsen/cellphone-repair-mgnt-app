"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardCheck,
  Info,
  MapPin,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShop } from "@/lib/mock/store";
import { formatDate } from "@/lib/format";

/**
 * A sign-in screen for a prototype that has no authentication.
 *
 * There is no backend, no credential on `User`, and the whole shop lives in
 * browser memory. The shop is also a one-man operation, so there is nobody to
 * choose between — this screen just opens the day. Nothing here is a security
 * boundary and it must not be treated as one; a real build replaces this with
 * an identity provider and moves permission checks to the server.
 */
export function LoginView() {
  const router = useRouter();
  const { db, ready, user } = useShop();

  const [submitting, setSubmitting] = useState(false);
  /* Rendered after mount so the greeting never mismatches the server HTML. */
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => setNow(new Date()), []);

  const signIn = () => {
    setSubmitting(true);
    router.push("/");
  };

  const shopName = db.shop.name || "Job Order";

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side. Hidden on phones, where it would only push the form down.
          Deliberately dark in BOTH themes, so it is pinned to literal values
          rather than --ink/--paper, which swap between light and dark. */}
      <aside className="relative hidden overflow-hidden bg-[#0b0f17] px-10 py-12 text-white lg:flex lg:flex-col xl:px-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-bench/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-bench/10 blur-3xl"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-bench text-white">
            <Wrench className="size-4.5" aria-hidden />
          </span>
          <span className="label-bin text-white">Job Order</span>
        </div>

        <div className="relative my-auto max-w-md py-10">
          <h2
            className="font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white xl:text-5xl"
          >
            Every unit accounted for, from counter to claim.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Intake, the repair board, release, stock, and the drawer — one
            record per job, from the moment it lands on the counter.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              { icon: ClipboardCheck, text: "Job orders with a printable claim stub" },
              { icon: Smartphone, text: "Handsets tracked one IMEI at a time" },
              { icon: ShieldCheck, text: "Warranty and balance settled at release" },
            ].map((row) => (
              <li key={row.text} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/10">
                  <row.icon className="size-3.5 text-white/80" aria-hidden />
                </span>
                <span className="text-sm text-white/80">{row.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">{db.shop.city}</p>
      </aside>

      {/* Sign-in side. */}
      <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10 lg:min-h-0">
        <div className="mx-auto w-full max-w-sm">
          {/* The wordmark repeats here for phones, where the panel is hidden. */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-bench text-white">
              <Wrench className="size-4.5" aria-hidden />
            </span>
            <span className="label-bin text-ink">Job Order</span>
          </div>

          <p className="label-pad">
            {now ? formatDate(now) : " "}
          </p>
          <h1 className="display-lg mt-1">Good {greeting(now)}.</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            Sign in to open {shopName}.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              signIn();
            }}
            className="mt-7 space-y-4"
          >
            <div className="flex items-center gap-3 rounded-lg border border-rule bg-copy px-3 py-3 shadow-panel">
              <span className="mono grid size-10 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-paper">
                {ready ? user.initials : "  "}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {ready ? user.name : "Loading…"}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  Owner · runs the whole shop
                </p>
              </div>
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-bench-fill px-2 py-1 sm:flex">
                <span className="size-1.5 rounded-full bg-bench" aria-hidden />
                <span className="text-[0.6875rem] font-medium text-bench-ink">
                  Ready
                </span>
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!ready || submitting}
            >
              {submitting ? "Opening…" : "Open the shop"}
              <ArrowRight aria-hidden />
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
            <span>
              {db.shop.addressLine}
              <br />
              {db.shop.city} · {db.shop.mobile}
            </span>
          </div>

          {/* Never let a demo screen imply a security boundary it does not have. */}
          <div className="mt-6 flex items-start gap-2 rounded-lg border border-rule bg-secondary/60 px-3 py-2.5">
            <Info className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
            <p className="text-xs leading-relaxed text-ink-soft">
              <span className="font-medium text-ink">Prototype — no authentication.</span>{" "}
              This screen does not verify anyone, and every page stays reachable
              directly by URL.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function greeting(now: Date | null): string {
  if (!now) return "day";
  const hour = now.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
