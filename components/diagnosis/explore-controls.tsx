"use client";

import { Label } from "@/components/ui/label";
import { PART_CATEGORIES, PART_CATEGORY_LABEL } from "@/lib/diagnosis";
import { cn } from "@/lib/utils";
import type { DevicePart, PartCategory } from "@/lib/types";

/**
 * The explode slider and category filter — explore mode only.
 *
 * This is the training and walk-through half of the tool: no diagnosis is
 * being recorded, so nothing here writes anything. It exists so a technician
 * can show a customer the whole device, or show a newer tech where things
 * physically are.
 */
export function ExploreControls({
  explode,
  categoryFilter,
  inspectedPart,
  onExplode,
  onCategory,
}: {
  explode: number;
  categoryFilter: PartCategory | "all";
  inspectedPart: DevicePart | null;
  onExplode: (value: number) => void;
  onCategory: (value: PartCategory | "all") => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="explode-slider">Take apart</Label>
          <span className="font-mono text-xs tabular-nums text-ink-faint">
            {Math.round(explode * 100)}%
          </span>
        </div>
        {/* A native range input: it is keyboard-operable, it has a large
            touch target on a tablet without any work, and it is one of the
            few controls the shop's older browsers all agree on. */}
        <input
          id="explode-slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(explode * 100)}
          onChange={(event) => onExplode(Number(event.target.value) / 100)}
          className="mt-2 h-6 w-full cursor-pointer accent-bench"
        />
      </div>

      <div>
        <p className="label-pad mb-1.5">Show only</p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Everything"
            active={categoryFilter === "all"}
            onClick={() => onCategory("all")}
          />
          {PART_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              label={PART_CATEGORY_LABEL[category]}
              active={categoryFilter === category}
              onClick={() => onCategory(category)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-sm border border-rule bg-secondary/40 px-2.5 py-2">
        <p className="label-pad mb-1">Tapped part</p>
        {inspectedPart ? (
          <>
            <p className="text-sm font-medium text-ink">
              {inspectedPart.label}
            </p>
            {inspectedPart.blurb ? (
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                {inspectedPart.blurb}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-ink-soft">
            Tap any part of the phone to read what it does.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-sm border px-2.5 text-xs font-medium transition-colors",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-bench/45 bg-bench-fill text-bench-ink"
          : "border-rule bg-copy text-ink-soft hover:border-bench/35 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
