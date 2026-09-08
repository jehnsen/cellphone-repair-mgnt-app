"use client";

import { MonitorOff } from "lucide-react";
import { PART_CATEGORY_LABEL } from "@/lib/diagnosis";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DevicePart } from "@/lib/types";

/**
 * The diagnosis as a labelled list, for a browser that cannot draw the scene.
 *
 * Not a placeholder — it is the same information, and on a stripped kiosk
 * browser or an old shop tablet it is the only version anyone will see. So it
 * carries the part names, their categories, and the plain-language blurbs,
 * rather than apologising for the missing canvas.
 *
 * `reason` is worth being honest about: "your browser cannot do this" and
 * "there are no parts configured" are different problems with different
 * fixes, and a technician who is told the wrong one goes looking in the wrong
 * place.
 */
export function PartsFallbackList({
  parts,
  highlightedPartKeys,
  reason,
  className,
}: {
  parts: DevicePart[];
  highlightedPartKeys: string[];
  reason: "no-webgl" | "no-parts";
  className?: string;
}) {
  if (reason === "no-parts") {
    return (
      <div
        className={cn(
          "rounded-sm border border-rule bg-secondary/40 px-3 py-3",
          className,
        )}
      >
        <p className="text-sm font-medium text-ink">
          No parts are configured yet.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          The phone diagram is built from the parts catalog, and it is empty.
          An owner can seed it from Settings, or run the device-parts seeder on
          the API.
        </p>
      </div>
    );
  }

  const highlighted = new Set(highlightedPartKeys);
  /* Implicated parts first. On a text-only device there is no highlight to
     look at, so ordering is the only emphasis available. */
  const ordered = [
    ...parts.filter((part) => highlighted.has(part.key)),
    ...parts.filter((part) => !highlighted.has(part.key)),
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-2 rounded-sm border border-rule bg-secondary/40 px-2.5 py-2">
        <MonitorOff className="mt-0.5 size-3.5 shrink-0 text-ink-faint" aria-hidden />
        <p className="text-xs leading-relaxed text-ink-soft">
          This browser cannot show the 3D view, so the parts are listed
          instead. The diagnosis is the same either way.
        </p>
      </div>

      <ul className="divide-y divide-rule rounded-sm border border-rule">
        {ordered.map((part) => {
          const isImplicated = highlighted.has(part.key);

          return (
            <li
              key={part.key}
              className={cn(
                "px-2.5 py-2",
                isImplicated && "bg-stamp-fill",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    isImplicated ? "text-stamp-ink" : "text-ink",
                  )}
                >
                  {part.label}
                </span>
                {isImplicated ? (
                  <Badge variant="stamp">This is the problem</Badge>
                ) : null}
                <Badge variant="outline" className="ml-auto">
                  {PART_CATEGORY_LABEL[part.category]}
                </Badge>
              </div>

              {part.blurb ? (
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  {part.blurb}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
