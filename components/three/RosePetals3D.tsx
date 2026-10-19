"use client";
/**
 * RosePetals3D.tsx — instanced, curved 3D rose petals tumbling on all three
 * axes through the whole depth of the scene (behind and in front of the
 * text, right up to the lens where depth of field melts them into bokeh).
 *
 * Physics per petal: gravity, quadratic air drag, flutter lift that depends
 * on the petal's orientation, a curl-like wind field, and gusts from
 * pointer movement / scrolling / slide changes.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PALETTE } from "@/lib/invitation.config";
import { input, useInvitation } from "@/lib/store";
import { rig } from "@/lib/rig";
import { makeLeaf, makePetal, mulberry32 } from "@/lib/textures";

type Petal = {
  p: THREE.Vector3;
  v: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  size: number;
  phase: number;
};

function petalGeometry() {
  const g = new THREE.PlaneGeometry(1, 1.1, 10, 10);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i) + 0.55;
    // cupped across, curled at the tip, slight twist
    p.setZ(i, 0.42 * x * x + 0.18 * Math.pow(y, 3) - 0.12 * y * x);
    p.setY(i, y - 0.55);
  }
  g.computeVertexNormals();
  return g;
}

export default function RosePetals3D({ count = 80, leaves = false }: { count?: number; leaves?: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const phase = useInvitation((s) => s.phase);
  const { camera } = useThree();
  const geo = useMemo(petalGeometry, []);
  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: leaves ? makeLeaf() : makePetal(),
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.55,
        sheen: 1,
        sheenRoughness: 0.4,
        sheenColor: new THREE.Color(leaves ? "#eef2e4" : "#ffe4e4"),
        // velvety petals let some light through
        transmission: 0,
        thickness: 0.05,
      }),
    [leaves]
  );

  const petals = useMemo<Petal[]>(() => {
    const rnd = mulberry32(leaves ? 99 : 2024);
    return Array.from({ length: count }, () => ({
      p: new THREE.Vector3((rnd() - 0.5) * 5, (rnd() - 0.5) * 6, -0.9 + rnd() * 2.6),
      v: new THREE.Vector3(0, -0.1, 0),
      rot: new THREE.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3),
      spin: new THREE.Vector3((rnd() - 0.5) * 3, (rnd() - 0.5) * 3, (rnd() - 0.5) * 2),
      size: leaves ? 0.03 + rnd() * 0.02 : 0.026 + rnd() * 0.022,
      phase: rnd() * 100,
    }));
  }, [count]);

  useLayoutEffect(() => {
    const c = new THREE.Color();
    petals.forEach((_, i) => {
      const list = leaves ? PALETTE.leaf : PALETTE.petal;
      c.set(list[i % list.length]);
      mesh.current.setColorAt(i, c);
    });
    mesh.current.instanceColor!.needsUpdate = true;
  }, [petals]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), n: new THREE.Vector3() }),
    []
  );

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = clock.elapsedTime;
    const open = phase !== "idle" ? 1 : 0;
    input.gust *= Math.exp(-dt * 1.2);
    const gust = input.gust;
    const cy = rig.look.y;
    const camZ = camera.position.z;
    // no petals on the closed card; they start drifting once it opens
    const active = phase === "idle" ? 0 : phase === "opening" ? Math.floor(count * 0.3) : count;

    for (let i = 0; i < count; i++) {
      const P = petals[i];
      if (i >= active) {
        tmp.m.makeScale(0, 0, 0);
        mesh.current.setMatrixAt(i, tmp.m);
        continue;
      }
      // orientation-dependent flutter: a flat petal (normal ~ up) catches air
      tmp.n.set(0, 0, 1).applyEuler(P.rot);
      const flat = Math.abs(tmp.n.y);
      const wx =
        Math.sin(P.p.y * 0.9 + t * 0.45 + P.phase) * 0.22 +
        Math.sin(P.p.z * 1.7 + t * 0.3) * 0.12 +
        input.vx * 0.12 +
        gust * 0.45 * Math.sin(P.phase);
      const wy = Math.cos(P.p.x * 0.8 + t * 0.35) * 0.08 + input.vy * 0.08 + gust * 0.15;
      const wz = Math.sin(P.p.x * 1.3 + t * 0.4 + P.phase) * 0.12 + gust * 0.12 * Math.cos(P.phase);
      // forces
      P.v.x += (wx - P.v.x) * dt * 1.6;
      P.v.z += (wz - P.v.z) * dt * 1.6;
      P.v.y += (-0.32 + flat * 0.22 + wy) * dt;
      P.v.y += Math.sin(t * 3 + P.phase) * 0.12 * dt; // side-slip oscillation
      P.v.multiplyScalar(1 - dt * (0.6 + flat * 0.9)); // drag
      P.p.addScaledVector(P.v, dt);
      // tumbling — speeds up with wind
      const spinBoost = 1 + gust * 0.6 + Math.hypot(input.vx, input.vy) * 0.15;
      P.rot.x += P.spin.x * dt * spinBoost;
      P.rot.y += P.spin.y * dt * spinBoost;
      P.rot.z += P.spin.z * dt * spinBoost;

      // recycle above the frame when it leaves the volume
      const bottom = cy - 2.6;
      if (P.p.y < bottom || Math.abs(P.p.x) > 3.2 || P.p.z > camZ - 0.25) {
        P.p.set((Math.random() - 0.5) * 4.6, cy + 2.2 + Math.random() * 0.8, -0.9 + Math.random() * (open ? 2.5 : 1.6));
        P.v.set(0, -0.05, 0);
      }

      tmp.q.setFromEuler(P.rot);
      tmp.s.setScalar(P.size);
      tmp.m.compose(P.p, tmp.q, tmp.s);
      mesh.current.setMatrixAt(i, tmp.m);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, count]} castShadow frustumCulled={false} />;
}
