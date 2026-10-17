"use client";
/**
 * GatefoldEnvelope.tsx — two die-cut doors with a scalloped edge,
 * real 1.8 mm board thickness (extrusion + soft bevel), cotton-paper PBR,
 * foil-stamped ornament, and the hinge / curl opening animation.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { CARD, PALETTE, TEXTURES, TIMELINE } from "@/lib/invitation.config";
import { useInvitation } from "@/lib/store";
import { applyPaperBend, createBendUniforms, type BendUniforms } from "@/lib/paperBend";
import { flapOrnament, loadOptionalImage, makePaper, type PaperSet } from "@/lib/textures";
import { useHasAsset } from "@/lib/assets";

const { flapWidth: W, height: H, thickness: T, scallopRadius: R } = CARD;

/** Door outline. side=left → hinge at x=0, scallops at x=+W (mirrored for right). */
function doorShape(side: "left" | "right") {
  const sx = side === "left" ? 1 : -1;
  const n = Math.round(H / (2 * R));
  const r = H / (2 * n);
  const s = new THREE.Shape();
  const corner = 0.03;
  s.moveTo(0, -H / 2);
  s.lineTo(sx * (W - r - corner), -H / 2);
  s.quadraticCurveTo(sx * (W - r), -H / 2, sx * (W - r), -H / 2 + corner);
  // scallops: semicircles bulging toward the centre of the card
  for (let i = 0; i < n; i++) {
    const cy = -H / 2 + r * (2 * i + 1);
    const steps = 10;
    for (let k = 1; k <= steps; k++) {
      const a = -Math.PI / 2 + (k / steps) * Math.PI;
      s.lineTo(sx * (W - r + Math.cos(a) * r), cy + Math.sin(a) * r);
    }
  }
  s.lineTo(sx * (W - r), H / 2 - corner);
  s.quadraticCurveTo(sx * (W - r), H / 2, sx * (W - r - corner), H / 2);
  s.lineTo(0, H / 2);
  s.lineTo(0, -H / 2);
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
  g = g.toNonIndexed();
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  g = new TessellateModifier(0.06, 10).modify(g);

  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const buckets: number[][] = [[], [], []];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    c.fromBufferAttribute(pos, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const bucket = n.z > 0.7 ? 0 : n.z < -0.7 ? 1 : 2;
    buckets[bucket].push(i);
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
        out[o * 3] = x;
        out[o * 3 + 1] = y;
        out[o * 3 + 2] = pos.getZ(i + k);
        uv[o * 2] = (x - minX) / W;
        uv[o * 2 + 1] = (y + H / 2) / H;
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

function useDoorMaterials(side: "left" | "right", uniforms: BendUniforms) {
  const hasArt = useHasAsset(side === "left" ? TEXTURES.flapLeft : TEXTURES.flapRight);
  const mats = useMemo(() => {
    const face = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.85,
      metalness: 0,
      sheen: 0.35,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color("#fff3e6"),
      envMapIntensity: 0.9,
    });
    const inner = new THREE.MeshStandardMaterial({ color: PALETTE.paperInner, roughness: 0.92 });
    const edge = new THREE.MeshStandardMaterial({ color: PALETTE.paperEdge, roughness: 0.95 });
    for (const m of [face, inner, edge]) applyPaperBend(m, uniforms);
    const depth = applyPaperBend(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, false);
    return { list: [face, inner, edge], face, inner, depth };
  }, [uniforms]);

  useEffect(() => {
    let alive = true;
    const apply = (p: PaperSet, target: THREE.MeshStandardMaterial) => {
      target.map = p.map;
      target.normalMap = p.normalMap;
      target.normalScale.set(0.6, 0.6);
      target.roughnessMap = p.roughnessMap;
      if (p.metalnessMap) target.metalnessMap = p.metalnessMap;
      else target.metalness = 0;
      target.needsUpdate = true;
    };
    (async () => {
      const overlay = hasArt
        ? await loadOptionalImage(side === "left" ? TEXTURES.flapLeft : TEXTURES.flapRight)
        : null;
      if (!alive) return;
      const frac = R / W;
      apply(
        makePaper({
          width: 512,
          height: 1464,
          paper: PALETTE.paper,
          foil: PALETTE.foil,
          ornament: flapOrnament(side, frac),
          seed: side === "left" ? 3 : 4,
          overlay,
        }),
        mats.face
      );
      mats.face.roughness = 1;
      mats.face.metalness = 1;
      const innerPaper = makePaper({ width: 256, height: 732, paper: PALETTE.paperInner, seed: 8 });
      apply(innerPaper, mats.inner);
    })();
    return () => {
      alive = false;
    };
  }, [mats, side, hasArt]);

  return mats;
}

function Door({ side }: { side: "left" | "right" }) {
  const pivot = useRef<THREE.Group>(null!);
  const uniforms = useMemo(() => createBendUniforms(W), []);
  const geometry = useMemo(() => buildDoorGeometry(side), [side]);
  const mats = useDoorMaterials(side, uniforms);
  const phase = useInvitation((s) => s.phase);
  const dir = side === "left" ? -1 : 1;

  useEffect(() => {
    if (phase !== "opening") return;
    const stagger = side === "left" ? 0 : 0.12;
    const tl = gsap.timeline({ delay: TIMELINE.flapsOpen + stagger });
    // hinge: a small "unstick" nudge, then the swing with a soft settle
    tl.to(pivot.current.rotation, { y: dir * 0.06, duration: 0.25, ease: "power1.out" })
      .to(pivot.current.rotation, { y: dir * CARD.openAngle, duration: TIMELINE.flapsDuration, ease: "power3.inOut" }, ">-0.05")
      // paper curls against the air, overshoots and settles
      .to(uniforms.uBend, { value: -0.42, duration: TIMELINE.flapsDuration * 0.45, ease: "sine.out" }, 0.1)
      .to(uniforms.uBend, { value: 0.12, duration: TIMELINE.flapsDuration * 0.4, ease: "sine.inOut" })
      .to(uniforms.uBend, { value: 0, duration: 1.2, ease: "elastic.out(1, 0.45)" });
    tl.fromTo(uniforms.uFlutter, { value: 1 }, { value: 0, duration: TIMELINE.flapsDuration + 0.8 }, 0);
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
        // let the click fall through to the wax seal
        raycast={() => null}
      />
    </group>
  );
}

export default function GatefoldEnvelope() {
  return (
    <group>
      <Door side="left" />
      <Door side="right" />
    </group>
  );
}
