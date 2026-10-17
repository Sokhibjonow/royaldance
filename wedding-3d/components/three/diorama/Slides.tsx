"use client";
/**
 * The five story beats, typeset in 3D (troika SDF text) on the Z = +0.8 layer.
 * Headlines are foil-stamped (metalness 0.85 / roughness 0.2) and catch a
 * travelling "glint" light; body copy is printed ink. Slides dissolve in while
 * the depth of field racks focus from the petals back onto the text.
 */
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { INVITATION, PALETTE, TIMELINE } from "@/lib/invitation.config";
import { useInvitation } from "@/lib/store";
import { FOIL } from "./layers";

// troika parses fonts inside a blob: worker, so URLs must be absolute
const abs = (p: string) => (typeof window === "undefined" ? p : new URL(p, window.location.href).href);
const FONTS = {
  script: abs("/fonts/GreatVibes.woff"),
  serif: abs("/fonts/Cormorant.woff"),
  italic: abs("/fonts/Cormorant-Italic.woff"),
};

type Mats = { foil: THREE.MeshPhysicalMaterial; ink: THREE.MeshStandardMaterial; soft: THREE.MeshStandardMaterial };

function useSlideMaterials(): Mats {
  return useMemo(
    () => ({
      foil: new THREE.MeshPhysicalMaterial({
        color: PALETTE.foil,
        ...FOIL,
        envMapIntensity: 1.4,
        transparent: true,
        opacity: 0,
      }),
      ink: new THREE.MeshStandardMaterial({ color: PALETTE.ink, roughness: 0.85, transparent: true, opacity: 0 }),
      soft: new THREE.MeshStandardMaterial({ color: "#7d6656", roughness: 0.9, transparent: true, opacity: 0 }),
    }),
    []
  );
}

function Divider({ y, mats, w = 0.5 }: { y: number; mats: Mats; w?: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh material={mats.foil} position={[-w / 2 - 0.03, 0, 0]}>
        <boxGeometry args={[w, 0.004, 0.002]} />
      </mesh>
      <mesh material={mats.foil} position={[w / 2 + 0.03, 0, 0]}>
        <boxGeometry args={[w, 0.004, 0.002]} />
      </mesh>
      <mesh material={mats.foil} rotation-z={Math.PI / 4}>
        <boxGeometry args={[0.022, 0.022, 0.003]} />
      </mesh>
    </group>
  );
}

function Slide({ index, children, mats }: { index: number; children: React.ReactNode; mats: Mats }) {
  const slide = useInvitation((s) => s.slide);
  const phase = useInvitation((s) => s.phase);
  const group = useRef<THREE.Group>(null!);
  const vis = useRef({ value: 0 });
  const active = phase !== "idle" && slide === index;

  useEffect(() => {
    gsap.killTweensOf(vis.current);
    if (active) {
      const delay = phase === "opening" ? TIMELINE.contentIn : 0.95;
      gsap.to(vis.current, { value: 1, duration: 1.6, delay, ease: "power2.out" });
    } else {
      gsap.to(vis.current, { value: 0, duration: 0.7, ease: "power2.in" });
    }
  }, [active, phase]);

  useFrame(() => {
    const v = vis.current.value;
    group.current.visible = v > 0.001;
    mats.foil.opacity = v;
    mats.ink.opacity = v;
    mats.soft.opacity = v * 0.9;
    // drifts up into place and "breathes in" from slight depth
    group.current.position.y = (1 - v) * -0.05;
    group.current.position.z = (1 - v) * -0.08;
    const s = 0.97 + v * 0.03;
    group.current.scale.set(s, s, s);
  });

  return <group ref={group}>{children}</group>;
}

/**
 * Arabic calligraphy needs contextual letter joining, which troika's SDF
 * typesetter does not do for every font. The browser's own text shaper does,
 * so we set the line on a canvas and use it as the alpha (and bump) of a
 * foil plane — it still catches the light like real hot-foil stamping.
 */
function ArabicFoil({
  text,
  height,
  position,
  material,
}: {
  text: string;
  height: number;
  position: [number, number, number];
  material: THREE.MeshPhysicalMaterial;
}) {
  const [aspect, setAspect] = useState(4);
  const mat = useMemo(() => material.clone(), [material]);
  useEffect(() => {
    let alive = true;
    document.fonts.load('140px "Amiri"', text).finally(() => {
      if (!alive) return;
      const H = 256;
      const c = document.createElement("canvas");
      const ctx = c.getContext("2d")!;
      ctx.font = `${H * 0.55}px "Amiri", serif`;
      const w = Math.ceil(ctx.measureText(text).width + H * 0.4);
      c.width = w;
      c.height = H;
      ctx.font = `${H * 0.55}px "Amiri", serif`;
      ctx.direction = "rtl";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(text, w / 2, H * 0.55);
      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 8;
      mat.alphaMap = tex;
      mat.bumpMap = tex;
      mat.bumpScale = 2;
      mat.alphaTest = 0.02;
      mat.needsUpdate = true;
      setAspect(w / H);
    });
    return () => {
      alive = false;
    };
  }, [text, mat]);
  useFrame(() => {
    mat.opacity = material.opacity;
  });
  return (
    <mesh position={position} material={mat}>
      <planeGeometry args={[height * aspect, height]} />
    </mesh>
  );
}

/** Point light that sweeps across the foil when a slide focuses in. */
function Glint() {
  const slide = useInvitation((s) => s.slide);
  const phase = useInvitation((s) => s.phase);
  const light = useRef<THREE.PointLight>(null!);
  useEffect(() => {
    if (phase === "idle") return;
    const l = light.current;
    const delay = phase === "opening" ? TIMELINE.contentIn + 0.4 : 1.4;
    const tl = gsap.timeline({ delay });
    tl.set(l.position, { x: -1.2 })
      .to(l, { intensity: 0.55, duration: 0.4 }, 0)
      .to(l.position, { x: 1.2, duration: 1.8, ease: "sine.inOut" }, 0)
      .to(l, { intensity: 0, duration: 0.5 }, 1.3);
    return () => {
      tl.kill();
    };
  }, [slide, phase]);
  const y = [0.35, 0.3, -0.05, -0.4, 0.4][slide];
  return <pointLight ref={light} position={[-1.2, y, 0.45]} intensity={0} distance={1.6} decay={1.2} color="#fff2d6" />;
}

export function Slides() {
  const m = [useSlideMaterials(), useSlideMaterials(), useSlideMaterials(), useSlideMaterials(), useSlideMaterials()];
  const I = INVITATION;
  const common = { anchorX: "center" as const, anchorY: "middle" as const, textAlign: "center" as const };

  return (
    <group>
      <Glint />
      {/* 1 — Bismillah */}
      <Slide index={0} mats={m[0]}>
        <ArabicFoil text={I.bismillah} height={0.3} position={[0, 0.42, 0]} material={m[0].foil} />
        <Divider y={0.18} mats={m[0]} w={0.32} />
        <Text {...common} font={FONTS.italic} fontSize={0.068} maxWidth={1.25} lineHeight={1.25} position={[0, 0.02, 0]} material={m[0].soft}>
          {I.bismillahTranslation}
        </Text>
      </Slide>

      {/* 2 — Invitation */}
      <Slide index={1} mats={m[1]}>
        <Text {...common} font={FONTS.script} fontSize={0.2} position={[0, 0.58, 0]} material={m[1].foil}>
          {I.invitationTitle}
        </Text>
        <Text {...common} font={FONTS.serif} fontSize={0.07} maxWidth={1.3} lineHeight={1.4} position={[0, 0.2, 0]} material={m[1].ink}>
          {I.invitationText}
        </Text>
        <Divider y={-0.08} mats={m[1]} w={0.3} />
        <Text {...common} font={FONTS.italic} fontSize={0.058} maxWidth={1.3} position={[0, -0.2, 0]} material={m[1].soft}>
          {I.signature}
        </Text>
      </Slide>

      {/* 3 — Monogram, names & date */}
      <Slide index={2} mats={m[2]}>
        <group position={[0, 0.48, 0]}>
          <mesh material={m[2].foil}>
            <torusGeometry args={[0.2, 0.004, 8, 96]} />
          </mesh>
          <mesh material={m[2].foil}>
            <torusGeometry args={[0.18, 0.0018, 6, 96]} />
          </mesh>
          <Text {...common} font={FONTS.script} fontSize={0.15} position={[0, 0.0, 0.002]} material={m[2].foil}>
            {I.monogram}
          </Text>
        </group>
        <Text {...common} font={FONTS.script} fontSize={0.24} position={[0, 0.1, 0]} material={m[2].foil}>
          {I.groom}
        </Text>
        <Text {...common} font={FONTS.italic} fontSize={0.09} position={[0, -0.07, 0]} material={m[2].soft}>
          и
        </Text>
        <Text {...common} font={FONTS.script} fontSize={0.24} position={[0, -0.24, 0]} material={m[2].foil}>
          {I.bride}
        </Text>
        <Divider y={-0.45} mats={m[2]} w={0.26} />
        <Text {...common} font={FONTS.serif} fontSize={0.1} letterSpacing={0.12} position={[0, -0.58, 0]} material={m[2].foil}>
          {I.dateLabel}
        </Text>
      </Slide>

      {/* 4 — Time & place (camera tilts down toward the fountain) */}
      <Slide index={3} mats={m[3]}>
        <Text {...common} font={FONTS.script} fontSize={0.17} position={[0, 0.02, 0]} material={m[3].foil}>
          Время и место
        </Text>
        <Text {...common} font={FONTS.italic} fontSize={0.064} position={[0, -0.15, 0]} material={m[3].soft}>
          {I.dateLong}
        </Text>
        <Text {...common} font={FONTS.serif} fontSize={0.14} letterSpacing={0.06} position={[0, -0.3, 0]} material={m[3].foil}>
          {I.time}
        </Text>
        <Text {...common} font={FONTS.serif} fontSize={0.072} maxWidth={1.3} position={[0, -0.46, 0]} material={m[3].ink}>
          {I.venue}
        </Text>
        <Text {...common} font={FONTS.italic} fontSize={0.058} maxWidth={1.3} position={[0, -0.56, 0]} material={m[3].soft}>
          {I.address}
        </Text>
      </Slide>

      {/* 5 — RSVP: headline in 3D, the form itself is DOM (see components/ui/Overlay) */}
      <Slide index={4} mats={m[4]}>
        <Text {...common} font={FONTS.script} fontSize={0.19} position={[0, 0.72, 0]} material={m[4].foil}>
          Ждём вас!
        </Text>
        <Text {...common} font={FONTS.italic} fontSize={0.058} position={[0, 0.56, 0]} material={m[4].soft}>
          {`Пожалуйста, подтвердите присутствие ${I.rsvpDeadline}`}
        </Text>
      </Slide>
    </group>
  );
}
