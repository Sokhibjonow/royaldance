"use client";
/**
 * Two-tier marble fountain: lathe-turned basins, rippling water surfaces
 * (normal perturbation in the fragment shader) and GPU water jets
 * (parabolic droplets evaluated in the vertex shader).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { TEXTURES } from "@/lib/invitation.config";
import { makeMarble } from "@/lib/textures";
import { useOptionalTexture } from "@/lib/assets";

const P = (r: number, y: number) => new THREE.Vector2(r, y);

// y = 0 is the floor of the diorama
const LOWER_WATER = 0.155;
const UPPER_WATER = 0.555;
const HEAD = 0.7;

function rippleWater(time: { value: number }) {
  const m = new THREE.MeshPhysicalMaterial({
    color: "#cfe3e0",
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.82,
    envMapIntensity: 1.6,
    clearcoat: 1,
  });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = time;
    s.vertexShader = "varying vec2 vRipple;\n" + s.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvRipple = uv;");
    s.fragmentShader = "uniform float uTime;\nvarying vec2 vRipple;\n" + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      /* glsl */ `
      #include <normal_fragment_maps>
      {
        vec2 q = vRipple - 0.5;
        float r = length(q) * 2.0;
        float w = sin(r * 48.0 - uTime * 5.5) * 0.6 + sin(r * 23.0 - uTime * 3.1 + q.x * 9.0) * 0.4;
        vec2 dir = normalize(q + 1e-5);
        normal = normalize(normal + vec3(dir * w * 0.22 * (1.0 - r * 0.4), 0.0));
      }`
    );
  };
  m.customProgramCacheKey = () => "ripple-water";
  return m;
}

function jets(time: { value: number }) {
  const n = 900;
  const seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const cascade = i % 3 === 0 ? 1 : 0; // 1/3 spill from the upper bowl rim
    seed.set([Math.random() * Math.PI * 2, 0.85 + Math.random() * 0.3, Math.random(), cascade], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: time, uSize: { value: 11 } },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uSize;
      varying float vFade;
      void main() {
        float a = aSeed.x;
        float speed = aSeed.y;
        float cascade = aSeed.w;
        float life = mix(0.62, 0.55, cascade);
        float t = fract(uTime * 0.9 + aSeed.z) * life;
        vec3 dir = vec3(cos(a), 0.0, sin(a));
        vec3 p;
        if (cascade < 0.5) {
          // crown jets from the finial into the upper bowl
          p = vec3(0.0, ${HEAD.toFixed(3)}, 0.0) + dir * 0.28 * speed * t + vec3(0.0, 1.3 * speed * t - 4.9 * t * t, 0.0);
          p.y = max(p.y, ${UPPER_WATER.toFixed(3)});
        } else {
          // sheet spilling over the upper rim into the lower basin
          p = vec3(0.0, ${UPPER_WATER.toFixed(3)}, 0.0) + dir * (0.2 + 0.18 * speed * t) + vec3(0.0, -2.2 * t * t, 0.0);
          p.y = max(p.y, ${LOWER_WATER.toFixed(3)});
        }
        vFade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(life * 0.7, life, t));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.6 + speed * 0.4) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.9, 0.96, 1.0), a * vFade * 0.32);
      }`,
  });
  return new THREE.Points(g, m);
}

export function Fountain({ position }: { position: [number, number, number] }) {
  const painted = useOptionalTexture(TEXTURES.fountain);
  const time = useMemo(() => ({ value: 0 }), []);
  const parts = useMemo(() => {
    const t = makeMarble(29);
    const marble = new THREE.MeshPhysicalMaterial({
      map: t.map,
      normalMap: t.normalMap,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughness: 0.3,
      clearcoat: 0.4,
      color: "#fbf7f1",
      side: THREE.DoubleSide,
    });
    const lower = new THREE.LatheGeometry(
      [P(0, 0), P(0.2, 0), P(0.24, 0.03), P(0.42, 0.06), P(0.45, 0.1), P(0.46, 0.17), P(0.43, 0.18), P(0.41, 0.1), P(0, 0.1)],
      72
    );
    const stem = new THREE.LatheGeometry(
      [P(0, 0.1), P(0.07, 0.1), P(0.05, 0.16), P(0.045, 0.3), P(0.065, 0.36), P(0.04, 0.42), P(0.04, 0.48), P(0, 0.48)],
      48
    );
    const upper = new THREE.LatheGeometry(
      [P(0, 0.46), P(0.05, 0.46), P(0.17, 0.52), P(0.2, 0.575), P(0.185, 0.58), P(0.165, 0.535), P(0, 0.53)],
      64
    );
    const finial = new THREE.LatheGeometry(
      [P(0, 0.53), P(0.03, 0.53), P(0.02, 0.6), P(0.035, 0.64), P(0.015, 0.69), P(0, 0.71)],
      32
    );
    return { marble, lower, stem, upper, finial, water: rippleWater(time), spray: jets(time) };
  }, [time]);

  useFrame(({ clock }) => {
    time.value = clock.elapsedTime;
  });

  if (painted) {
    const h = 0.85;
    return (
      <group position={position}>
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <planeGeometry args={[(h * painted.image.width) / painted.image.height, h]} />
          <meshStandardMaterial map={painted} alphaTest={0.5} roughness={0.4} />
        </mesh>
        <primitive object={parts.spray} />
      </group>
    );
  }

  return (
    <group position={position}>
      <mesh geometry={parts.lower} material={parts.marble} castShadow receiveShadow />
      <mesh geometry={parts.stem} material={parts.marble} castShadow receiveShadow />
      <mesh geometry={parts.upper} material={parts.marble} castShadow receiveShadow />
      <mesh geometry={parts.finial} material={parts.marble} castShadow />
      <mesh material={parts.water} position={[0, LOWER_WATER, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[0.425, 64]} />
      </mesh>
      <mesh material={parts.water} position={[0, UPPER_WATER, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.18, 48]} />
      </mesh>
      <primitive object={parts.spray} />
    </group>
  );
}
