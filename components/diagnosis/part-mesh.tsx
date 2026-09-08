"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color } from "three";
import type { Mesh, MeshStandardMaterial } from "three";
import { SCENE_SCALE } from "@/lib/diagnosis";
import type { DevicePart } from "@/lib/types";
import type { ScenePalette } from "@/components/diagnosis/palette";

/**
 * One part of the rig.
 *
 * Every visual difference between "this is the problem" and "this is context"
 * is eased here rather than switched, because the panel is used mid-sentence
 * with a customer watching — a part that snaps to red draws the eye as a
 * glitch, one that warms into it reads as an answer.
 *
 * The easing runs on the render loop and writes straight to the material and
 * transform. Doing it in React state would re-render the whole scene sixty
 * times a second to move one box.
 */

/** Fraction of the remaining distance closed each frame at 60fps. */
const EASE = 0.12;

export interface PartVisual {
  /** Where the part sits, in millimetres, with explode already applied. */
  offset: [number, number, number];
  /** 0 context, 1 the thing being pointed at. */
  emphasis: number;
  opacity: number;
  color: string;
  emissive: string;
  emissiveIntensity: number;
}

export function PartMesh({
  part,
  visual,
  palette,
  interactive,
  onSelect,
}: {
  part: DevicePart;
  visual: PartVisual;
  palette: ScenePalette;
  interactive: boolean;
  onSelect: (key: string) => void;
}) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);

  /* Parsed once per colour rather than every frame — `new Color()` inside the
     render loop is sixty allocations a second per part. */
  const targetColor = useMemo(() => new Color(visual.color), [visual.color]);
  const targetEmissive = useMemo(
    () => new Color(visual.emissive),
    [visual.emissive],
  );

  useFrame((_, delta) => {
    /* Frame-rate independent easing: a 30fps tablet and a 120Hz desktop
       should take the same wall-clock time to settle, or the animation reads
       as sluggish on exactly the hardware the shop owns. */
    const t = 1 - Math.pow(1 - EASE, delta * 60);

    if (mesh.current) {
      mesh.current.position.x +=
        (visual.offset[0] * SCENE_SCALE - mesh.current.position.x) * t;
      mesh.current.position.y +=
        (visual.offset[1] * SCENE_SCALE - mesh.current.position.y) * t;
      mesh.current.position.z +=
        (visual.offset[2] * SCENE_SCALE - mesh.current.position.z) * t;
    }

    if (material.current) {
      material.current.opacity +=
        (visual.opacity - material.current.opacity) * t;
      material.current.color.lerp(targetColor, t);
      material.current.emissive.lerp(targetEmissive, t);
      material.current.emissiveIntensity +=
        (visual.emissiveIntensity - material.current.emissiveIntensity) * t;
    }
  });

  return (
    <mesh
      ref={mesh}
      position={[
        part.position.x * SCENE_SCALE,
        part.position.y * SCENE_SCALE,
        part.position.z * SCENE_SCALE,
      ]}
      /* Touch and mouse both arrive as pointer events, so the tap target is
         the mesh itself — there is no hover-only affordance anywhere in the
         scene (see the acceptance notes on tablet use). */
      onPointerDown={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        onSelect(part.key);
      }}
    >
      <boxGeometry
        args={[
          part.size.x * SCENE_SCALE,
          part.size.y * SCENE_SCALE,
          part.size.z * SCENE_SCALE,
        ]}
      />
      <meshStandardMaterial
        ref={material}
        color={visual.color}
        emissive={visual.emissive}
        emissiveIntensity={visual.emissiveIntensity}
        transparent
        opacity={visual.opacity}
        roughness={0.55}
        metalness={0.15}
        /* A dimmed part must not occlude the highlighted one behind it, which
           is the whole trick that lets a battery show through the chassis.
           Writing depth only when nearly solid keeps the assembled view
           looking like a real object. */
        depthWrite={visual.opacity > 0.85}
        polygonOffset
        polygonOffsetFactor={-part.sortOrder * 0.01}
      />
      {visual.emphasis > 0.5 ? (
        /* The bezel around the implicated part. Drawn as its own wireframe
           box rather than an outline pass: it survives the transparency of
           everything around it, and it costs one draw call. */
        <mesh scale={1.06}>
          <boxGeometry
            args={[
              part.size.x * SCENE_SCALE,
              part.size.y * SCENE_SCALE,
              part.size.z * SCENE_SCALE,
            ]}
          />
          <meshBasicMaterial
            color={palette.fault}
            wireframe
            transparent
            opacity={0.75}
          />
        </mesh>
      ) : null}
    </mesh>
  );
}
