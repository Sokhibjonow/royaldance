"use client";
/**
 * Backdrop wall, the painted page frame, and cream marble columns wrapped
 * in climbing roses. Each falls back to procedural art when no painted PNG
 * layer is provided.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE, TEXTURES } from "@/lib/invitation.config";
import { makeMarble, makePaper } from "@/lib/textures";
import { canvasTexture, drawFrame } from "@/lib/illustrations";
import { useOptionalTexture } from "@/lib/assets";
import { RoseField, type LeafSpec, type RoseSpec } from "./Roses";
import { mulberry32 } from "@/lib/textures";

// ------------------------------------------------------------ backdrop ----
export function Backdrop() {
  const paper = useMemo(() => {
    const p = makePaper({ width: 1024, height: 1024, paper: PALETTE.wall, seed: 21 });
    for (const t of [p.map, p.normalMap, p.roughnessMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 3);
    }
    return p;
  }, []);
  const painted = useOptionalTexture(TEXTURES.backdrop);
  return (
    <mesh receiveShadow position={[0, 0, -0.02]}>
      <planeGeometry args={[16, 11]} />
      <meshStandardMaterial
        map={painted ?? paper.map}
        normalMap={paper.normalMap}
        normalScale={[0.3, 0.3]}
        roughnessMap={paper.roughnessMap}
        roughness={1}
      />
    </mesh>
  );
}

// --------------------------------------------------------- page frame ----
/** Watercolour rose frame. `lush` = fuller version used from the monogram page on. */
export function PaintedFrame({ width, height, lush }: { width: number; height: number; lush: boolean }) {
  const painted = useOptionalTexture(TEXTURES.frame);
  const map = useMemo(() => canvasTexture(drawFrame(lush)), [lush]);
  return (
    <mesh receiveShadow raycast={() => null}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={painted ?? map} transparent alphaTest={0.02} roughness={0.95} depthWrite={false} />
    </mesh>
  );
}

// ------------------------------------------------------------- columns ----
function flutedShaft(h: number, rBottom: number, rTop: number) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 160, 24, true);
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z);
    // 20 concave flutes + gentle entasis
    const flute = Math.pow(Math.max(0, Math.cos(a * 10)), 0.6);
    const entasis = 1 + 0.035 * Math.sin((y / h + 0.5) * Math.PI);
    const nr = r * entasis * (1 - 0.055 * flute);
    p.setX(i, Math.cos(a) * nr);
    p.setZ(i, Math.sin(a) * nr);
  }
  g.computeVertexNormals();
  return g;
}

function lathe(profile: [number, number][], segs = 64) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segs
  );
}

type ColumnProps = { height: number; bottom: number };

function ProceduralColumn({ marble, height, bottom }: ColumnProps & { marble: THREE.Material }) {
  const shaftH = height - 0.5;
  const geos = useMemo(() => {
    const base = lathe([
      [0, 0],
      [0.13, 0],
      [0.13, 0.03],
      [0.118, 0.045],
      [0.125, 0.07],
      [0.11, 0.09],
      [0.1, 0.1],
      [0.105, 0.115],
      [0.092, 0.13],
      [0, 0.13],
    ]);
    const echinus = lathe([
      [0, 0],
      [0.082, 0],
      [0.09, 0.012],
      [0.1, 0.03],
      [0.122, 0.06],
      [0.13, 0.075],
      [0, 0.075],
    ]);
    return { base, shaft: flutedShaft(shaftH, 0.088, 0.078), echinus };
  }, [shaftH]);
  return (
    <group position={[0, bottom, 0]}>
      {/* pedestal */}
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow material={marble}>
        <boxGeometry args={[0.32, 0.18, 0.3]} />
      </mesh>
      <mesh geometry={geos.base} position={[0, 0.18, 0]} castShadow receiveShadow material={marble} />
      <mesh geometry={geos.shaft} position={[0, 0.31 + shaftH / 2, 0]} castShadow receiveShadow material={marble} />
      <group position={[0, 0.31 + shaftH, 0]}>
        <mesh geometry={geos.echinus} castShadow receiveShadow material={marble} />
        {/* Ionic volutes */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.13, 0.06, 0.05]} rotation={[0, 0, s * 0.3]} castShadow material={marble}>
            <torusGeometry args={[0.035, 0.014, 12, 32, Math.PI * 1.6]} />
          </mesh>
        ))}
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow material={marble}>
          <boxGeometry args={[0.32, 0.045, 0.3]} />
        </mesh>
      </group>
    </group>
  );
}

/** Rose vine spiralling up the front of a column. */
function climbingRoses(height: number, bottom: number, seed: number) {
  const rnd = mulberry32(seed);
  const roses: RoseSpec[] = [];
  const leaves: LeafSpec[] = [];
  const colors = ["#f1d2ca", "#ead0c6", "#f6e3da", "#e3b6ae"];
  const n = 70;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const a = t * Math.PI * 5.5 + seed;
    const front = Math.cos(a); // only the half facing the camera
    if (front < -0.2) continue;
    const r = 0.1;
    const p: [number, number, number] = [Math.sin(a) * r, bottom + 0.3 + t * (height - 0.35), 0.03 + front * r];
    leaves.push({ p, s: 0.05 + rnd() * 0.03, rot: a + (rnd() - 0.5) * 2, tiltX: 0.3 });
    if (i % 5 === 0) roses.push({ p: [p[0], p[1], p[2] + 0.02], s: 0.035 + rnd() * 0.02, color: colors[i % colors.length] });
  }
  return { roses, leaves };
}

export function Column({
  x,
  height,
  bottom,
  vineSeed = 3,
  side = "left",
}: ColumnProps & { x: number; vineSeed?: number; side?: "left" | "right" }) {
  const tex = useOptionalTexture(side === "left" ? TEXTURES.columnLeft : TEXTURES.columnRight);
  const marble = useMemo(() => {
    const t = makeMarble();
    return new THREE.MeshPhysicalMaterial({
      map: t.map,
      normalMap: t.normalMap,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughness: 0.45,
      clearcoat: 0.2,
      color: PALETTE.marble,
    });
  }, []);
  const vine = useMemo(() => climbingRoses(height, bottom, vineSeed), [height, bottom, vineSeed]);

  if (tex) {
    return (
      <mesh position={[x, bottom + height / 2, 0]} castShadow receiveShadow>
        <planeGeometry args={[(height * tex.image.width) / tex.image.height, height]} />
        <meshStandardMaterial map={tex} alphaTest={0.5} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  return (
    <group position={[x, 0, 0]}>
      <ProceduralColumn marble={marble} height={height} bottom={bottom} />
      <RoseField roses={vine.roses} leaves={vine.leaves} />
    </group>
  );
}
