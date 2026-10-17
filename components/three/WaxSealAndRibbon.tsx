"use client";
/**
 * WaxSealAndRibbon.tsx — 3D wax seal (irregular poured edge, embossed rose,
 * clear-coated wax) on top of a silk-satin bow and belly band.
 * Click on the seal → it lifts toward the camera, spins and flies off to the
 * right; the bow unties (vertex-deformed strips) and the band slides away.
 */
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { CARD, PALETTE, TEXTURES, TIMELINE } from "@/lib/invitation.config";
import { input, useInvitation } from "@/lib/store";
import { RibbonStrip, v, type StripDef } from "@/lib/ribbon";
import { makeWaxSeal } from "@/lib/textures";
import { useOptionalTexture } from "@/lib/assets";
import { haptic, paperRustle, ribbonSwish, startMusic, waxPop } from "@/lib/audio";

const FRONT = CARD.thickness + 0.004; // outer paper surface (incl. bevel)
const SEAL_R = 0.2;

// ------------------------------------------------------------- ribbon ---
const W = CARD.flapWidth;
const STRIPS: StripDef[] = [
  // belly band, left half: wraps around the hinge edge into the knot
  {
    from: [v(-W - 0.03, 0, -0.05), v(-W - 0.012, 0, FRONT * 0.5), v(-W + 0.05, 0, FRONT + 0.004), v(-0.6, 0, FRONT + 0.005), v(-0.25, 0, FRONT + 0.006), v(-0.05, 0, FRONT + 0.03)],
    to: [v(-3.6, -1.4, 0.3), v(-3.3, -1.25, 0.4), v(-2.9, -1.1, 0.5), v(-2.4, -0.95, 0.65), v(-2.0, -0.8, 0.75), v(-1.7, -0.7, 0.8)],
    hint: v(0, 1, 0),
    width: 0.13,
    wave: 0.4,
  },
  // belly band, right half
  {
    from: [v(W + 0.03, 0, -0.05), v(W + 0.012, 0, FRONT * 0.5), v(W - 0.05, 0, FRONT + 0.004), v(0.6, 0, FRONT + 0.005), v(0.25, 0, FRONT + 0.006), v(0.05, 0, FRONT + 0.03)],
    to: [v(3.6, -1.2, 0.3), v(3.3, -1.1, 0.4), v(2.9, -0.95, 0.5), v(2.4, -0.8, 0.65), v(2.0, -0.7, 0.75), v(1.7, -0.6, 0.8)],
    hint: v(0, 1, 0),
    width: 0.13,
    wave: 0.4,
  },
  // left loop
  {
    from: [v(0, 0.01, 0.07), v(-0.12, 0.09, 0.075), v(-0.3, 0.17, 0.07), v(-0.45, 0.1, 0.06), v(-0.44, -0.04, 0.055), v(-0.27, -0.05, 0.06), v(-0.1, -0.02, 0.066), v(0, 0, 0.072)],
    to: [v(-0.4, 0.1, 0.3), v(-0.8, 0.3, 0.45), v(-1.3, 0.5, 0.55), v(-1.8, 0.55, 0.6), v(-2.3, 0.45, 0.6), v(-2.8, 0.3, 0.55), v(-3.2, 0.1, 0.5), v(-3.6, -0.1, 0.45)],
    hint: v(0, 0, 1),
    mode: "cross",
    width: 0.12,
    wave: 0.6,
    twist: 2.2,
  },
  // right loop
  {
    from: [v(0, 0.01, 0.07), v(0.12, 0.08, 0.075), v(0.31, 0.15, 0.07), v(0.46, 0.08, 0.06), v(0.43, -0.06, 0.055), v(0.26, -0.06, 0.06), v(0.1, -0.02, 0.066), v(0, 0, 0.072)],
    to: [v(0.4, 0.15, 0.3), v(0.8, 0.35, 0.45), v(1.3, 0.55, 0.55), v(1.8, 0.6, 0.6), v(2.3, 0.5, 0.6), v(2.8, 0.35, 0.55), v(3.2, 0.15, 0.5), v(3.6, -0.05, 0.45)],
    hint: v(0, 0, 1),
    mode: "cross",
    width: 0.12,
    wave: 0.6,
    twist: -2.4,
  },
  // left tail
  {
    from: [v(-0.02, -0.02, 0.07), v(-0.07, -0.14, 0.062), v(-0.13, -0.3, 0.052), v(-0.2, -0.48, 0.045), v(-0.25, -0.66, 0.04)],
    to: [v(-0.6, -0.3, 0.4), v(-1.1, -0.6, 0.55), v(-1.6, -0.95, 0.6), v(-2.1, -1.3, 0.6), v(-2.6, -1.7, 0.55)],
    hint: v(0, 0, 1),
    mode: "cross",
    width: 0.12,
    wave: 0.7,
    twist: 3,
  },
  // right tail
  {
    from: [v(0.02, -0.02, 0.07), v(0.06, -0.15, 0.062), v(0.11, -0.32, 0.052), v(0.16, -0.5, 0.045), v(0.19, -0.7, 0.04)],
    to: [v(0.6, -0.25, 0.4), v(1.1, -0.55, 0.55), v(1.6, -0.9, 0.6), v(2.1, -1.25, 0.6), v(2.6, -1.6, 0.55)],
    hint: v(0, 0, 1),
    mode: "cross",
    width: 0.12,
    wave: 0.7,
    twist: -3,
  },
];

function Ribbon() {
  const phase = useInvitation((s) => s.phase);
  const progress = useRef({ value: 0 });
  const [gone, setGone] = useState(false);
  const group = useRef<THREE.Group>(null!);
  const knot = useRef<THREE.Mesh>(null!);
  const strips = useMemo(() => STRIPS.map((d) => new RibbonStrip(d)), []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: PALETTE.ribbon,
        roughness: 0.42,
        metalness: 0,
        sheen: 1,
        sheenRoughness: 0.32,
        sheenColor: new THREE.Color(PALETTE.ribbonSheen),
        anisotropy: 0.75,
        clearcoat: 0.15,
        clearcoatRoughness: 0.4,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    []
  );

  useEffect(() => {
    if (phase !== "opening") return;
    const tl = gsap.timeline({ delay: TIMELINE.ribbonUntie });
    tl.to(progress.current, { value: 1, duration: 1.5, ease: "power2.in" })
      .to(knot.current.scale, { x: 0, y: 0, z: 0, duration: 0.35, ease: "back.in(2)" }, 0)
      .to(material, { opacity: 0, duration: 0.6, ease: "power1.in" }, 0.75)
      .add(() => setGone(true));
    return () => {
      tl.kill();
    };
  }, [phase, material]);

  useFrame(({ clock }) => {
    const p = progress.current.value;
    if (p > 0 && p < 1) for (const s of strips) s.update(p, clock.elapsedTime);
  });

  if (gone) return null;
  return (
    <group ref={group}>
      {strips.map((s, i) => (
        <mesh key={i} geometry={s.geometry} material={material} castShadow receiveShadow raycast={() => null} />
      ))}
      <RoundedBox ref={knot} args={[0.1, 0.14, 0.05]} radius={0.02} smoothness={3} position={[0, 0, 0.07]} material={material} castShadow />
    </group>
  );
}

// --------------------------------------------------------------- seal ---
function sealGeometry() {
  const shape = new THREE.Shape();
  const n = 96;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // poured wax: irregular, puddled rim
    const r = SEAL_R * (1 + 0.045 * Math.sin(5 * a + 1) + 0.03 * Math.sin(9 * a + 2.4) + 0.018 * Math.sin(17 * a));
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.024,
    bevelSegments: 6,
    curveSegments: 48,
  });
  g.center();
  return g;
}

function WaxSeal() {
  const phase = useInvitation((s) => s.phase);
  const open = useInvitation((s) => s.open);
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const [hover, setHover] = useState(false);
  const [gone, setGone] = useState(false);
  const geometry = useMemo(sealGeometry, []);
  const painted = useOptionalTexture(TEXTURES.seal);

  const material = useMemo(() => {
    const t = makeWaxSeal(PALETTE.wax);
    const stamp = SEAL_R * 0.95;
    for (const tex of [t.map, t.normalMap]) {
      tex.repeat.set(1 / (2 * stamp), 1 / (2 * stamp));
      tex.offset.set(0.5, 0.5);
    }
    return new THREE.MeshPhysicalMaterial({
      map: t.map,
      normalMap: t.normalMap,
      normalScale: new THREE.Vector2(1.6, 1.6),
      roughness: 0.4,
      clearcoat: 0.3,
      clearcoatRoughness: 0.28,
      sheen: 0.5,
      sheenColor: new THREE.Color("#ffd9d6"),
      sheenRoughness: 0.5,
      // a touch of light scattering through the wax
      transmission: 0.06,
      thickness: 0.3,
      attenuationColor: new THREE.Color("#b1585e"),
      attenuationDistance: 0.4,
    });
  }, []);

  useEffect(() => {
    if (!painted) return;
    painted.repeat.copy(material.map!.repeat);
    painted.offset.copy(material.map!.offset);
    material.map = painted;
    material.needsUpdate = true;
  }, [painted, material]);

  useEffect(() => {
    if (phase !== "opening") return;
    const o = outer.current;
    const tl = gsap.timeline({ delay: TIMELINE.sealLift });
    // 1. pops free from the wax bed toward the camera, tilting
    tl.to(o.position, { z: o.position.z + 0.6, duration: 0.55, ease: "power2.out" })
      .to(o.rotation, { x: -0.45, y: 0.35, duration: 0.55, ease: "power2.out" }, 0)
      // 2. tumbles away to the right, out of frame
      .to(o.position, { x: 3.6, y: 0.7, z: 1.4, duration: 1.15, ease: "power2.in" }, TIMELINE.sealExit)
      .to(o.rotation, { z: -2.8, y: 1.6, x: 0.4, duration: 1.15, ease: "power1.in" }, TIMELINE.sealExit)
      .add(() => setGone(true));
    return () => {
      tl.kill();
    };
  }, [phase]);

  useFrame(({ clock }, dt) => {
    if (phase !== "idle") return;
    // idle: gently "invites" a click
    const s = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.012 + (hover ? 0.05 : 0);
    const k = 1 - Math.exp(-dt * 10);
    inner.current.scale.x += (s - inner.current.scale.x) * k;
    inner.current.scale.y = inner.current.scale.z = inner.current.scale.x;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (phase !== "idle") return;
    requestGyro();
    waxPop();
    ribbonSwish(TIMELINE.ribbonUntie);
    paperRustle(1.8, TIMELINE.flapsOpen);
    startMusic();
    haptic([12, 40, 18]);
    document.body.style.cursor = "";
    open();
  };

  if (gone) return null;
  return (
    <group ref={outer} position={[0, 0, 0.115]}>
      <group ref={inner}>
        <mesh
          geometry={geometry}
          material={material}
          castShadow
          receiveShadow
          onClick={onClick}
          onPointerOver={() => {
            if (phase !== "idle") return;
            setHover(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHover(false);
            document.body.style.cursor = "";
          }}
        />
      </group>
    </group>
  );
}

/** iOS 13+ needs an explicit permission prompt from a user gesture. */
export function requestGyro() {
  const DOE = (typeof window !== "undefined" ? window.DeviceOrientationEvent : undefined) as
    | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> })
    | undefined;
  if (DOE?.requestPermission) {
    DOE.requestPermission()
      .then((r) => (input.gyro = r === "granted" ? input.gyro : false))
      .catch(() => {});
  }
}

export default function WaxSealAndRibbon() {
  return (
    <group>
      <Ribbon />
      <WaxSeal />
    </group>
  );
}
