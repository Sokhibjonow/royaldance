"use client";
/**
 * Procedural 3D roses: each bloom is a spiral of cupped, alpha-cut petals
 * (one InstancedMesh for every rose in the scene) plus instanced sage leaves.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { makeLeaf, makePetal, mulberry32 } from "@/lib/textures";

export type RoseSpec = { p: [number, number, number]; s: number; color: string; tilt?: [number, number] };
export type LeafSpec = { p: [number, number, number]; s: number; rot: number; tiltX?: number };

const PETALS_PER_ROSE = 17;

function cuppedPlane(w: number, h: number, cup: number, curl: number) {
  const g = new THREE.PlaneGeometry(w, h, 8, 8);
  g.translate(0, h / 2, 0);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const y = p.getY(i) / h;
    // edges cup inward, tip rolls back
    p.setZ(i, cup * x * x * (0.3 + y) - curl * y * y * y);
  }
  g.computeVertexNormals();
  return g;
}

export function RoseField({ roses, leaves = [] }: { roses: RoseSpec[]; leaves?: LeafSpec[] }) {
  const petalMesh = useRef<THREE.InstancedMesh>(null!);
  const leafMesh = useRef<THREE.InstancedMesh>(null!);
  const petalGeo = useMemo(() => cuppedPlane(1, 1, 0.22, 0.12), []);
  const leafGeo = useMemo(() => cuppedPlane(0.6, 1, 0.08, -0.08), []);
  const petalMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: makePetal(),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.62,
        sheen: 0.9,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color("#ffffff"),
      }),
    []
  );
  const leafMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: makeLeaf(),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        color: "#a7b39a",
        roughness: 0.7,
      }),
    []
  );

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const tmp = new THREE.Matrix4();
    const col = new THREE.Color();
    const rnd = mulberry32(roses.length * 13 + 7);
    let k = 0;
    for (const r of roses) {
      const base = new THREE.Matrix4()
        .makeTranslation(...r.p)
        .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r.tilt?.[0] ?? 0, r.tilt?.[1] ?? 0, rnd() * 6.28)))
        .multiply(new THREE.Matrix4().makeScale(r.s, r.s, r.s));
      for (let i = 0; i < PETALS_PER_ROSE; i++) {
        const t = i / (PETALS_PER_ROSE - 1);
        const angle = i * 2.39996; // golden angle spiral
        const open = THREE.MathUtils.lerp(0.12, 1.25, Math.pow(t, 1.3)); // inner petals closed
        const size = THREE.MathUtils.lerp(0.42, 1.0, t);
        m.copy(base)
          .multiply(tmp.makeRotationZ(angle))
          .multiply(tmp.makeTranslation(0, 0.08 * t, 0.06 * (1 - t)))
          .multiply(tmp.makeRotationX(Math.PI / 2 - open))
          .multiply(tmp.makeScale(size * 0.62, size * 0.62, size * 0.62));
        petalMesh.current.setMatrixAt(k, m);
        // centre of the bloom slightly deeper in tone
        col.set(r.color).multiplyScalar(THREE.MathUtils.lerp(0.82, 1.04, t));
        petalMesh.current.setColorAt(k, col);
        k++;
      }
    }
    petalMesh.current.count = k;
    petalMesh.current.instanceMatrix.needsUpdate = true;
    if (petalMesh.current.instanceColor) petalMesh.current.instanceColor.needsUpdate = true;
    petalMesh.current.computeBoundingSphere();

    leaves.forEach((l, i) => {
      m.compose(
        new THREE.Vector3(...l.p),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(l.tiltX ?? 0.4, 0, l.rot)),
        new THREE.Vector3(l.s, l.s, l.s)
      );
      leafMesh.current.setMatrixAt(i, m);
    });
    leafMesh.current.count = leaves.length;
    leafMesh.current.instanceMatrix.needsUpdate = true;
    leafMesh.current.computeBoundingSphere();
  }, [roses, leaves]);

  return (
    <group>
      <instancedMesh
        ref={petalMesh}
        args={[petalGeo, petalMat, roses.length * PETALS_PER_ROSE]}
        castShadow
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh ref={leafMesh} args={[leafGeo, leafMat, Math.max(1, leaves.length)]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
}

const ROSE_COLORS = ["#e9aaa6", "#f5e2cf", "#d98d93", "#f0bfa6", "#f7d6d0", "#c97a85"];

/** A loose cluster of blooms + leaves around a point, for garlands. */
export function cluster(
  cx: number,
  cy: number,
  cz: number,
  n: number,
  spread: number,
  seed: number,
  size = 0.075
): { roses: RoseSpec[]; leaves: LeafSpec[] } {
  const rnd = mulberry32(seed);
  const roses: RoseSpec[] = [];
  const leaves: LeafSpec[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * spread;
    roses.push({
      p: [cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, cz + rnd() * 0.05],
      s: size * (0.65 + rnd() * 0.6),
      color: ROSE_COLORS[Math.floor(rnd() * ROSE_COLORS.length)],
      tilt: [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7],
    });
  }
  for (let i = 0; i < n * 2; i++) {
    const a = rnd() * Math.PI * 2;
    const d = spread * (0.6 + rnd() * 0.7);
    leaves.push({
      p: [cx + Math.cos(a) * d * 0.8, cy + Math.sin(a) * d * 0.6, cz - 0.02],
      s: 0.07 + rnd() * 0.05,
      rot: a - Math.PI / 2 + (rnd() - 0.5) * 0.6,
      tiltX: 0.2 + rnd() * 0.5,
    });
  }
  return { roses, leaves };
}

export function mergeClusters(list: { roses: RoseSpec[]; leaves: LeafSpec[] }[]) {
  return { roses: list.flatMap((c) => c.roses), leaves: list.flatMap((c) => c.leaves) };
}
