"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Color } from "three";
import type { Mesh, MeshPhysicalMaterial } from "three";
import { SCENE_SCALE } from "@/lib/diagnosis";
import { cylinderAxis, finishFor } from "@/components/diagnosis/part-materials";
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
 *
 * Shape and finish come from `part-materials.ts`, derived from the row's
 * category and key. A part is not a cube: a hard-edged box under even light
 * reads as a placeholder no matter how correct its dimensions are, and a
 * customer being shown their own phone notices that before they notice which
 * piece is red. Rounding the corners and giving each material its own
 * roughness is most of the difference, and it costs nothing at the seam —
 * the catalog is untouched.
 */

/** Fraction of the remaining distance closed each frame at 60fps. */
const EASE = 0.12;

/** Segments around a rounded corner. Four is smooth at the size a part is
 *  actually seen at, and keeps the whole rig well inside a shop tablet's
 *  budget — fifteen parts at the drei default would be a needless tenfold in
 *  triangles for a difference nobody can see at this scale. */
const ROUND_SEGMENTS = 4;

/** Sides on a lens barrel. Enough to read as round at frame distance. */
const RADIAL_SEGMENTS = 24;

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
  const group = useRef<Mesh>(null);
  const material = useRef<MeshPhysicalMaterial>(null);

  const finish = useMemo(() => finishFor(part), [part]);

  const size = useMemo(
    () =>
      [
        part.size.x * SCENE_SCALE,
        part.size.y * SCENE_SCALE,
        part.size.z * SCENE_SCALE,
      ] as [number, number, number],
    [part.size.x, part.size.y, part.size.z],
  );

  /* Radius is a fraction of the *thinnest* dimension, never a fixed number:
     a 2mm-thick flex cable and a 7mm battery both have to keep their corner
     inside their own body, and RoundedBox renders inside-out if the radius
     exceeds half the smallest side. */
  const radius = useMemo(
    () => Math.min(...size) * finish.round * 0.98,
    [size, finish.round],
  );

  /* Parsed once per colour rather than every frame — `new Color()` inside the
     render loop is sixty allocations a second per part. The finish's tint
     rides on top of the category tone the model already resolved, so glass
     sits a shade above the ramp and a lens a shade below without either
     leaving it. */
  const targetColor = useMemo(() => {
    const color = new Color(visual.color);
    /* Only the neutral graphite is tinted. The fault colour is `--stamp` and
       must arrive on screen as exactly itself — a material that lightens the
       one meaningful colour in the scene is a bug, not a finish. */
    if (visual.emphasis < 0.5) color.multiplyScalar(finish.tint);
    return color;
  }, [visual.color, visual.emphasis, finish.tint]);

  const targetEmissive = useMemo(
    () => new Color(visual.emissive),
    [visual.emissive],
  );

  useFrame((_, delta) => {
    /* Frame-rate independent easing: a 30fps tablet and a 120Hz desktop
       should take the same wall-clock time to settle, or the animation reads
       as sluggish on exactly the hardware the shop owns. */
    const t = 1 - Math.pow(1 - EASE, delta * 60);

    if (group.current) {
      group.current.position.x +=
        (visual.offset[0] * SCENE_SCALE - group.current.position.x) * t;
      group.current.position.y +=
        (visual.offset[1] * SCENE_SCALE - group.current.position.y) * t;
      group.current.position.z +=
        (visual.offset[2] * SCENE_SCALE - group.current.position.z) * t;
    }

    if (material.current) {
      material.current.opacity +=
        (visual.opacity - material.current.opacity) * t;
      material.current.color.lerp(targetColor, t);
      material.current.emissive.lerp(targetEmissive, t);
      material.current.emissiveIntensity +=
        (visual.emissiveIntensity - material.current.emissiveIntensity) * t;
      /* Depth write follows the eased opacity, not the target: flipping it on
         the frame the animation *starts* makes a part that is on its way to
         being ghosted briefly occlude the one it is uncovering. */
      material.current.depthWrite = material.current.opacity > 0.85;
    }
  });

  const position: [number, number, number] = [
    part.position.x * SCENE_SCALE,
    part.position.y * SCENE_SCALE,
    part.position.z * SCENE_SCALE,
  ];

  /* Touch and mouse both arrive as pointer events, so the tap target is the
     mesh itself — there is no hover-only affordance anywhere in the scene
     (see the acceptance notes on tablet use). */
  const onPointerDown = (event: { stopPropagation: () => void }) => {
    if (!interactive) return;
    event.stopPropagation();
    onSelect(part.key);
  };

  const surface = (
    <meshPhysicalMaterial
      ref={material}
      color={visual.color}
      emissive={visual.emissive}
      emissiveIntensity={visual.emissiveIntensity}
      transparent
      opacity={visual.opacity}
      roughness={finish.roughness}
      metalness={finish.metalness}
      clearcoat={finish.clearcoat}
      clearcoatRoughness={finish.clearcoatRoughness}
      /* A dimmed part must not occlude the highlighted one behind it, which
         is the whole trick that lets a battery show through the chassis.
         Writing depth only when nearly solid keeps the assembled view
         looking like a real object. */
      depthWrite={visual.opacity > 0.85}
      polygonOffset
      polygonOffsetFactor={-part.sortOrder * 0.01}
    />
  );

  const bezel =
    visual.emphasis > 0.5 ? (
      /* The bezel around the implicated part. Drawn as its own wireframe box
         rather than an outline pass: it survives the transparency of
         everything around it, and it costs one draw call. Kept a plain box
         even when the part is rounded — it is a marker, not a copy of the
         part, and a wireframe that follows every bevel reads as noise. */
      <mesh scale={1.06} raycast={() => null}>
        <boxGeometry args={size} />
        <meshBasicMaterial
          color={palette.fault}
          wireframe
          transparent
          opacity={0.75}
        />
      </mesh>
    ) : null;

  if (finish.shape === "cylinder") {
    const axis = cylinderAxis(part);
    /* The cylinder is born up the Y axis; lay it down along whichever axis the
       part is thinnest through, which is the way a disc faces. */
    const rotation: [number, number, number] =
      axis === "z"
        ? [Math.PI / 2, 0, 0]
        : axis === "x"
          ? [0, 0, Math.PI / 2]
          : [0, 0, 0];

    /* Radius from the two dimensions it is *not* thin through, so an oval
       speaker slot stays the size of its slot. */
    const [rx, ry, depth] =
      axis === "z"
        ? [size[0], size[1], size[2]]
        : axis === "x"
          ? [size[2], size[1], size[0]]
          : [size[0], size[2], size[1]];

    return (
      <mesh
        ref={group}
        position={position}
        rotation={rotation}
        onPointerDown={onPointerDown}
        /* Squashed to the part's real footprint, so a non-circular slot is an
           ellipse rather than being forced round. */
        scale={[1, 1, ry / Math.max(rx, 1e-6)]}
      >
        <cylinderGeometry
          args={[rx / 2, rx / 2, depth, RADIAL_SEGMENTS]}
        />
        {surface}
        {bezel}
      </mesh>
    );
  }

  return (
    <RoundedBox
      ref={group}
      position={position}
      args={size}
      radius={radius}
      smoothness={ROUND_SEGMENTS}
      onPointerDown={onPointerDown}
    >
      {surface}
      {bezel}
    </RoundedBox>
  );
}
