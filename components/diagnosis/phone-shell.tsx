"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { Mesh, MeshPhysicalMaterial } from "three";
import { SCENE_SCALE } from "@/lib/diagnosis";
import type { ScenePalette } from "@/components/diagnosis/palette";

/**
 * The handset's outline: a mid-frame, a screen bezel, a camera plateau, and
 * the side buttons.
 *
 * None of this is in the parts catalog, and that is the point. Every mesh here
 * is cosmetic — it cannot be selected, cannot be highlighted, and never appears
 * in the parts list or a diagnosis. It exists because the catalog describes a
 * device as a stack of functional plates, and a stack of plates does not look
 * like a phone: without an edge running round them the assembled view reads as
 * loose panels floating in register, which is exactly the complaint that got
 * this written.
 *
 * The rule it must not break: nothing here may ever imply a fault. So the
 * shell carries no hue of its own, never takes `--stamp`, and fades out of the
 * way the moment a part is being isolated — the frame is context, and context
 * must not compete with the one thing being pointed at.
 *
 * Dimensions follow the nominal 150 x 72 x 8 mm slab the catalog is authored
 * against (see `DevicePartSeeder`). It is deliberately *one* generic handset,
 * matching the rig — no SKU is modelled here either.
 */

/** The nominal device, in millimetres — the same slab the catalog assumes. */
const BODY = { x: 72, y: 150, z: 8 };

/** How much of the front face is screen rather than bezel, per side. */
const BEZEL = 2.6;

export function PhoneShell({
  palette,
  /** 0 assembled, 1 fully exploded — the shell opens out with the rig. */
  explode,
  /** True while a single part is being isolated, so the frame gets out of
   *  the way rather than boxing in the highlighted part. */
  isolating,
  visible,
}: {
  palette: ScenePalette;
  explode: number;
  isolating: boolean;
  visible: boolean;
}) {
  const frame = useRef<Mesh>(null);
  const frameMaterial = useRef<MeshPhysicalMaterial>(null);

  const size = useMemo(
    () =>
      [BODY.x * SCENE_SCALE, BODY.y * SCENE_SCALE, BODY.z * SCENE_SCALE] as [
        number,
        number,
        number,
      ],
    [],
  );

  /* The frame is the one element that has to survive being seen edge-on from
     every angle, so its corner radius is generous — a phone's profile is
     mostly corner. */
  const radius = Math.min(size[0], size[1]) * 0.075;

  /* The frame stands back whenever something else is the subject — a part
     being isolated, or the device being opened up. Taken as the lower of the
     two rather than a branch, because in diagnosis mode both can now be true
     at once: a highlighted battery in a half-open phone. */
  const target = visible
    ? Math.min(isolating ? 0.12 : 0.5, explode > 0.02 ? 0.22 : 0.5)
    : 0;

  useFrame((_, delta) => {
    const t = 1 - Math.pow(1 - 0.12, delta * 60);

    if (frameMaterial.current) {
      frameMaterial.current.opacity +=
        (target - frameMaterial.current.opacity) * t;
      /* Never writes depth. The shell wraps the entire rig, so a solid frame
         would occlude every part inside it — it is a silhouette, not a box. */
      frameMaterial.current.depthWrite = false;
    }

    if (frame.current) {
      /* Opens along Z with the teardown so the parts have somewhere to go,
         rather than staying clamped around an exploded rig. */
      const spread = 1 + explode * 0.6;
      frame.current.scale.z += (spread - frame.current.scale.z) * t;
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* The mid-frame: the band of metal around the edge of the device. */}
      <RoundedBox
        ref={frame}
        args={size}
        radius={radius}
        smoothness={4}
        /* Cosmetic geometry must never eat a pointer event meant for a real
           part underneath it. */
        raycast={() => null}
      >
        <meshPhysicalMaterial
          ref={frameMaterial}
          color={palette.neutral}
          transparent
          opacity={0}
          roughness={0.24}
          metalness={0.9}
          clearcoat={0.5}
          clearcoatRoughness={0.2}
          depthWrite={false}
        />
      </RoundedBox>

      {/* The screen's black surround, which is what actually reads as "phone"
          — a bezel is the shape the eye recognises. Sits a hair proud of the
          front face so it is never z-fighting the display part. */}
      <mesh
        position={[0, 0, (BODY.z / 2 + 0.15) * SCENE_SCALE]}
        raycast={() => null}
      >
        <planeGeometry
          args={[
            (BODY.x - BEZEL * 2) * SCENE_SCALE,
            (BODY.y - BEZEL * 2) * SCENE_SCALE,
          ]}
        />
        <meshPhysicalMaterial
          color="#05070d"
          transparent
          opacity={isolating ? 0.06 : 0.28}
          roughness={0.08}
          metalness={0.1}
          clearcoat={1}
          clearcoatRoughness={0.05}
          depthWrite={false}
        />
      </mesh>

      {/* The earpiece slot, and the front camera beside it. Tiny, and worth
          it: they are the two marks that tell you which way up a phone is. */}
      <mesh
        position={[0, (BODY.y / 2 - 7) * SCENE_SCALE, (BODY.z / 2 + 0.3) * SCENE_SCALE]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.9 * SCENE_SCALE, 0.9 * SCENE_SCALE, 0.6 * SCENE_SCALE, 16]} />
        <meshPhysicalMaterial
          color="#0b0f18"
          transparent
          opacity={isolating ? 0.1 : 0.55}
          roughness={0.5}
          metalness={0.5}
          depthWrite={false}
        />
      </mesh>

      {/* The side buttons — volume pair and the power key, on opposite
          edges, because a phone with a bare rim looks unfinished from the
          three-quarter angle this scene opens at. */}
      {[
        { y: 34, h: 16, x: -1 },
        { y: 12, h: 10, x: -1 },
        { y: 26, h: 20, x: 1 },
      ].map((button) => (
        <RoundedBox
          key={`${button.x}-${button.y}`}
          args={[1.6 * SCENE_SCALE, button.h * SCENE_SCALE, 3.4 * SCENE_SCALE]}
          radius={0.5 * SCENE_SCALE}
          smoothness={3}
          position={[
            button.x * (BODY.x / 2 + 0.4) * SCENE_SCALE,
            button.y * SCENE_SCALE,
            0,
          ]}
          raycast={() => null}
        >
          <meshPhysicalMaterial
            color={palette.neutral}
            transparent
            opacity={isolating ? 0.1 : 0.7}
            roughness={0.3}
            metalness={0.85}
            clearcoat={0.4}
            depthWrite={false}
          />
        </RoundedBox>
      ))}
    </group>
  );
}
