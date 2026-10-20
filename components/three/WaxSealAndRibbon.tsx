"use client";
/**
 * WaxSealAndRibbon.tsx — oval dusty-pink wax seal with an embossed bouquet,
 * sitting on an ivory raw-edged silk ribbon tied in a bow.
 * Tap the seal → it pops toward the camera and drops away to the bottom
 * right; the bow loosens, its loops slip off and the band slides away.
 */
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { CARD, PALETTE, TEXTURES, TIMELINE } from "@/lib/invitation.config";
import { input, useInvitation } from "@/lib/store";
import { RibbonStrip, v, type StripDef } from "@/lib/ribbon";
import { normalFromCanvas } from "@/lib/textures";

/** Fine satin weave + soft crinkles as a height map → normal map for the ribbon. */
function weaveNormal() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(512, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 512; x++) {
      const h = 0.5 + 0.18 * Math.sin(x * 1.6) * Math.sin(y * 0.9) + 0.25 * Math.sin(x * 0.045 + Math.sin(y * 0.1) * 2);
      const i = (y * 512 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = h * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const t = normalFromCanvas(c, 2.5, 0);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
import { drawSealBouquet, makeFrayedRibbonAlpha } from "@/lib/illustrations";
import { useOptionalTexture } from "@/lib/assets";
import { haptic, paperRustle, ribbonSwish, startMusic, waxPop } from "@/lib/audio";

const FRONT = CARD.thickness + 0.004; // outer paper surface (incl. bevel)
const Y = -0.12; // ribbon height on the card
const SEAL = { rx: 0.21, ry: 0.26 };

// ------------------------------------------------------------- ribbon ---
const W = CARD.flapWidth;
const Z = FRONT + 0.006;
const STRIPS: StripDef[] = [
  // belly band, left half: wraps around the hinge edge into the knot
  {
    from: [v(-W - 0.03, Y, -0.06), v(-W - 0.012, Y, FRONT * 0.5), v(-W + 0.06, Y + 0.01, Z), v(-0.6, Y - 0.01, Z), v(-0.25, Y + 0.005, Z + 0.004), v(-0.05, Y, Z + 0.03)],
    to: [v(-3.4, Y - 0.6, 0.2), v(-3.1, Y - 0.55, 0.3), v(-2.7, Y - 0.5, 0.4), v(-2.3, Y - 0.45, 0.5), v(-1.9, Y - 0.4, 0.55), v(-1.6, Y - 0.35, 0.6)],
    hint: v(0, 1, 0),
    width: 0.17,
    wave: 0.3,
  },
  // belly band, right half
  {
    from: [v(W + 0.03, Y, -0.06), v(W + 0.012, Y, FRONT * 0.5), v(W - 0.06, Y - 0.01, Z), v(0.6, Y + 0.012, Z), v(0.25, Y - 0.004, Z + 0.004), v(0.05, Y, Z + 0.03)],
    to: [v(3.4, Y - 0.5, 0.2), v(3.1, Y - 0.45, 0.3), v(2.7, Y - 0.4, 0.4), v(2.3, Y - 0.35, 0.5), v(1.9, Y - 0.3, 0.55), v(1.6, Y - 0.25, 0.6)],
    hint: v(0, 1, 0),
    width: 0.17,
    wave: 0.3,
  },
  // left loop
  {
    from: [v(0, Y + 0.01, 0.075), v(-0.13, Y + 0.09, 0.15), v(-0.34, Y + 0.16, 0.19), v(-0.52, Y + 0.08, 0.13), v(-0.5, Y - 0.06, 0.07), v(-0.3, Y - 0.07, 0.05), v(-0.11, Y - 0.03, 0.06), v(0, Y, 0.075)],
    mid: [v(0, Y + 0.01, 0.075), v(-0.17, Y + 0.13, 0.09), v(-0.45, Y + 0.24, 0.09), v(-0.7, Y + 0.12, 0.075), v(-0.68, Y - 0.1, 0.065), v(-0.4, Y - 0.12, 0.07), v(-0.14, Y - 0.05, 0.072), v(0, Y, 0.075)],
    to: [v(-0.5, Y + 0.05, 0.25), v(-0.9, Y + 0.15, 0.35), v(-1.4, Y + 0.25, 0.45), v(-1.9, Y + 0.25, 0.5), v(-2.4, Y + 0.15, 0.5), v(-2.9, Y, 0.45), v(-3.3, Y - 0.15, 0.4), v(-3.7, Y - 0.3, 0.35)],
    hint: v(0.25, 0, 1),
    mode: "cross",
    width: 0.16,
    wave: 0.5,
    twist: 1.6,
  },
  // right loop
  {
    from: [v(0, Y + 0.01, 0.075), v(0.13, Y + 0.08, 0.15), v(0.35, Y + 0.14, 0.19), v(0.53, Y + 0.06, 0.13), v(0.49, Y - 0.08, 0.07), v(0.29, Y - 0.08, 0.05), v(0.11, Y - 0.03, 0.06), v(0, Y, 0.075)],
    mid: [v(0, Y + 0.01, 0.075), v(0.17, Y + 0.12, 0.09), v(0.46, Y + 0.22, 0.09), v(0.72, Y + 0.1, 0.075), v(0.67, Y - 0.12, 0.065), v(0.39, Y - 0.13, 0.07), v(0.14, Y - 0.05, 0.072), v(0, Y, 0.075)],
    to: [v(0.5, Y + 0.08, 0.25), v(0.9, Y + 0.18, 0.35), v(1.4, Y + 0.28, 0.45), v(1.9, Y + 0.28, 0.5), v(2.4, Y + 0.18, 0.5), v(2.9, Y + 0.05, 0.45), v(3.3, Y - 0.1, 0.4), v(3.7, Y - 0.25, 0.35)],
    hint: v(-0.25, 0, 1),
    mode: "cross",
    width: 0.16,
    wave: 0.5,
    twist: -1.7,
  },
  // left tail, hanging long like the reference
  {
    from: [v(-0.02, Y - 0.02, 0.07), v(-0.08, Y - 0.17, 0.09), v(-0.15, Y - 0.36, 0.05), v(-0.22, Y - 0.56, 0.075), v(-0.27, Y - 0.78, 0.04)],
    mid: [v(-0.02, Y - 0.02, 0.075), v(-0.12, Y - 0.15, 0.07), v(-0.24, Y - 0.32, 0.062), v(-0.36, Y - 0.5, 0.055), v(-0.46, Y - 0.68, 0.05)],
    to: [v(-0.6, Y - 0.2, 0.3), v(-1.1, Y - 0.45, 0.42), v(-1.6, Y - 0.75, 0.5), v(-2.1, Y - 1.05, 0.5), v(-2.6, Y - 1.4, 0.45)],
    hint: v(0, 0, 1),
    mode: "cross",
    width: 0.15,
    wave: 0.6,
    twist: 2.4,
  },
  // right tail
  {
    from: [v(0.02, Y - 0.02, 0.07), v(0.07, Y - 0.18, 0.05), v(0.13, Y - 0.38, 0.085), v(0.19, Y - 0.58, 0.05), v(0.23, Y - 0.8, 0.07)],
    mid: [v(0.02, Y - 0.02, 0.075), v(0.11, Y - 0.16, 0.07), v(0.23, Y - 0.33, 0.062), v(0.35, Y - 0.52, 0.055), v(0.45, Y - 0.7, 0.05)],
    to: [v(0.6, Y - 0.15, 0.3), v(1.1, Y - 0.4, 0.42), v(1.6, Y - 0.7, 0.5), v(2.1, Y - 1.0, 0.5), v(2.6, Y - 1.35, 0.45)],
    hint: v(0, 0, 1),
    mode: "cross",
    width: 0.15,
    wave: 0.6,
    twist: -2.4,
  },
];

function Ribbon() {
  const phase = useInvitation((s) => s.phase);
  const progress = useRef({ value: 0 });
  const [gone, setGone] = useState(false);
  const knot = useRef<THREE.Mesh>(null!);
  const strips = useMemo(() => STRIPS.map((d) => new RibbonStrip(d)), []);
  const material = useMemo(() => {
    const alpha = makeFrayedRibbonAlpha();
    alpha.repeat.set(3, 1);
    return new THREE.MeshPhysicalMaterial({
      color: PALETTE.ribbon,
      roughness: 0.6,
      sheen: 0.7,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(PALETTE.ribbonSheen),
      anisotropy: 0.5,
      alphaMap: alpha,
      alphaTest: 0.35,
      normalMap: weaveNormal(),
      normalScale: new THREE.Vector2(0.6, 0.6),
      side: THREE.DoubleSide,
      transparent: true,
    });
  }, []);

  useEffect(() => {
    if (phase !== "opening") return;
    const D = TIMELINE.ribbonDuration;
    const tl = gsap.timeline({ delay: TIMELINE.ribbonUntie });
    // slow loosening (loops widen), then the ribbon slips away
    tl.to(progress.current, { value: 0.4, duration: D * 0.45, ease: "sine.inOut" })
      .to(progress.current, { value: 1, duration: D * 0.55, ease: "power2.in" })
      .to(knot.current.scale, { x: 1.3, y: 1.15, duration: D * 0.45, ease: "sine.inOut" }, 0)
      .to(knot.current.scale, { x: 0, y: 0, z: 0, duration: 0.3, ease: "back.in(2)" }, D * 0.5)
      .to(material, { opacity: 0, duration: 0.45, ease: "power1.in" }, D * 0.75)
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
    <group>
      {strips.map((s, i) => (
        <mesh key={i} geometry={s.geometry} material={material} castShadow receiveShadow raycast={() => null} />
      ))}
      <mesh ref={knot} position={[0, Y, 0.08]} material={material} castShadow raycast={() => null}>
        <capsuleGeometry args={[0.045, 0.07, 6, 16]} />
      </mesh>
    </group>
  );
}

// --------------------------------------------------------------- seal ---
function sealGeometry() {
  const shape = new THREE.Shape();
  const n = 128;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    // pressed oval with a barely irregular poured rim
    const k = 1 + 0.012 * Math.sin(7 * a + 1) + 0.008 * Math.sin(13 * a);
    const x = Math.cos(a) * SEAL.rx * k;
    const y = Math.sin(a) * SEAL.ry * k;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.022,
    bevelSegments: 8,
    curveSegments: 64,
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
    const normalMap = normalFromCanvas(drawSealBouquet(512), 5, 3);
    // cap UVs are the shape's x/y → map the stamp onto the oval
    normalMap.repeat.set(1 / (2 * SEAL.rx * 1.02), 1 / (2 * SEAL.ry * 1.02));
    normalMap.offset.set(0.5, 0.5);
    return new THREE.MeshPhysicalMaterial({
      color: PALETTE.wax,
      normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughness: 0.5,
      clearcoat: 0.18,
      clearcoatRoughness: 0.4,
      sheen: 0.4,
      sheenColor: new THREE.Color("#ffe9e6"),
      sheenRoughness: 0.6,
    });
  }, []);

  useEffect(() => {
    if (!painted) return;
    painted.repeat.copy(material.normalMap!.repeat);
    painted.offset.copy(material.normalMap!.offset);
    material.map = painted;
    material.color.set("#ffffff");
    material.needsUpdate = true;
  }, [painted, material]);

  useEffect(() => {
    if (phase !== "opening") return;
    const o = outer.current;
    const tl = gsap.timeline({ delay: TIMELINE.sealLift });
    // 1. pops free from the ribbon toward the camera
    tl.to(o.position, { z: o.position.z + 0.28, duration: 0.4, ease: "power2.out" })
      .to(o.rotation, { x: -0.25, y: 0.2, duration: 0.4, ease: "power2.out" }, 0)
      // 2. tips over and drops away to the bottom right, out of frame
      .to(o.position, { x: 0.75, y: -2.2, z: 0.9, duration: 1.1, ease: "power2.in" }, TIMELINE.sealExit)
      .to(o.rotation, { x: 1.25, y: 0.5, z: -0.7, duration: 1.1, ease: "power1.in" }, TIMELINE.sealExit)
      .add(() => setGone(true));
    return () => {
      tl.kill();
    };
  }, [phase]);

  useFrame(({ clock }, dt) => {
    if (phase !== "idle") return;
    // idle: gently "invites" a tap
    const s = 1 + Math.sin(clock.elapsedTime * 2.2) * 0.01 + (hover ? 0.04 : 0);
    const k = 1 - Math.exp(-dt * 10);
    inner.current.scale.x += (s - inner.current.scale.x) * k;
    inner.current.scale.y = inner.current.scale.z = inner.current.scale.x;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (phase !== "idle") return;
    requestGyro();
    waxPop();
    ribbonSwish(TIMELINE.ribbonUntie + 0.5);
    paperRustle(1.8, TIMELINE.flapsOpen);
    startMusic();
    haptic([12, 40, 18]);
    document.body.style.cursor = "";
    open();
  };

  if (gone) return null;
  return (
    <group ref={outer} position={[0, Y, 0.125]}>
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
