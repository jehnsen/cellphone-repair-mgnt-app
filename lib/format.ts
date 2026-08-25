/**
 * Formatting lives at the edge. Models hold numbers and ISO strings;
 * these functions are the only place they become text.
 */

export const TIMEZONE = "Asia/Manila";

/** Round to centavos. Every write path that produces money goes through this. */
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pesoWholeFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** ₱1,234.50 */
export function peso(value: number, opts?: { whole?: boolean }): string {
  const f = opts?.whole ? pesoWholeFormatter : pesoFormatter;
  return f.format(value ?? 0);
}

/** 1,234.50 — for receipt columns where the sign sits in its own column. */
export function amount(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

/** ₱18.4k — compact, for tight strips only. Never in a table of comparisons. */
export function pesoCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `₱${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return peso(value, { whole: true });
}

export function count(value: number): string {
  return new Intl.NumberFormat("en-PH").format(value ?? 0);
}

/* ── Dates: MMM DD, YYYY and 12-hour time, always Asia/Manila ────────── */

const dateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIMEZONE,
  month: "short",
  day: "2-digit",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dayFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIMEZONE,
  weekday: "short",
});

export function formatDate(iso: string | Date): string {
  return dateFmt.format(new Date(iso));
}

export function formatTime(iso: string | Date): string {
  return timeFmt.format(new Date(iso)).toLowerCase();
}

export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function formatWeekday(iso: string | Date): string {
  return dayFmt.format(new Date(iso));
}

/** yyyy-mm-dd in Manila, for grouping and date inputs. */
export function manilaDayKey(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/* ── Durations: the board reads age constantly, so keep it terse ─────── */

export function hoursBetween(from: string | Date, to: string | Date = new Date()) {
  return (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
}

export function daysBetween(from: string | Date, to: string | Date = new Date()) {
  return hoursBetween(from, to) / 24;
}

/** "4h", "3d", "12d" — what sits on a board card. */
export function shortAge(from: string | Date, to: string | Date = new Date()): string {
  const hours = hoursBetween(from, to);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/** "+3d late" / "due today" / "in 2d" — the promised-date read. */
export function dueLabel(promisedAt: string | Date, now: Date = new Date()): string {
  const days = daysBetween(now, promisedAt);
  if (days < -0.5) return `${Math.round(Math.abs(days))}d late`;
  if (days < 0.5) return "due today";
  if (days < 1.5) return "due tomorrow";
  return `in ${Math.round(days)}d`;
}

/* ── Identifiers ─────────────────────────────────────────────────────── */

/** 356938035643809 → 35 693803 564380 9, so staff can read it aloud. */
export function formatImei(imei: string): string {
  const clean = imei.replace(/\s+/g, "");
  if (clean.length !== 15) return clean;
  return `${clean.slice(0, 2)} ${clean.slice(2, 8)} ${clean.slice(8, 14)} ${clean.slice(14)}`;
}

/** 09171234567 → 0917 123 4567 */
export function formatMobile(mobile: string): string {
  const clean = mobile.replace(/\D/g, "");
  if (clean.length !== 11) return mobile;
  return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7)}`;
}

/** R4K7Q2 → R4K7-Q2, the grouping printed on the claim stub. */
export function formatClaimCode(code: string): string {
  const clean = code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (clean.length <= 4) return clean;
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** percent with no trailing noise: 42.5% */
export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits).replace(/\.0$/, "")}%`;
}
