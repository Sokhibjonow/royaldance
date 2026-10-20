"use client";
/**
 * The five text pages, typeset on <canvas> (so the browser shapes the
 * Arabic script and joins its letters properly) and shown on planes at the
 * Z = +0.8 layer. Each page focuses in from a 10px-style blur and blurs out
 * again, like the reference film — the blur runs in the shader, so only the
 * text softens while the scene behind stays crisp.
 */
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { INVITATION, PALETTE, TIMELINE } from "@/lib/invitation.config";
import { useInvitation } from "@/lib/store";

// canvas page = the visible 9:16 page at the text plane
const PAGE_W = 1.9;
const PAGE_H = 3.38;
const PX = 1100; // canvas width in px
const PY = Math.round((PX * PAGE_H) / PAGE_W);
const AR = '"Amiri", serif';
const RU = '"Cormorant", Georgia, serif';

type Draw = (ctx: CanvasRenderingContext2D) => void;

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, font: string, opts: { rtl?: boolean; color?: string; weight?: number; lineHeight?: number } = {}) {
  ctx.font = `${opts.weight ?? 500} ${size}px ${font}`;
  ctx.fillStyle = opts.color ?? PALETTE.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = opts.rtl ? "rtl" : "ltr";
  ctx.shadowColor = "rgba(255,255,255,0.75)";
  ctx.shadowOffsetY = Math.max(1, size * 0.03);
  ctx.shadowBlur = 0;
  s.split("\n").forEach((line, i) => ctx.fillText(line, x, y + i * size * (opts.lineHeight ?? 1.45)));
  ctx.shadowColor = "transparent";
}

/** y as a fraction of the page height → canvas px */
const fy = (f: number) => f * PY;
const fx = (f: number) => f * PX;
const I = INVITATION;

function clockIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.moveTo(x, y - r * 0.6);
  ctx.lineTo(x, y);
  ctx.lineTo(x + r * 0.45, y + r * 0.3);
  ctx.stroke();
}

function pinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.1);
  ctx.bezierCurveTo(x - r * 1.2, y - r * 0.1, x - r * 0.8, y - r * 1.2, x, y - r * 1.2);
  ctx.bezierCurveTo(x + r * 0.8, y - r * 1.2, x + r * 1.2, y - r * 0.1, x, y + r * 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - r * 0.35, r * 0.35, 0, Math.PI * 2);
  ctx.stroke();
}

const PAGES: Draw[] = [
  // 1 — Bismillah
  (ctx) => text(ctx, I.bismillah, fx(0.5), fy(0.5), 92, AR, { rtl: true, weight: 400 }),
  // 2 — With love & gratitude
  (ctx) => {
    if (I.love.ar) text(ctx, I.love.ar, fx(0.55), fy(0.475), 58, AR, { rtl: true });
    text(ctx, I.love.ru, fx(0.55), fy(0.515), 55, RU, { weight: 600 });
  },
  // 3 — Invitation
  (ctx) => {
    let y = 0.43;
    if (I.invite.ar) {
      text(ctx, I.invite.ar, fx(0.55), fy(y), 55, AR, { rtl: true, lineHeight: 1.25 });
      y += 0.055 + 0.022 * I.invite.ar.split("\n").length;
    }
    text(ctx, I.invite.ru, fx(0.55), fy(y), 46, RU, { weight: 600, lineHeight: 1.3 });
  },
  // 4 — Monogram, date, names, dua
  (ctx) => {
    text(ctx, I.date, fx(0.5), fy(0.515), 38, RU, { weight: 600 });
    ctx.font = `600 66px ${RU}`;
    const gw = 70;
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.ink;
    ctx.textBaseline = "middle";
    ctx.fillText(I.groom, fx(0.5) - gw / 2, fy(0.555));
    ctx.textAlign = "left";
    ctx.fillText(I.bride, fx(0.5) + gw / 2, fy(0.555));
    ctx.fillRect(fx(0.5) - 1, fy(0.555) - 26, 2, 52);
    if (I.dua) text(ctx, I.dua, fx(0.5), fy(0.605), 50, AR, { rtl: true });
  },
  // 5 — Time & place, "your presence…"
  (ctx) => {
    ctx.font = `600 54px ${RU}`;
    ctx.fillStyle = PALETTE.ink;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillText(I.groom, fx(0.5) - 30, fy(0.3));
    ctx.textAlign = "left";
    ctx.fillText(I.bride, fx(0.5) + 30, fy(0.3));
    ctx.fillRect(fx(0.5) - 1, fy(0.3) - 20, 2, 40);
    text(ctx, I.date, fx(0.5), fy(0.328), 35, RU, { weight: 600 });
    clockIcon(ctx, fx(0.29), fy(0.392), 18);
    text(ctx, I.time, fx(0.29) + 80, fy(0.392), 45, RU, { weight: 600 });
    pinIcon(ctx, fx(0.6), fy(0.392), 18);
    ctx.font = `600 44px ${RU}`;
    ctx.textAlign = "left";
    ctx.fillText(I.venue, fx(0.6) + 28, fy(0.392));
    ctx.fillText(I.venueSub, fx(0.6) + 28, fy(0.392) + 54);
    if (I.presence.ar) text(ctx, I.presence.ar, fx(0.5), fy(0.488), 52, AR, { rtl: true });
    text(ctx, I.presence.ru, fx(0.5), fy(0.522), 45, RU, { weight: 600, lineHeight: 1.6 });
  },
];

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** 24-tap golden-angle disc blur on a premultiplied texture. */
const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float uBlur;
  uniform float uOpacity;
  uniform vec2 uAspect;
  varying vec2 vUv;
  void main() {
    vec4 acc = texture2D(map, vUv);
    if (uBlur > 0.0005) {
      acc = vec4(0.0);
      for (int i = 0; i < 24; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / 24.0) * uBlur;
        float a = fi * 2.39996;
        acc += texture2D(map, vUv + vec2(cos(a), sin(a)) * r * uAspect);
      }
      acc /= 24.0;
    }
    if (acc.a * uOpacity < 0.04) discard;
    gl_FragColor = acc * uOpacity;
    #include <colorspace_fragment>
  }
`;

function usePageTexture(draw: Draw) {
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      document.fonts.load(`74px "Amiri"`, "بسم"),
      document.fonts.load(`600 40px "Cormorant"`, "Аа"),
      document.fonts.load(`80px "Great Vibes"`, "AM"),
    ])
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        const c = document.createElement("canvas");
        c.width = PX;
        c.height = PY;
        draw(c.getContext("2d")!);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.premultiplyAlpha = true;
        t.anisotropy = 8;
        setTex(t);
      });
    return () => {
      alive = false;
    };
  }, [draw]);
  return tex;
}

function Page({ index, draw, onClick }: { index: number; draw: Draw; onClick?: () => void }) {
  const slide = useInvitation((s) => s.slide);
  const phase = useInvitation((s) => s.phase);
  const tex = usePageTexture(draw);
  const mesh = useRef<THREE.Mesh>(null!);
  const state = useRef({ opacity: 0, blur: 0.02 });
  const active = phase !== "idle" && slide === index;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: null },
          uBlur: { value: 0.02 },
          uOpacity: { value: 0 },
          uAspect: { value: new THREE.Vector2(1, PX / PY) },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: true,
      }),
    []
  );

  useEffect(() => {
    material.uniforms.map.value = tex;
  }, [tex, material]);

  useEffect(() => {
    const s = state.current;
    gsap.killTweensOf(s);
    if (active) {
      // first page waits for the doors; later pages wait for the previous one to blur away
      const delay = phase === "opening" ? TIMELINE.contentIn - 0.4 : index === 1 ? 1.1 : 0.75;
      gsap.fromTo(s, { blur: 0.022, opacity: 0 }, { blur: 0, opacity: 1, duration: 1.3, delay, ease: "power2.out" });
    } else if (s.opacity > 0) {
      gsap.to(s, { blur: 0.02, opacity: 0, duration: 0.75, ease: "power1.in" });
    }
  }, [active, phase, index]);

  useFrame(() => {
    const s = state.current;
    material.uniforms.uBlur.value = s.blur;
    material.uniforms.uOpacity.value = s.opacity;
    mesh.current.visible = s.opacity > 0.002 && !!tex;
  });

  return (
    <mesh
      ref={mesh}
      material={material}
      onClick={active && onClick ? onClick : undefined}
      onPointerOver={() => active && onClick && (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
      raycast={active && onClick ? THREE.Mesh.prototype.raycast : () => null}
    >
      <planeGeometry args={[PAGE_W, PAGE_H]} />
    </mesh>
  );
}

/**
 * The monogram as real polished silver: SDF text with a metallic physical
 * material, so the studio light cards and a sweeping glint light run across
 * the letters as the camera drifts.
 */
function Monogram3D() {
  const slide = useInvitation((s) => s.slide);
  const phase = useInvitation((s) => s.phase);
  const group = useRef<THREE.Group>(null!);
  const glint = useRef<THREE.PointLight>(null!);
  const vis = useRef({ value: 0 });
  const active = phase === "open" && slide === 3;
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#c9c8c6",
        metalness: 1,
        roughness: 0.24,
        clearcoat: 0.6,
        clearcoatRoughness: 0.15,
        envMapIntensity: 2.2,
        transparent: true,
        opacity: 0,
      }),
    []
  );

  useEffect(() => {
    gsap.killTweensOf(vis.current);
    gsap.to(vis.current, { value: active ? 1 : 0, duration: active ? 1.6 : 0.7, delay: active ? 0.75 : 0, ease: active ? "power2.out" : "power1.in" });
    if (!active) return;
    const l = glint.current;
    const tl = gsap.timeline({ delay: 1.1 });
    tl.set(l.position, { x: -1.1 })
      .to(l, { intensity: 3.5, duration: 0.5 }, 0)
      .to(l.position, { x: 1.1, duration: 2.6, ease: "sine.inOut" }, 0)
      .to(l, { intensity: 0, duration: 0.6 }, 2.1);
    return () => {
      tl.kill();
    };
  }, [active]);

  useFrame(({ clock }) => {
    const v = vis.current.value;
    group.current.visible = v > 0.002;
    material.opacity = v;
    // rises out of the paper and turns gently so the metal catches the light
    group.current.position.z = (1 - v) * -0.08 + 0.02;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.12;
    group.current.rotation.x = Math.sin(clock.elapsedTime * 0.37) * 0.05;
    const s = 0.94 + v * 0.06;
    group.current.scale.set(s, s, s);
  });

  return (
    <group position={[0, PAGE_H * (0.5 - 0.36), 0]}>
      <pointLight ref={glint} position={[-1.1, 0.1, 0.45]} intensity={0} distance={1.8} decay={1.2} color="#ffffff" />
      <group ref={group}>
        <Text font={FONTS_3D.script} fontSize={0.62} anchorX="center" anchorY="middle" material={material} castShadow>
          {I.initials}
        </Text>
      </group>
    </group>
  );
}

// troika parses fonts inside a blob: worker, so URLs must be absolute
const abs = (p: string) => (typeof window === "undefined" ? p : new URL(p, window.location.href).href);
const FONTS_3D = { script: abs("/fonts/GreatVibes.woff") };

export function Slides() {
  const openMap = () => window.open(`https://maps.google.com/?q=${encodeURIComponent(I.mapQuery)}`, "_blank", "noopener");
  return (
    <group>
      {PAGES.map((draw, i) => (
        <Page key={i} index={i} draw={draw} onClick={i === 4 ? openMap : undefined} />
      ))}
      <Monogram3D />
    </group>
  );
}
