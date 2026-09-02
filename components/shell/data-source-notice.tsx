"use client";

import { AlertTriangle, Wifi } from "lucide-react";
import { PENDING_CONTEXTS } from "@/lib/api/config";
import { useShop } from "@/lib/shop/store";
import { cn } from "@/lib/utils";

/**
 * Where the numbers come from.
 *
 * Everything on screen is read from the API. A few contexts have no endpoints
 * yet, and their screens are empty rather than filled with invented rows —
 * this says which, so nobody mistakes an empty list for a quiet day.
 */
export function DataSourceNotice({
  variant = "full",
  className,
}: {
  variant?: "full" | "inline";
  className?: string;
}) {
  const { apiBaseUrl, warnings, user } = useShop();

  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm border border-bench/30 bg-bench-fill px-2 py-0.5 text-[0.6875rem] font-medium text-bench-ink",
          className,
        )}
        title={apiBaseUrl}
      >
        <Wifi className="size-3" aria-hidden />
        Live
      </span>
    );
  }

  return (
    <div
      className={cn(
        "rounded-sm border border-rule bg-copy p-3 shadow-panel sm:p-4",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <DataSourceNotice variant="inline" />
        <p className="mono min-w-0 flex-1 truncate text-xs text-ink-faint">
          {apiBaseUrl}
        </p>
        <p className="text-xs text-ink-soft">
          Signed in as <span className="font-medium text-ink">{user.name}</span>
        </p>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
        Every record on screen is read from the shop database. These parts of the
        system have no API endpoint yet, so their screens stay empty until one
        ships:
      </p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {PENDING_CONTEXTS.map((line) => (
          <li key={line} className="flex gap-2 text-xs text-ink-soft">
            <span
              className="mt-1.5 size-1 shrink-0 rounded-sm bg-rule-strong"
              aria-hidden
            />
            <span className="leading-relaxed">{line}</span>
          </li>
        ))}
      </ul>

      {warnings.length ? (
        <ul className="mt-3 space-y-1 border-t border-rule pt-2.5">
          {warnings.map((warning) => (
            <li
              key={warning}
              className="flex gap-2 text-xs leading-relaxed text-flag-ink"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
