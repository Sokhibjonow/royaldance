"use client";
/**
 * GatefoldEnvelope.tsx — the closed invitation: two tall die-cut doors with
 * big scalloped lobes (real 1.8 mm board thickness, cotton-paper PBR,
 * pen-and-ink toile of rose vines), and behind them an inner liner with a
 * scalloped top and bottom flap. Opening: doors swing out to 130° with a
 * paper curl, then the top & bottom flaps fold away and the liner dissolves
 * into the diorama.
 */
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { CARD, PALETTE, TEXTURES, TIMELINE } from "@/lib/invitation.config";
import { useInvitation } from "@/lib/store";
import { applyPaperBend, createBendUniforms, type BendUniforms } from "@/lib/paperBend";
import { loadOptionalImage, makePaper, type PaperSet } from "@/lib/textures";
import { drawLinerSprigs, drawToile } from "@/lib/illustrations";
import { useHasAsset } from "@/lib/assets";

const { flapWidth: W, height: H, thickness: T } = CARD;
const LOBE_IN = 0.12; // bulge of the lobes along the centre edge
const LOBE_TB = 0.08; // bulge of the lobes along top & bottom

type V2 = [number, number];

/** Points of `count` circular lobes from a to b, bulging along `normal` by `sagitta`. */
function lobes(a: V2, b: V2, count: number, sagitta: number, normal: V2, steps = 18): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < count; i++) {
    const p0: V2 = [a[0] + ((b[0] - a[0]) * i) / count, a[1] + ((b[1] - a[1]) * i) / count];
    const p1: V2 = [a[0] + ((b[0] - a[0]) * (i + 1)) / count, a[1] + ((b[1] - a[1]) * (i + 1)) / count];
    const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const R = (c * c) / 4 / (2 * sagitta) + sagitta / 2;
    for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
      const t = k / steps;
      const bulge = Math.sqrt(Math.max(0, R * R - (c * (t - 0.5)) ** 2)) - (R - sagitta);
      pts.push([p0[0] + (p1[0] - p0[0]) * t + normal[0] * bulge, p0[1] + (p1[1] - p0[1]) * t + normal[1] * bulge]);
    }
  }
  return pts;
}

/** Door outline. side=left → hinge at x=0, lobed edge reaching x=+W (mirrored for right). */
function doorShape(side: "left" | "right") {
  const sx = side === "left" ? 1 : -1;
  const xr = W - LOBE_IN;
  const yb = -H / 2 + LOBE_TB;
  const yt = H / 2 - LOBE_TB;
  const pts: V2[] = [
    ...lobes([0, yb], [xr, yb], 2, LOBE_TB, [0, -1]),
    ...lobes([xr, yb], [xr, yt], 4, LOBE_IN, [1, 0]).slice(1),
    ...lobes([xr, yt], [0, yt], 2, LOBE_TB, [0, 1]).slice(1),
  ];
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(sx * x, y) : s.moveTo(sx * x, y)));
  s.closePath();
  return s;
}

/**
 * Extrude → tessellate (so the vertex bend has vertices across the width)
 * → regroup triangles: 0 = outer printed face, 1 = inner face, 2 = cut edge.
 */
function buildDoorGeometry(side: "left" | "right") {
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(doorShape(side), {
    depth: T,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.0025,
    bevelSegments: 2,
    curveSegments: 6,
  });
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = new TessellateModifier(0.06, 10).modify(g);

  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const buckets: number[][] = [[], [], []];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(ab.subVectors(a, b)).normalize();
    buckets[n.z > 0.7 ? 0 : n.z < -0.7 ? 1 : 2].push(i);
  }
  const minX = side === "left" ? 0 : -W;
  const out = new Float32Array(pos.count * 3);
  const uv = new Float32Array(pos.count * 2);
  const geo = new THREE.BufferGeometry();
  let o = 0;
  buckets.forEach((list, gi) => {
    const start = o;
    for (const i of list) {
      for (let k = 0; k < 3; k++) {
        const x = pos.getX(i + k);
        const y = pos.getY(i + k);
        out.set([x, y, pos.getZ(i + k)], o * 3);
        uv.set([(x - minX) / W, (y + H / 2) / H], o * 2);
        o++;
      }
    }
    geo.addGroup(start, o - start, gi);
  });
  geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function applyPaper(p: PaperSet, m: THREE.MeshStandardMaterial) {
  m.map = p.map;
  m.normalMap = p.normalMap;
  m.normalScale.set(0.55, 0.55);
  m.roughnessMap = p.roughnessMap;
  m.roughness = 1;
  m.needsUpdate = true;
}

/** Fade helper: every material registered here follows one opacity value. */
function useFader() {
  const mats = useMemo(() => new Set<THREE.Material>(), []);
  const value = useRef({ v: 1 });
  const register = useCallback(
    (m: THREE.Material) => {
      mats.add(m);
      return m;
    },
    [mats]
  );
  useFrame(() => {
    const v = value.current.v;
    for (const m of mats) {
      m.transparent = v < 1;
      m.opacity = v;
      m.depthWrite = v > 0.5;
    }
  });
  return { register, value: value.current };
}

function useDoorMaterials(side: "left" | "right", uniforms: BendUniforms, register: (m: THREE.Material) => THREE.Material) {
  const hasArt = useHasAsset(side === "left" ? TEXTURES.flapLeft : TEXTURES.flapRight);
  const mats = useMemo(() => {
    const face = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.9,
      sheen: 0.3,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color("#fff6ec"),
    });
    const inner = new THREE.MeshStandardMaterial({ color: PALETTE.paperInner, roughness: 0.92 });
    const edge = new THREE.MeshStandardMaterial({ color: PALETTE.paperEdge, roughness: 0.95 });
    for (const m of [face, inner, edge]) register(applyPaperBend(m, uniforms));
    const depth = applyPaperBend(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, false);
    return { list: [face, inner, edge], face, inner, depth };
  }, [uniforms, register]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const painted = hasArt ? await loadOptionalImage(side === "left" ? TEXTURES.flapLeft : TEXTURES.flapRight) : null;
      if (!alive) return;
      applyPaper(
        makePaper({
          width: 768,
          height: 2196,
          paper: PALETTE.paper,
          seed: side === "left" ? 3 : 4,
          overlay: painted ?? drawToile(side, 768, 2196, PALETTE.toile),
        }),
        mats.face
      );
      applyPaper(makePaper({ width: 256, height: 732, paper: PALETTE.paperInner, seed: 8 }), mats.inner);
    })();
    return () => {
      alive = false;
    };
  }, [mats, side, hasArt]);

  return mats;
}

function Door({ side, register }: { side: "left" | "right"; register: (m: THREE.Material) => THREE.Material }) {
  const pivot = useRef<THREE.Group>(null!);
  const uniforms = useMemo(() => createBendUniforms(W), []);
  const geometry = useMemo(() => buildDoorGeometry(side), [side]);
  const mats = useDoorMaterials(side, uniforms, register);
  const phase = useInvitation((s) => s.phase);
  const dir = side === "left" ? -1 : 1;

  useEffect(() => {
    if (phase !== "opening") return;
    const stagger = side === "left" ? 0 : 0.08;
    const D = TIMELINE.flapsDuration;
    const tl = gsap.timeline({ delay: TIMELINE.flapsOpen + stagger });
    // hinge: a small "unstick" nudge, then the swing with a soft settle
    tl.to(pivot.current.rotation, { y: dir * 0.05, duration: 0.2, ease: "power1.out" })
      .to(pivot.current.rotation, { y: dir * CARD.openAngle, duration: D, ease: "power3.inOut" }, ">-0.05")
      // paper curls against the air, overshoots and settles
      .to(uniforms.uBend, { value: -0.4, duration: D * 0.45, ease: "sine.out" }, 0.1)
      .to(uniforms.uBend, { value: 0.1, duration: D * 0.4, ease: "sine.inOut" })
      .to(uniforms.uBend, { value: 0, duration: 1.1, ease: "elastic.out(1, 0.45)" });
    tl.fromTo(uniforms.uFlutter, { value: 1 }, { value: 0, duration: D + 0.8 }, 0);
    return () => {
      tl.kill();
    };
  }, [phase, dir, side, uniforms]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <group ref={pivot} position={[side === "left" ? -W : W, 0, 0]}>
      <mesh
        geometry={geometry}
        material={mats.list}
        customDepthMaterial={mats.depth}
        castShadow
        receiveShadow
        // let the tap fall through to the wax seal
        raycast={() => null}
      />
    </group>
  );
}

/** Scalloped flap hinged on its straight edge: `dir` 1 = hangs down from the top. */
function flapGeometry(dir: 1 | -1) {
  const hw = W * 0.96;
  const depth = 0.5;
  const pts: V2[] = [
    [-hw, 0],
    [-hw, -depth * dir],
    ...lobes([-hw, -depth * dir], [-hw * 0.5, -depth * dir], 1, 0.08, [0, -dir]).slice(1),
    ...lobes([-hw * 0.5, -depth * dir], [hw * 0.5, -depth * dir], 1, 0.2, [0, -dir]).slice(1),
    ...lobes([hw * 0.5, -depth * dir], [hw, -depth * dir], 1, 0.08, [0, -dir]).slice(1),
    [hw, 0],
  ];
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false, curveSegments: 8 });
  // planar UVs in world units → paper texture tiles naturally
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) uv.set([(p.getX(i) + hw) / (2 * hw), (p.getY(i) * dir + depth + 0.2) / 1], i * 2);
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

function InnerLiner({ register }: { register: (m: THREE.Material) => THREE.Material }) {
  const phase = useInvitation((s) => s.phase);
  const top = useRef<THREE.Group>(null!);
  const bottom = useRef<THREE.Group>(null!);
  const geo = useMemo(() => ({ top: flapGeometry(1), bottom: flapGeometry(-1) }), []);
  const mats = useMemo(() => {
    const sheet = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
    const flap = new THREE.MeshStandardMaterial({ color: "#f6f1e9", roughness: 0.95 });
    applyPaper(makePaper({ width: 512, height: 732, paper: PALETTE.paperInner, seed: 15, overlay: drawLinerSprigs() }), sheet);
    applyPaper(makePaper({ width: 512, height: 256, paper: "#f4eee5", seed: 16 }), flap);
    register(sheet);
    register(flap);
    return { sheet, flap };
  }, [register]);

  useEffect(() => {
    if (phase !== "opening") return;
    const tl = gsap.timeline({ delay: TIMELINE.innerFlaps });
    const D = TIMELINE.innerDuration;
    tl.to(top.current.rotation, { x: -2.25, duration: D, ease: "power2.inOut" }, 0).to(
      bottom.current.rotation,
      { x: 2.25, duration: D, ease: "power2.inOut" },
      0.12
    );
    return () => {
      tl.kill();
    };
  }, [phase]);

  return (
    <group>
      <mesh position={[0, 0, -0.04]} material={mats.sheet} receiveShadow raycast={() => null}>
        <planeGeometry args={[2 * W, H]} />
      </mesh>
      <group ref={top} position={[0, H / 2, -0.03]}>
        <mesh geometry={geo.top} material={mats.flap} castShadow receiveShadow raycast={() => null} />
      </group>
      <group ref={bottom} position={[0, -H / 2, -0.03]}>
        <mesh geometry={geo.bottom} material={mats.flap} castShadow receiveShadow raycast={() => null} />
      </group>
    </group>
  );
}

export default function GatefoldEnvelope() {
  const phase = useInvitation((s) => s.phase);
  const group = useRef<THREE.Group>(null!);
  const fader = useFader();

  // once we're inside, the whole envelope dissolves into the diorama
  useEffect(() => {
    if (phase !== "opening") return;
    const tw = gsap.to(fader.value, {
      v: 0,
      duration: 0.9,
      delay: TIMELINE.linerFade,
      ease: "sine.inOut",
      onComplete: () => {
        group.current.visible = false;
      },
    });
    return () => {
      tw.kill();
    };
  }, [phase, fader.value]);

  return (
    <group ref={group}>
      <InnerLiner register={fader.register} />
      <Door side="left" register={fader.register} />
      <Door side="right" register={fader.register} />
    </group>
  );
}
