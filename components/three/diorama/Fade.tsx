"use client";
/**
 * Cross-dissolves a whole group of the diorama: every material inside
 * follows one opacity value, tweened when `show` changes.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

export function Fade({
  show,
  duration = 1.2,
  delay = 0,
  children,
}: {
  show: boolean;
  duration?: number;
  delay?: number;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null!);
  const v = useRef({ value: show ? 1 : 0 });
  const base = useRef(new WeakMap<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>());

  useEffect(() => {
    const tw = gsap.to(v.current, { value: show ? 1 : 0, duration, delay: show ? delay : 0, ease: "sine.inOut" });
    return () => {
      tw.kill();
    };
  }, [show, duration, delay]);

  useFrame(() => {
    const value = v.current.value;
    const g = group.current;
    g.visible = value > 0.002;
    if (!g.visible) return;
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.material) return;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        let b = base.current.get(m);
        if (!b) {
          b = { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite };
          base.current.set(m, b);
        }
        m.opacity = b.opacity * value;
        m.transparent = b.transparent || value < 0.999;
        m.depthWrite = b.depthWrite && value > 0.6;
        const u = (m as THREE.ShaderMaterial).uniforms?.uFade;
        if (u) u.value = value;
      }
    });
  });

  return <group ref={group}>{children}</group>;
}
