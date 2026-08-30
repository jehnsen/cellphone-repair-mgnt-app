"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  EyeOff,
  ShieldCheck,
  Smartphone,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/states";
import { useShop } from "@/lib/shop/store";
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
  const { db, signIn, authError, apiBaseUrl } = useShop();

  const [email, setEmail] = useState("ricardo.santos@fixmo.test");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /* Rendered after mount so the greeting never mismatches the server HTML. */
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => setNow(new Date()), []);

  const submit = async () => {
    setSubmitting(true);
    const signedIn = await signIn({ email: email.trim(), password });
    if (signedIn) {
      router.push("/");
    } else {
      setSubmitting(false);
    }
  };

  const shopName = db.shop.name || "Nelson Cellphone & Computer Repair Shop";

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side. Hidden on phones, where it would only push the form down.
          Deliberately dark in BOTH themes, so it is pinned to literal values
          rather than --ink/--paper, which swap between light and dark. */}
      <aside className="relative hidden overflow-hidden bg-[#0b0f17] px-10 py-12 text-white lg:flex lg:flex-col xl:px-14">
        {/* The panel is dressed as a workbench, not a product hero: the graph
            paper a tech sketches a board layout on, copper traces routed
            across it, and one warm pool of light from the bench lamp. All
            pinned to literal values — this panel is dark in both themes, so
            --ink/--paper would invert it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />

        <svg
          aria-hidden
          viewBox="0 0 400 620"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <g fill="none" stroke="#e0a860" strokeOpacity="0.14" strokeWidth="1.5">
            <path d="M-10 92 H120 q14 0 14 14 V210 q0 14 14 14 H330" />
            <path d="M46 -10 V60 q0 14 14 14 H210 q14 0 14 14 V186" />
            <path d="M410 150 H300 q-14 0 -14 14 V300 q0 14 -14 14 H150 q-14 0 -14 14 V438" />
            <path d="M-10 384 H92 q14 0 14 -14 V300" />
            <path d="M120 630 V520 q0 -14 14 -14 H300 q14 0 14 -14 V360 H410" />
            <path d="M256 630 V560 q0 -14 14 -14 H410" />
          </g>
          <g fill="#e0a860" fillOpacity="0.22">
            <circle cx="330" cy="224" r="3.5" />
            <circle cx="60" cy="74" r="3.5" />
            <circle cx="150" cy="438" r="3.5" />
            <circle cx="92" cy="300" r="3.5" />
            <circle cx="270" cy="546" r="3.5" />
          </g>
        </svg>

        {/* Bench lamp: a warm, off-centre pool of light, not a cold product glow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-32 size-[30rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(255,180,102,0.16), rgba(255,180,102,0) 70%)",
          }}
        />
        {/* Floor shadow, so the copy at the bottom keeps its contrast. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
          style={{
            background:
              "linear-gradient(to top, rgba(3,5,10,0.85), rgba(3,5,10,0))",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-bench text-white shadow-raised">
            <Wrench className="size-4.5" aria-hidden />
          </span>
          <span className="label-bin text-white/90">NCC Repair Shop</span>
        </div>

        <div className="relative my-auto max-w-md py-10">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white xl:text-5xl">
            {shopName}
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

        {db.shop.city ? (
          <p className="relative text-xs text-white/40">{db.shop.city}</p>
        ) : null}
      </aside>

      {/* Sign-in side. */}
      <main className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10 lg:min-h-0">
        <div className="mx-auto w-full max-w-104">
          {/* Wordmark. Shown at every width: on desktop the workbench panel
              carries the name too, but the form still needs its own mark so
              it is not anonymous; on phones the panel is hidden entirely. */}
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-bench text-white shadow-raised">
              <Wrench className="size-4.5" aria-hidden />
            </span>
            <span className="label-bin text-ink">{shopName}</span>
          </div>

          <div className="mt-9">
            <p className="label-pad">{now ? formatDate(now) : " "}</p>
            <h1 className="display-lg mt-1.5">Good {greeting(now)}.</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Sign in to open the shop for the day.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
            className="mt-7 space-y-4 rounded-lg border border-rule bg-copy p-5 shadow-raised sm:p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="label-pad">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@shop.test"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="label-pad">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-faint transition-colors hover:text-ink-soft focus-visible:text-ink focus-visible:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {authError ? <ErrorState error={authError} /> : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? "Signing in…" : "Sign in"}
              <ArrowRight aria-hidden />
            </Button>
          </form>

          {/* This prototype has no real auth — the fields come pre-filled with
              a seeded identity. Say so plainly rather than implying a login
              wall that is not there. */}
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              Demo sign-in — pre-filled with a seeded account. It does not
              verify anyone, and every screen is reachable without it.
            </span>
          </p>
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
