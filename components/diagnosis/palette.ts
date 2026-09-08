"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import type { PartCategory } from "@/lib/types";

/**
 * The scene's colours, read from the app's own tokens rather than picked.
 *
 * `app/globals.css` is the source of truth for every colour in this app, and a
 * 3D canvas is no exception — hardcoding hex here would mean the visualizer is
 * the one surface that does not follow a token change, and it would invert
 * wrongly in dark mode. So the values are read off the document at mount and
 * again whenever the theme resolves differently.
 *
 * Three rules from the design system apply directly:
 *
 * - `--surge` (cyan) is brand, never status, so it is absent here.
 * - `--go` (green) is transient feedback, never a surface — also absent.
 * - Colour is spent on urgency, not status. So the parts themselves carry no
 *   hue at all: they are a neutral graphite ramp, and the only coloured thing
 *   in the scene is the part that is actually wrong. Category is conveyed by
 *   the filter dimming non-matching parts, not by tinting them.
 */

export interface ScenePalette {
  /** The implicated part — `--stamp`, which reads as fault everywhere else. */
  fault: string;
  /** A part the technician tapped to read about — `--bench`, the primary. */
  inspect: string;
  /** Base graphite for parts, lightest at the front of the device. */
  neutral: string;
  /** What a dimmed, out-of-focus part fades toward. */
  muted: string;
  background: string;
}

const FALLBACK: ScenePalette = {
  fault: "#e11d48",
  inspect: "#4f46e5",
  neutral: "#99a3bd",
  muted: "#626d8a",
  background: "#f2f4fa",
};

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
  const value = styles.getPropertyValue(name).trim();
  /* Tokens are plain hex in globals.css. Anything else (a color-mix(), an
     unresolved var) is not something THREE.Color can parse, so it is left to
     the fallback rather than throwing inside the render loop. */
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

export function useScenePalette(): ScenePalette {
  const { resolvedTheme } = useTheme();
  const [palette, setPalette] = useState<ScenePalette>(FALLBACK);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);

    setPalette({
      fault: readToken(styles, "--stamp", FALLBACK.fault),
      inspect: readToken(styles, "--bench", FALLBACK.inspect),
      /* `--ink-soft`, not `--ink-faint`. A token sized to be legible as *text*
         on the page background comes out far too dark once it is a lit
         surface being multiplied by the tone ramp — at `--ink-faint` the
         exploded rig was barely separable from the canvas. */
      neutral: readToken(styles, "--ink-soft", FALLBACK.neutral),
      muted: readToken(styles, "--ink-faint", FALLBACK.muted),
      background: readToken(styles, "--copy", FALLBACK.background),
    });
  }, [resolvedTheme]);

  return palette;
}

/**
 * How light a part's graphite is, by category.
 *
 * A value ramp, not a hue ramp — see the note above. It exists so the exploded
 * view is readable: fifteen boxes in one identical grey is a pile, and the
 * technician needs to tell the board from the battery at a glance while
 * talking.
 */
/*
 * The ramp bottoms out at 0.8 rather than going darker. The first pass ran
 * down to 0.62, which looked right as a set of numbers and came out wrong on
 * screen: against the dark theme's near-black canvas the bottom of the ramp
 * was indistinguishable from the background, so the exploded view lost half
 * its parts. A narrow ramp that stays legible beats a wide one whose dark end
 * disappears.
 */
export const CATEGORY_TONE: Record<PartCategory, number> = {
  display: 1.3,
  structural: 1.15,
  connectivity: 1.05,
  power: 0.98,
  audio: 0.92,
  board: 0.86,
  camera: 0.8,
};
