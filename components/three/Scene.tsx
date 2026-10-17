"use client";
/**
 * Scene.tsx — camera, lights & soft shadows, gobo foliage light,
 * pointer / gyroscope parallax, cinematic camera rig and post-processing.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, DepthOfField, EffectComposer, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from "postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { easing } from "maath";
import { CARD, TIMELINE } from "@/lib/invitation.config";
import { input, useInvitation } from "@/lib/store";
import { POSES, fitDistance, rig, type Pose } from "@/lib/rig";
import { makeGobo } from "@/lib/textures";
import GatefoldEnvelope from "./GatefoldEnvelope";
import WaxSealAndRibbon from "./WaxSealAndRibbon";
import DioramaInterior from "./DioramaInterior";
import RosePetals3D from "./RosePetals3D";

export default function Scene({ onReady }: { onReady?: () => void }) {
  const [dpr, setDpr] = useState(1.5);
  const [hq, setHq] = useState(true);
  const mobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 36, near: 0.1, far: 60, position: [0, 0, 9] }}
      onCreated={({ gl }) => {
        gl.setClearColor("#e9dfcf");
        onReady?.();
      }}
    >
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
        onDecline={() => {
          setDpr(1);
          setHq(false);
        }}
      />
      <fog attach="fog" args={["#e9dfcf", 9, 22]} />
      <Suspense fallback={null}>
        <Lights />
        <Environment resolution={256} frames={1} environmentIntensity={0.55}>
          {/* studio light cards: give the foil, wax and silk something to reflect */}
          <Lightformer form="rect" intensity={2.2} color="#fff4e2" position={[-3, 3, 4]} scale={[5, 3, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#ffe6d6" position={[4, 0, 3]} scale={[3, 5, 1]} />
          <Lightformer form="ring" intensity={1.6} color="#ffffff" position={[0, 4, -2]} scale={2} />
          <Lightformer form="rect" intensity={0.5} color="#d9c8b5" position={[0, -4, 2]} scale={[8, 2, 1]} />
        </Environment>
        <CameraRig />
        <TiltGroup>
          <DioramaInterior />
          <GatefoldEnvelope />
          <WaxSealAndRibbon />
        </TiltGroup>
        <RosePetals3D count={mobile ? 70 : 150} />
        <Effects hq={hq && !mobile} />
      </Suspense>
    </Canvas>
  );
}

// ---------------------------------------------------------------- lights ---
function Lights() {
  const phase = useInvitation((s) => s.phase);
  const key = useRef<THREE.DirectionalLight>(null!);
  const gobo = useRef<THREE.SpotLight>(null!);
  const inner = useRef<THREE.PointLight>(null!);
  const goboMap = useMemo(() => makeGobo(), []);
  const goboTarget = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    gobo.current.target = goboTarget;
    goboTarget.position.set(0, -0.2, CARD.dioramaZ);
  }, [goboTarget]);

  // warm light pours into the card as the doors open
  useEffect(() => {
    if (phase === "idle") return;
    gsap.to(inner.current, { intensity: 1.1, duration: 2.6, delay: TIMELINE.flapsOpen + 0.3, ease: "sine.inOut" });
  }, [phase]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // leaves sway: gently orbit the gobo projector
    gobo.current.position.x = 3.2 + Math.sin(t * 0.35) * 0.12;
    gobo.current.position.y = 4.2 + Math.cos(t * 0.27) * 0.08;
    goboMap.offset.set(Math.sin(t * 0.4) * 0.01, Math.cos(t * 0.33) * 0.008);
  });

  return (
    <>
      <ambientLight intensity={0.12} color="#ffe9d2" />
      <hemisphereLight args={["#fff6ea", "#b59c80", 0.35]} />
      {/* key light — main soft shadows (seal → ribbon, doors → interior) */}
      <directionalLight
        ref={key}
        castShadow
        position={[-2.6, 3.4, 5.5]}
        intensity={1.9}
        color="#fff1df"
        shadow-mapSize={[2048, 2048]}
        shadow-radius={7}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={16}
      />
      {/* sun through foliage: SpotLight.map projects the gobo */}
      <spotLight
        ref={gobo}
        castShadow
        map={goboMap}
        position={[3.2, 4.2, 4.5]}
        angle={0.55}
        penumbra={0.7}
        decay={0}
        intensity={1.7}
        color="#ffe9d2"
        shadow-mapSize={[1024, 1024]}
        shadow-radius={5}
        shadow-bias={-0.0005}
      />
      <pointLight ref={inner} position={[0, 0.6, -0.1]} intensity={0} distance={4} decay={1.6} color="#ffc98f" />
    </>
  );
}

// ------------------------------------------------------------ camera rig ---
function CameraRig() {
  const { camera, size } = useThree();
  const phase = useInvitation((s) => s.phase);
  const slide = useInvitation((s) => s.slide);
  const tween = useRef<gsap.core.Timeline | null>(null);
  const smoothed = useRef(new THREE.Vector3(0, 0, 9));

  const goTo = (p: Pose, duration: number, delay: number, ease: string, rackFocus: boolean) => {
    tween.current?.kill();
    const tl = gsap.timeline({ delay });
    tl.to(rig.look, { x: p.look[0], y: p.look[1], z: p.look[2], duration, ease }, 0);
    tl.to(rig, { halfW: p.halfW, halfH: p.halfH, duration, ease }, 0);
    if (rackFocus) {
      // pull focus to the petals near the lens, then rack back onto the text
      tl.to(rig.focus, { z: 1.4, y: p.look[1], duration: duration * 0.35, ease: "sine.in" }, 0);
      tl.to(rig.focus, { z: p.focusZ, duration: duration * 0.75, ease: "power2.out" }, duration * 0.45);
    } else {
      tl.to(rig.focus, { y: p.look[1], z: p.focusZ, duration, ease }, 0);
    }
    tween.current = tl;
  };

  useEffect(() => {
    if (phase === "opening") {
      // Dolly in: glide through the open doors into the diorama
      goTo(POSES.slides[0], TIMELINE.cameraDuration, TIMELINE.cameraDolly, "power2.inOut", false);
      gsap.to(rig, { interior: 1, duration: TIMELINE.cameraDuration, delay: TIMELINE.cameraDolly });
      gsap.fromTo(rig.focus, { z: 1.5 }, { z: -0.4, duration: 1.8, delay: TIMELINE.contentIn - 0.6, ease: "power2.out" });
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "open") goTo(POSES.slides[slide], 2.2, 0, "power3.inOut", true);
  }, [slide, phase]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;
    // wider lens on portrait screens
    const aspect = size.width / size.height;
    const fov = aspect < 0.8 ? 46 : 36;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    const dist = fitDistance(rig.halfW, rig.halfH, fov, aspect);
    // breathing: slow sinusoidal drift
    const breathe = 1 - rig.interior * 0.4;
    const bx = Math.sin(t * 0.31) * 0.05 * breathe;
    const by = Math.sin(t * 0.23 + 1.3) * 0.04 * breathe;
    const bz = Math.sin(t * 0.17) * 0.06;
    // inside the card the camera itself parallaxes across the layers
    const px = input.tx * 0.22 * rig.interior;
    const py = input.ty * 0.16 * rig.interior;
    const target = new THREE.Vector3(rig.look.x + bx + px, rig.look.y + by + py, rig.look.z + dist + bz);
    easing.damp3(smoothed.current, target, 0.25, dt);
    cam.position.copy(smoothed.current);
    cam.lookAt(rig.look.x + px * 0.3, rig.look.y + py * 0.3, rig.look.z);
  });
  return null;
}

// --------------------------------------------- pointer / gyro tilt group ---
function TiltGroup({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  const { gl } = useThree();

  useEffect(() => {
    let lastX = 0;
    let lastY = 0;
    let lastT = performance.now();
    const onMove = (e: PointerEvent) => {
      if (input.gyro) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      input.vx = THREE.MathUtils.clamp((x - lastX) / dt, -6, 6);
      input.vy = THREE.MathUtils.clamp((y - lastY) / dt, -6, 6);
      lastX = x;
      lastY = y;
      lastT = now;
      input.tx = x;
      input.ty = y;
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      input.gyro = true;
      // phone held at ~45°: beta 45 = neutral
      input.tx = THREE.MathUtils.clamp(e.gamma / 25, -1, 1);
      input.ty = THREE.MathUtils.clamp((45 - e.beta) / 25, -1, 1);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, [gl]);

  useFrame((_, dt) => {
    // 5–8° on the closed card, calmer once we are inside
    const amp = THREE.MathUtils.degToRad(7 - rig.interior * 4.5);
    easing.dampE(g.current.rotation, [-input.ty * amp, input.tx * amp, 0], 0.35, dt);
    input.vx *= 0.9;
    input.vy *= 0.9;
  });

  return <group ref={g}>{children}</group>;
}

// ------------------------------------------------------- post-processing ---
function Effects({ hq }: { hq: boolean }) {
  const dof = useRef<DepthOfFieldEffect>(null);
  // the effect auto-focuses on rig.focus, which the camera rig tweens (rack focus)
  useEffect(() => {
    if (dof.current) dof.current.target = rig.focus;
  });
  return (
    <EffectComposer multisampling={hq ? 4 : 0}>
      <DepthOfField ref={dof} worldFocusRange={0.9} bokehScale={hq ? 4 : 2.5} />
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.15} intensity={0.4} radius={0.65} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.55} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.08} />
    </EffectComposer>
  );
}
