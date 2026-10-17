"use client";
/**
 * Backdrop (ivory linen wall + inner paper sheet), the thin foil arch frame,
 * and the fluted marble columns. Each falls back to procedural geometry when
 * no painted PNG layer is provided.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { PALETTE, TEXTURES } from "@/lib/invitation.config";
import { makeLinen, makeMarble, makePaper } from "@/lib/textures";
import { useOptionalTexture } from "@/lib/assets";
import { ARCH, FOIL } from "./layers";

// ------------------------------------------------------------ backdrop ----
export function Backdrop() {
  const linen = useMemo(() => {
    const t = makeLinen("#ebe3d7");
    t.map.repeat.set(7, 5);
    t.normalMap.repeat.set(7, 5);
    return t;
  }, []);
  const sheet = useMemo(() => makePaper({ width: 512, height: 732, paper: PALETTE.paperInner, seed: 21 }), []);
  const painted = useOptionalTexture(TEXTURES.backdrop);
  return (
    <group>
      <mesh receiveShadow position={[0, 0, -0.02]}>
        <planeGeometry args={[16, 11]} />
        <meshStandardMaterial map={linen.map} normalMap={linen.normalMap} normalScale={[0.25, 0.25]} roughness={0.95} />
      </mesh>
      {/* the inner sheet of the invitation */}
      <mesh receiveShadow castShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[2.06, 2.96, 0.012]} />
        <meshStandardMaterial
          map={painted ?? sheet.map}
          normalMap={sheet.normalMap}
          normalScale={[0.5, 0.5]}
          roughnessMap={sheet.roughnessMap}
          roughness={1}
        />
      </mesh>
    </group>
  );
}

// --------------------------------------------------------------- frame ----
function archPath(inset: number) {
  const hw = ARCH.halfW - inset;
  const pts: THREE.Vector3[] = [];
  pts.push(new THREE.Vector3(-hw, ARCH.bottom + inset, 0));
  pts.push(new THREE.Vector3(-hw, ARCH.springY, 0));
  const n = 40;
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (i / n) * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(a) * hw, ARCH.springY + Math.sin(a) * (ARCH.rise - inset), 0));
  }
  pts.push(new THREE.Vector3(hw, ARCH.springY, 0));
  pts.push(new THREE.Vector3(hw, ARCH.bottom + inset, 0));
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.02);
}

export function ArchFrame() {
  const [outer, inner] = useMemo(
    () => [new THREE.TubeGeometry(archPath(0), 400, 0.009, 8, true), new THREE.TubeGeometry(archPath(0.045), 400, 0.0045, 6, true)],
    []
  );
  const foil = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: PALETTE.foil, ...FOIL, clearcoat: 0.4, envMapIntensity: 1.4 }),
    []
  );
  return (
    <group>
      <mesh geometry={outer} material={foil} castShadow />
      <mesh geometry={inner} material={foil} castShadow />
    </group>
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
    const entasis = 1 + 0.035 * Math.sin(((y / h) + 0.5) * Math.PI);
    const nr = r * entasis * (1 - 0.055 * flute);
    p.setX(i, Math.cos(a) * nr);
    p.setZ(i, Math.sin(a) * nr);
  }
  g.computeVertexNormals();
  return g;
}

function lathe(profile: [number, number][], segs = 64) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

export const COLUMN = { height: 2.72, bottom: -1.47 };

function ProceduralColumn({ marble }: { marble: THREE.Material }) {
  const H = COLUMN.height;
  const shaftH = H - 0.42;
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
    <group position={[0, COLUMN.bottom, 0]}>
      <mesh position={[0, 0.04, 0]} castShadow receiveShadow material={marble}>
        <boxGeometry args={[0.3, 0.08, 0.3]} />
      </mesh>
      <mesh geometry={geos.base} position={[0, 0.08, 0]} castShadow receiveShadow material={marble} />
      <mesh geometry={geos.shaft} position={[0, 0.21 + shaftH / 2, 0]} castShadow receiveShadow material={marble} />
      <group position={[0, 0.21 + shaftH, 0]}>
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

export function Columns({ x }: { x: number }) {
  const left = useOptionalTexture(TEXTURES.columnLeft);
  const right = useOptionalTexture(TEXTURES.columnRight);
  const marble = useMemo(() => {
    const t = makeMarble();
    return new THREE.MeshPhysicalMaterial({
      map: t.map,
      normalMap: t.normalMap,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughness: 0.32,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      color: "#fbf7f1",
    });
  }, []);

  return (
    <group>
      {[
        { sx: -1, tex: left },
        { sx: 1, tex: right },
      ].map(({ sx, tex }) =>
        tex ? (
          <mesh key={sx} position={[sx * x, COLUMN.bottom + COLUMN.height / 2, 0]} castShadow receiveShadow>
            <planeGeometry args={[(COLUMN.height * tex.image.width) / tex.image.height, COLUMN.height]} />
            <meshStandardMaterial map={tex} alphaTest={0.5} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        ) : (
          <group key={sx} position={[sx * x, 0, 0]}>
            <ProceduralColumn marble={marble} />
          </group>
        )
      )}
    </group>
  );
}
