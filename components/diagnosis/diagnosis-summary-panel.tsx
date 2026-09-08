"use client";

import { CircleAlert, Crosshair } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PART_CATEGORY_LABEL, labelForIssue } from "@/lib/diagnosis";
import { cn } from "@/lib/utils";
import type { DevicePart, IssueCatalog, IssueSource } from "@/lib/types";

/**
 * What the current selection amounts to, in words.
 *
 * This is the half of the tool that survives a browser with no WebGL, a
 * printed quote, and a customer who would rather read than be shown — so it
 * carries the whole diagnosis on its own and never assumes the canvas beside
 * it rendered. It is also what the technician reads out loud.
 */
export function DiagnosisSummaryPanel({
  catalog,
  source,
  selectedIssueKeys,
  implicatedParts,
  customNote,
  className,
}: {
  catalog: IssueCatalog;
  source: IssueSource;
  selectedIssueKeys: string[];
  implicatedParts: DevicePart[];
  customNote?: string;
  className?: string;
}) {
  const nothingSelected = selectedIssueKeys.length === 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="label-pad mb-1.5">Issue</p>
        {nothingSelected ? (
          <p className="text-sm text-ink-faint">
            Nothing selected yet — pick what is wrong and the part will be
            highlighted.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {selectedIssueKeys.map((key) => (
              <Badge key={key} variant="tint">
                {labelForIssue(catalog, source, key)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="label-pad mb-1.5">
          {implicatedParts.length === 1 ? "Part involved" : "Parts involved"}
        </p>

        {implicatedParts.length ? (
          <ul className="space-y-2">
            {implicatedParts.map((part, index) => (
              <li
                key={part.key}
                className="rounded-sm border border-rule bg-secondary/40 px-2.5 py-2"
              >
                <div className="flex items-center gap-2">
                  {/* The first part is the one the mapping ranks first — what
                      the technician means, and what the camera framed. Saying
                      so stops a three-part answer reading as three faults. */}
                  {index === 0 ? (
                    <Crosshair
                      className="size-3.5 shrink-0 text-stamp-ink"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="size-1.5 shrink-0 bg-ink-faint"
                      aria-hidden
                    />
                  )}
                  <span className="text-sm font-medium text-ink">
                    {part.label}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {PART_CATEGORY_LABEL[part.category]}
                  </Badge>
                </div>

                {part.blurb ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                    {part.blurb}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : nothingSelected ? null : (
          <div className="flex items-start gap-2 rounded-sm border border-flag/40 bg-flag-fill px-2.5 py-2">
            <CircleAlert
              className="mt-0.5 size-3.5 shrink-0 text-flag-ink"
              aria-hidden
            />
            <p className="text-xs leading-relaxed text-flag-ink">
              None of the selected issues map to a specific part, so there is
              nothing to point at. The note below is what the customer will be
              told.
            </p>
          </div>
        )}
      </div>

      {implicatedParts.length > 1 ? (
        <p className="text-xs leading-relaxed text-ink-faint">
          More than one part can cause this. The first is the most likely; the
          others are what gets checked if it is not.
        </p>
      ) : null}

      {customNote?.trim() ? (
        <div>
          <p className="label-pad mb-1.5">Note</p>
          <p className="text-sm leading-relaxed text-ink">{customNote.trim()}</p>
        </div>
      ) : null}
    </div>
  );
}
