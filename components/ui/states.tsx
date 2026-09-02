"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The three states every list screen owes the user, as components rather than
 * as ad-hoc markup — so "no results" never renders as a shrug.
 */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: LucideIcon;
  /** What is not here. */
  title: string;
  /** What to do next. Never "No data found". */
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-12 text-center", className)}>
      {Icon ? (
        <Icon className="mx-auto mb-3 size-6 text-ink-faint" aria-hidden />
      ) : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-ink-soft">
        {body}
      </p>
      {action ? <div className="mt-4 flex justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: Error;
  onRetry?: () => void;
  className?: string;
}) {
  const hint =
    (error as { hint?: string }).hint ??
    "Try again. If it keeps failing, reload the page.";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-sm border border-stamp bg-stamp-fill px-3 py-3 sm:px-4",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-stamp-ink" aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-stamp-ink">{error.message}</p>
        <p className="mt-0.5 leading-relaxed text-ink-soft">{hint}</p>
        {onRetry ? (
          <Button variant="outline" size="xs" className="mt-2.5" onClick={onRetry}>
            <RefreshCw aria-hidden /> Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Skeleton rows shaped like the rows they stand in for, strip included. */
export function LoadingRows({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <ul
      aria-busy="true"
      aria-live="polite"
      className={cn("divide-y divide-rule-soft", className)}
    >
      <li className="sr-only">Loading</li>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex items-stretch gap-3">
          <span className="w-[3px] shrink-0 bg-secondary" aria-hidden />
          <span className="flex flex-1 animate-pulse items-center gap-3 py-3 pr-3">
            <span className="h-3 w-28 rounded-sm bg-secondary" />
            <span className="hidden h-3 w-40 rounded-sm bg-secondary sm:block" />
            <span className="ml-auto h-3 w-16 rounded-sm bg-secondary" />
          </span>
        </li>
      ))}
    </ul>
  );
}
