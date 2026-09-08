"use client";

import { Label } from "@/components/ui/label";
import { PART_CATEGORIES, PART_CATEGORY_LABEL } from "@/lib/diagnosis";
import { cn } from "@/lib/utils";
import type { DevicePart, PartCategory } from "@/lib/types";

/**
 * The take-apart slider, on its own so both modes can use it.
 *
 * Opening the device up is not a training-only gesture: pointing at a battery
 * is a great deal more convincing with the back off, and a technician
 * explaining a fault at the counter reaches for exactly the same control as
 * one walking someone through a teardown. The difference between the modes is
 * what is *recorded*, not how far the phone can be opened.
 *
 * `id` is a prop because both modes can be mounted in the same document and a
 * duplicate id would point the label at the wrong input.
 */
export function ExplodeSlider({
  explode,
  onExplode,
  id = "explode-slider",
}: {
  explode: number;
  onExplode: (value: number) => void;
  id?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>Take apart</Label>
        <span className="font-mono text-xs tabular-nums text-ink-faint">
          {Math.round(explode * 100)}%
        </span>
      </div>
      {/* A native range input: it is keyboard-operable, it has a large
          touch target on a tablet without any work, and it is one of the
          few controls the shop's older browsers all agree on. */}
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(explode * 100)}
        onChange={(event) => onExplode(Number(event.target.value) / 100)}
        className="mt-2 h-6 w-full cursor-pointer accent-bench"
      />
    </div>
  );
}

/**
 * The category filter and part reader — explore mode only.
 *
 * This is the training and walk-through half of the tool: no diagnosis is
 * being recorded, so nothing here writes anything. It exists so a technician
 * can show a customer the whole device, or show a newer tech where things
 * physically are.
 *
 * The filter and the tapped-part reader stay explore-only deliberately.
 * Diagnosis mode does not let anyone poke the model — a stray tap while
 * turning the tablet toward a customer must not change what is on screen —
 * so a reader that could never fill in has no business being there.
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
      <ExplodeSlider explode={explode} onExplode={onExplode} />

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
