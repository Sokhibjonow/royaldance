"use client";
/**
 * Two white doves with separately hinged wings. The wings rotate around the
 * body axis (foreshortening toward / away from the camera) for a real flap;
 * they glide toward each other, holding a garland between their beaks.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { easing } from "maath";
import { TEXTURES } from "@/lib/invitation.config";
import { makeDove } from "@/lib/textures";
import { useOptionalTexture } from "@/lib/assets";

const BODY: [number, number] = [0.34, 0.17];
const WING: [number, number] = [0.3, 0.15];

type DoveProps = { side: -1 | 1; maps: { body: THREE.Texture; wing: THREE.Texture }; y: number; gap: number };

function Dove({ side, maps, y, gap }: DoveProps) {
  const root = useRef<THREE.Group>(null!);
  const near = useRef<THREE.Group>(null!);
  const far = useRef<THREE.Group>(null!);
  const offset = side === 1 ? 0 : 1.7;
  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ map: maps.body, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.75 }),
      wing: new THREE.MeshStandardMaterial({ map: maps.wing, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }),
      wingFar: new THREE.MeshStandardMaterial({ map: maps.wing, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: "#d9d4ce" }),
    }),
    [maps]
  );
  const wingGeo = useMemo(() => new THREE.PlaneGeometry(...WING).translate(0, WING[1] / 2, 0), []);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + offset;
    const beat = t * 7.5;
    const flap = Math.sin(beat);
    // near wing swings toward the camera, far wing away
    near.current.rotation.x = -0.25 - flap * 0.95;
    far.current.rotation.x = 0.25 + flap * 0.95;
    near.current.rotation.z = flap * 0.12;
    far.current.rotation.z = flap * 0.12;
    // the two doves glide toward each other, carrying the garland
    const tx = side * gap;
    const ty = y + Math.cos(beat) * 0.012 + Math.sin(t * 0.6) * 0.02;
    easing.damp3(root.current.position, [tx, ty, 0], 1.1, dt);
    root.current.rotation.z = side * (0.05 + Math.sin(t * 0.6) * 0.04);
  });

  return (
    // side = 1 is the right-hand dove, facing left (mirrored)
    <group ref={root} position={[side * (gap + 0.25), y, 0]} scale={[-side, 1, 1]}>
      <group ref={far} position={[0.02, 0.02, -0.01]}>
        <mesh geometry={wingGeo} material={mats.wingFar} castShadow />
      </group>
      <mesh material={mats.body} castShadow>
        <planeGeometry args={BODY} />
      </mesh>
      <group ref={near} position={[0.02, 0.02, 0.012]}>
        <mesh geometry={wingGeo} material={mats.wing} castShadow />
      </group>
    </group>
  );
}

export function Doves({ y = 1, gap = 0.25 }: { y?: number; gap?: number }) {
  const proc = useMemo(() => makeDove(), []);
  const body = useOptionalTexture(TEXTURES.doveBody);
  const wing = useOptionalTexture(TEXTURES.doveWing);
  const maps = useMemo(() => ({ body: body ?? proc.body, wing: wing ?? proc.wing }), [body, wing, proc]);
  return (
    <group>
      <Dove side={-1} maps={maps} y={y} gap={gap} />
      <Dove side={1} maps={maps} y={y} gap={gap} />
    </group>
  );
}
