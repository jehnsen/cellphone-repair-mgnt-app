"use client";

import { useMemo } from "react";
import { Color } from "three";
import { PartMesh, type PartVisual } from "@/components/diagnosis/part-mesh";
import { PhoneShell } from "@/components/diagnosis/phone-shell";
import { CATEGORY_TONE, type ScenePalette } from "@/components/diagnosis/palette";
import { ISOLATION_LIFT } from "@/lib/diagnosis";
import type { DevicePart, PartCategory } from "@/lib/types";
import type { DiagnosisMode } from "@/components/diagnosis/use-diagnosis-state";

/**
 * The rig: every part positioned, exploded, and shaded for the current mode.
 *
 * All the "what should this look like" reasoning lives here so `PartMesh` only
 * has to ease toward whatever it is handed. That split matters because the
 * rules differ sharply between the two modes, and mixing them into the mesh
 * would make both hard to follow.
 */

function toneOf(base: string, category: PartCategory): string {
  /* Multiplying in linear RGB darkens without shifting hue, which is what
     keeps the ramp reading as one material at different depths rather than as
     seven different plastics. */
  const color = new Color(base);
  color.multiplyScalar(CATEGORY_TONE[category]);
  return `#${color.getHexString()}`;
}

export function PhoneModel({
  parts,
  mode,
  explode,
  highlightedPartKeys,
  inspectedPartKey,
  categoryFilter,
  palette,
  onSelectPart,
}: {
  parts: DevicePart[];
  mode: DiagnosisMode;
  explode: number;
  highlightedPartKeys: string[];
  inspectedPartKey: string | null;
  categoryFilter: PartCategory | "all";
  palette: ScenePalette;
  onSelectPart: (key: string) => void;
}) {
  /* Nothing selected is not the same as everything dimmed. With no diagnosis
     yet the device should just look like a device — dimming the whole rig
     would read as "all of it is broken". Lifted out of the memo below because
     the cosmetic shell needs it too: the frame has to stand back when a single
     part is being pointed at. */
  const isolating =
    mode === "diagnosis" && highlightedPartKeys.length > 0;

  const visuals = useMemo(() => {
    const highlighted = new Set(highlightedPartKeys);

    return new Map<string, PartVisual>(
      parts.map((part) => {
        const isHighlighted = highlighted.has(part.key);
        const isInspected = part.key === inspectedPartKey;
        const inFilter =
          categoryFilter === "all" || part.category === categoryFilter;

        /* Explore pulls everything apart along its own vector. Diagnosis lifts
           the implicated part just clear of the chassis so it is visibly a
           separate object — and, once the technician reaches for the slider,
           opens the rest of the device up around it.

           The two are blended rather than added. Adding them sends the
           highlighted part further out than anything else at full extension,
           which breaks the one thing the exploded view is for: showing where
           the part sits *in the stack*. Taking the larger of the two keeps the
           lift meaningful while the device is nearly shut, and lets the real
           explode distance take over as it opens — so the part never overshoots
           its own place in the teardown. */
        const travel =
          mode === "explore"
            ? explode * part.explode.distance
            : Math.max(
                explode,
                isHighlighted ? ISOLATION_LIFT : 0,
              ) * part.explode.distance;

        const offset: [number, number, number] = [
          part.position.x + part.explode.x * travel,
          part.position.y + part.explode.y * travel,
          part.position.z + part.explode.z * travel,
        ];

        const neutral = toneOf(palette.neutral, part.category);

        if (mode === "diagnosis") {
          return [
            part.key,
            {
              offset,
              emphasis: isHighlighted ? 1 : 0,
              /* The gap between these two numbers is the whole effect: the
                 implicated part is solid and everything else is barely there,
                 rather than "slightly dimmer". Anything gentler and a customer
                 cannot tell which one is being pointed at.

                 The floor is not lower than this because the ghosted parts are
                 still doing a job — they are the outline of the phone, and a
                 highlighted battery floating in empty space is not obviously a
                 battery. Against the dark theme, below about 0.15 the body
                 disappears entirely. */
              opacity: isolating ? (isHighlighted ? 1 : 0.17) : 0.92,
              color: isHighlighted ? palette.fault : neutral,
              emissive: isHighlighted ? palette.fault : "#000000",
              emissiveIntensity: isHighlighted ? 0.42 : 0,
            } satisfies PartVisual,
          ];
        }

        return [
          part.key,
          {
            offset,
            emphasis: 0,
            opacity: inFilter ? (isInspected ? 1 : 0.94) : 0.07,
            color: isInspected ? palette.inspect : neutral,
            emissive: isInspected ? palette.inspect : "#000000",
            emissiveIntensity: isInspected ? 0.3 : 0,
          } satisfies PartVisual,
        ];
      }),
    );
  }, [
    parts,
    mode,
    explode,
    highlightedPartKeys,
    inspectedPartKey,
    categoryFilter,
    palette,
  ]);

  return (
    <group>
      {/* Cosmetic only — never selectable, never highlighted, never in the
          parts list. It is the outline that makes the catalog's stack of
          plates read as a handset. */}
      <PhoneShell
        palette={palette}
        explode={explode}
        isolating={isolating}
        visible={parts.length > 0}
      />

      {parts.map((part) => (
        <PartMesh
          key={part.key}
          part={part}
          visual={visuals.get(part.key)!}
          palette={palette}
          /* Diagnosis mode is driven from the issue picker, not by poking the
             model — a stray tap while turning the tablet toward a customer
             must not change what is being shown. */
          interactive={mode === "explore"}
          onSelect={onSelectPart}
        />
      ))}
    </group>
  );
}
