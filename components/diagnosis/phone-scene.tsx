"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { TOUCH, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PhoneModel } from "@/components/diagnosis/phone-model";
import { useScenePalette } from "@/components/diagnosis/palette";
import { DEFAULT_CAMERA, SCENE_SCALE } from "@/lib/diagnosis";
import type { CameraState, DevicePart, PartCategory } from "@/lib/types";
import type { DiagnosisMode } from "@/components/diagnosis/use-diagnosis-state";

/**
 * The canvas: lighting, camera, orbit, and the rig inside it.
 *
 * Two things here are counter-specific rather than 3D-specific:
 *
 * - The camera returns to a fixed framing whenever the diagnosis changes. This
 *   is used with a customer watching over a technician's shoulder, and nobody
 *   should have to sit through someone hunting for the right angle. Orbit
 *   still works — it is just not the first thing that has to happen.
 * - `preserveDrawingBuffer` is on, because a snapshot is taken from the canvas
 *   after the fact. Without it `toBlob` returns an empty image on most
 *   drivers, and it fails silently.
 */

export interface PhoneSceneHandle {
  /** The rendered canvas as a PNG, for the snapshot endpoint. */
  capture: () => Promise<Blob | null>;
  /** Where the camera is now, so a snapshot can be reproduced. */
  cameraState: () => CameraState | undefined;
  /** Put the camera back at the framing for the current diagnosis. */
  reframe: () => void;
}

/**
 * How far back the camera sits when framing a part, in world units.
 *
 * Sized to keep the *whole phone* in shot, not to fill the frame with the
 * part. Filling the frame was the first thing tried and it was wrong: a
 * customer shown a large red rectangle has been shown a large red rectangle,
 * not their battery. The part only means something in the outline of the
 * device around it. The rig is 3 units tall, so at 38° this needs ~4.4 plus
 * margin.
 */
const FRAME_DISTANCE = 6.3;

/**
 * How far the camera's aim slides from the centre of the device toward the
 * part. Enough to put the part off-centre and clearly the subject, not so far
 * that the phone leaves the shot.
 *
 * Kept low for a reason found by looking at a saved snapshot: at 0.45 an
 * edge part like the charging port flex (66mm down the body) pulled the aim
 * far enough that the top third of the phone was cropped out of frame. A
 * picture of a highlighted part with the device cut off is exactly the thing
 * this tool exists to avoid, and it is worse on a stored snapshot than on
 * screen, because nobody can orbit a snapshot.
 */
const FRAME_BIAS = 0.24;

/**
 * Explore pulls further back than diagnosis, because it has to.
 *
 * Fully exploded, the rig spans roughly twice the assembled device: the back
 * cover travels 48mm one way and the front glass 46mm the other, and the side
 * buttons go 32mm out on each edge. Framed for the assembled phone, a
 * teardown simply falls out of shot.
 */
const EXPLORE_DISTANCE = 8.6;

function framingFor(
  part: DevicePart | null,
  mode: DiagnosisMode,
  explode: number,
): {
  position: Vector3;
  target: Vector3;
} {
  if (mode === "explore") {
    /* Always the whole rig, centred — in explore there is no single subject,
       the point is the arrangement. */
    const direction = new Vector3(...DEFAULT_CAMERA).normalize();
    return {
      position: direction.multiplyScalar(EXPLORE_DISTANCE),
      target: new Vector3(0, 0, 0),
    };
  }

  /* Diagnosis can now open the device up too, and a rig framed for an
     assembled phone spills straight out of shot as it does. So the distance
     eases from the diagnosis framing toward the explore one as the slider
     moves — the same reason EXPLORE_DISTANCE exists, applied continuously
     rather than as a mode switch. */
  const distance =
    FRAME_DISTANCE + (EXPLORE_DISTANCE - FRAME_DISTANCE) * explode;

  if (!part) {
    const direction = new Vector3(...DEFAULT_CAMERA);
    return {
      /* Only pulls back once the device is actually opening; at rest this is
         exactly the DEFAULT_CAMERA framing it has always been. */
      position: direction
        .clone()
        .normalize()
        .multiplyScalar(direction.length() + (distance - FRAME_DISTANCE)),
      target: new Vector3(0, 0, 0),
    };
  }

  const target = new Vector3(
    part.position.x * SCENE_SCALE * FRAME_BIAS,
    part.position.y * SCENE_SCALE * FRAME_BIAS,
    part.position.z * SCENE_SCALE * FRAME_BIAS,
  );

  /* Approach from the side the part faces, so a battery (which explodes
     backwards) is looked at from behind rather than through the screen. The
     default three-quarter offset is kept so the shot still has depth. */
  const facing = new Vector3(
    part.explode.x || 0.55,
    part.explode.y * 0.35 + 0.42,
    part.explode.z || 1,
  ).normalize();

  return {
    position: target.clone().add(facing.multiplyScalar(distance)),
    target,
  };
}

/**
 * Eases the camera toward the current framing, and stops the moment the user
 * touches the controls — a camera that keeps pulling against a technician's
 * finger is worse than one that never moves on its own.
 */
function CameraRig({
  focusPart,
  mode,
  explode,
  controls,
  requestId,
}: {
  focusPart: DevicePart | null;
  mode: DiagnosisMode;
  explode: number;
  controls: React.RefObject<OrbitControlsImpl | null>;
  requestId: number;
}) {
  const { camera } = useThree();
  const desired = useRef(framingFor(focusPart, mode, explode));
  const settling = useRef(false);

  /* Re-framing on a mode change is not a nicety: the two modes need very
     different distances, and keeping the diagnosis framing into explore
     leaves the exploded rig spilling off every edge. */
  useEffect(() => {
    desired.current = framingFor(focusPart, mode, explode);
    settling.current = true;
    /* `explode` deliberately absent: dragging the slider must not haul the
       camera back to the default angle on every tick. Its effect on distance
       is applied below, on the framing the user is already looking from. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPart, mode, requestId]);

  /* Distance follows the slider even after the technician has orbited away —
     the whole device still has to stay in shot as it opens — but it is applied
     as a nudge along their own view direction rather than by re-aiming, so it
     never fights a camera they have positioned themselves. */
  useEffect(() => {
    desired.current = framingFor(focusPart, mode, explode);
    if (settling.current) return;

    const orbit = controls.current;
    const target = orbit?.target ?? new Vector3(0, 0, 0);
    const wanted = desired.current.position.distanceTo(
      desired.current.target,
    );
    const direction = camera.position.clone().sub(target);
    if (direction.lengthSq() < 1e-6) return;

    camera.position.copy(target).add(direction.setLength(wanted));
    orbit?.update();
  }, [explode, focusPart, mode, camera, controls]);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;

    const yield_ = () => {
      settling.current = false;
    };

    orbit.addEventListener("start", yield_);
    return () => orbit.removeEventListener("start", yield_);
  }, [controls]);

  useFrame((_, delta) => {
    if (!settling.current) return;

    const t = 1 - Math.pow(1 - 0.1, delta * 60);
    camera.position.lerp(desired.current.position, t);

    const orbit = controls.current;
    if (orbit) {
      orbit.target.lerp(desired.current.target, t);
      orbit.update();
    }

    if (camera.position.distanceTo(desired.current.position) < 0.01) {
      settling.current = false;
    }
  });

  return null;
}

/** Hands the WebGL canvas and camera back out to the snapshot button. */
function SceneBridge({
  handle,
  controls,
  onReframe,
}: {
  handle: React.RefObject<PhoneSceneHandle | null>;
  controls: React.RefObject<OrbitControlsImpl | null>;
  onReframe: () => void;
}) {
  const { gl, camera, scene } = useThree();

  useImperativeHandle(
    handle,
    () => ({
      async capture() {
        /* Force a paint before reading the buffer. Even with
           preserveDrawingBuffer, capturing between frames can catch a cleared
           buffer on some drivers. */
        gl.render(scene, camera);

        return new Promise<Blob | null>((resolve) => {
          gl.domElement.toBlob((blob) => resolve(blob), "image/png");
        });
      },
      cameraState() {
        const target = controls.current?.target;
        return {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
          target: target
            ? { x: target.x, y: target.y, z: target.z }
            : undefined,
        };
      },
      reframe: onReframe,
    }),
    [gl, camera, scene, controls, onReframe],
  );

  return null;
}

/**
 * `handleRef` is an ordinary prop, not a forwarded ref, and that is
 * deliberate. This component is loaded through `next/dynamic`, and the wrapper
 * `dynamic()` returns does not forward refs — a `ref` handed to it silently
 * stays null, so the snapshot button had nothing to capture from and could
 * only report that the view had not loaded. Passing the ref object as a prop
 * sidesteps the whole question.
 */
export function PhoneScene({
  parts,
  mode,
  explode,
  highlightedPartKeys,
  inspectedPartKey,
  categoryFilter,
  focusPart,
  reframeId,
  handleRef,
  onSelectPart,
  onRequestReframe,
}: {
  parts: DevicePart[];
  mode: DiagnosisMode;
  explode: number;
  highlightedPartKeys: string[];
  inspectedPartKey: string | null;
  categoryFilter: PartCategory | "all";
  /** The part the camera frames — the first one the diagnosis implicates. */
  focusPart: DevicePart | null;
  /** Bumped to send the camera home without changing the focus. */
  reframeId: number;
  /** Filled in with the capture/camera handle once the canvas is live. */
  handleRef?: React.RefObject<PhoneSceneHandle | null>;
  onSelectPart: (key: string) => void;
  onRequestReframe: () => void;
}) {
  const palette = useScenePalette();
  const controls = useRef<OrbitControlsImpl>(null);
  const fallbackHandle = useRef<PhoneSceneHandle>(null);
  const handle = handleRef ?? fallbackHandle;

  return (
    <Canvas
      camera={{ position: DEFAULT_CAMERA, fov: 38, near: 0.1, far: 100 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
      /* Capped so an old shop tablet is not asked to fill a retina buffer. */
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <SceneBridge
        handle={handle}
        controls={controls}
        onReframe={onRequestReframe}
      />

      {/* Lighting is deliberately flat and even. A dramatic key light makes a
          nicer picture and a worse diagnosis: a part in shadow reads as
          dimmed, which is exactly the signal this scene uses for "not the
          problem". */}
      {/* The lights are pinned white, not themed. Colouring the key light with
          a surface token was the obvious-looking thing to do and it was wrong:
          `--paper` is near-black in dark mode, so the key light contributed
          essentially nothing and the whole rig went flat. Illumination is not
          a surface. */}
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 6, 8]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-5, -2, -6]} intensity={0.7} color="#dfe6ff" />
      {/* A soft rim from below-front, so the rounded edge of every part picks
          up a line and the bevels are visible as bevels. Low enough that it
          lifts a silhouette without modelling anything into shadow. */}
      <directionalLight position={[0, -4, 5]} intensity={0.45} color="#ffffff" />

      {/* Metalness and clearcoat need something to *reflect*: with no
          environment a brushed-aluminium frame and a glass front both resolve
          to the same flat grey, which is the exact failure this scene is
          trying to get away from.

          Built from Lightformers rather than `preset=` on purpose. A drei
          preset fetches an HDR from raw.githack.com at runtime — a network
          round trip to a third-party CDN before the canvas can finish, on
          hardware that is often an old tablet on shop wifi, and a blank scene
          if it fails. This rig is three emissive planes; it costs no request
          and cannot fail offline.

          White, and only white. A tinted reflection would put hue on the
          parts, and hue in this scene means fault. */}
      <Environment resolution={128} frames={1}>
        {/* Broad soft key above, the dominant reflection. */}
        <Lightformer
          intensity={1.6}
          position={[0, 4, 3]}
          rotation={[-Math.PI / 3, 0, 0]}
          scale={[10, 6, 1]}
          color="#ffffff"
        />
        {/* Two narrow strips down the sides — these are what draw the long
            highlight along a rounded edge, and the single clearest cue that a
            part has a bevel rather than a corner. */}
        <Lightformer
          intensity={1.1}
          position={[-5, 1, 2]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[6, 3, 1]}
          color="#ffffff"
        />
        <Lightformer
          intensity={0.9}
          position={[5, 0, 1]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 3, 1]}
          color="#f2f5ff"
        />
      </Environment>

      <PhoneModel
        parts={parts}
        mode={mode}
        explode={explode}
        highlightedPartKeys={highlightedPartKeys}
        inspectedPartKey={inspectedPartKey}
        categoryFilter={categoryFilter}
        palette={palette}
        onSelectPart={onSelectPart}
      />

      <CameraRig
        focusPart={focusPart}
        mode={mode}
        explode={explode}
        controls={controls}
        requestId={reframeId}
      />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        /* Zoom is bounded: the shop floor use is "turn it a bit to see round
           the back", not free flight, and a customer who has zoomed inside the
           logic board has no way to recover. */
        minDistance={3.2}
        maxDistance={12}
        enableDamping
        dampingFactor={0.08}
        /* One finger orbits, two pinch-zoom — the tablet gesture set. */
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}
