"use client";
/**
 * Scene.tsx — camera, lights & soft shadows, gobo foliage light,
 * pointer / gyroscope parallax, cinematic camera rig and post-processing.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { easing } from "maath";
import { CARD, TIMELINE } from "@/lib/invitation.config";
import { input, useInvitation } from "@/lib/store";
import { POSES, fitDistance, recording, rig, type Pose } from "@/lib/rig";
import { makeGobo } from "@/lib/textures";
import GatefoldEnvelope from "./GatefoldEnvelope";
import WaxSealAndRibbon from "./WaxSealAndRibbon";
import DioramaInterior from "./DioramaInterior";
import RosePetals3D from "./RosePetals3D";

export default function Scene({ onReady }: { onReady?: () => void }) {
  const [dpr, setDpr] = useState(recording ? 1 : 1.5);
  const [hq, setHq] = useState(true);
  const mobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false, preserveDrawingBuffer: recording }}
      camera={{ fov: 36, near: 0.1, far: 60, position: [0, 0, 9] }}
      onCreated={({ gl }) => {
        gl.setClearColor("#ebe5dc");
        onReady?.();
      }}
    >
      {!recording && (
        <PerformanceMonitor
          onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
          onDecline={() => {
            setDpr(1);
            setHq(false);
          }}
        />
      )}
      <fog attach="fog" args={["#ebe5dc", 9, 22]} />
      <Suspense fallback={null}>
        <Lights />
        <Environment resolution={256} frames={1} environmentIntensity={0.55}>
          {/* studio light cards: give the foil, wax and silk something to reflect */}
          <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[-3, 3, 4]} scale={[5, 3, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#fbf8f4" position={[4, 0, 3]} scale={[3, 5, 1]} />
          <Lightformer form="ring" intensity={1.6} color="#ffffff" position={[0, 4, -2]} scale={2} />
          <Lightformer form="rect" intensity={0.5} color="#e6e2dc" position={[0, -4, 2]} scale={[8, 2, 1]} />
        </Environment>
        <CameraRig />
        <TiltGroup>
          <DioramaInterior />
          <GatefoldEnvelope />
          <WaxSealAndRibbon />
        </TiltGroup>
        <RosePetals3D count={mobile ? 45 : 80} />
        <RosePetals3D count={mobile ? 25 : 45} leaves />
        <Motes count={mobile ? 120 : 260} />
        <Effects hq={hq && !mobile} />
        <BreakdownPass />
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
    gsap.to(inner.current, { intensity: 0.6, duration: 2.6, delay: TIMELINE.flapsOpen + 0.3, ease: "sine.inOut" });
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
      <ambientLight intensity={0.42} color="#fff8f0" />
      <hemisphereLight args={["#fffaf3", "#d9cfc3", 0.5]} />
      {/* key light — main soft shadows (seal → ribbon, doors → interior) */}
      <directionalLight
        ref={key}
        castShadow
        position={[-1.2, 2.2, 6]}
        intensity={1.9}
        color="#fff4e6"
        shadow-intensity={0.8}
        shadow-mapSize={[2048, 2048]}
        shadow-radius={9}
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
        intensity={1.0}
        color="#fff3e2"
        shadow-intensity={0.55}
        shadow-mapSize={[1024, 1024]}
        shadow-radius={5}
        shadow-bias={-0.0005}
      />
      <pointLight ref={inner} position={[0, 0.6, -0.1]} intensity={0} distance={4} decay={1.6} color="#ffe4c8" />
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

  const goTo = (p: Pose, duration: number, delay: number, ease: string) => {
    tween.current?.kill();
    const tl = gsap.timeline({ delay });
    tl.to(rig.look, { x: p.look[0], y: p.look[1], z: p.look[2], duration, ease }, 0);
    tl.to(rig, { halfW: p.halfW, halfH: p.halfH, duration, ease }, 0);
    tl.to(rig.focus, { y: p.look[1], z: p.focusZ, duration, ease }, 0);
    tween.current = tl;
  };

  useEffect(() => {
    if (phase === "opening") {
      // ease back a little so the doors' swing (and their thickness) plays in frame…
      gsap.to(rig, { halfW: 1.08, halfH: 1.72, duration: 1.5, delay: TIMELINE.flapsOpen - 0.4, ease: "sine.inOut" });
      // …then dolly in through the open doors into the diorama
      goTo(POSES.slides[0], TIMELINE.cameraDuration, TIMELINE.cameraDolly, "power2.inOut");
      gsap.to(rig, { interior: 1, duration: TIMELINE.cameraDuration, delay: TIMELINE.cameraDolly });
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "open") return;
    const p = POSES.slides[slide];
    goTo(p, 2.4, 0, "sine.inOut");
    // slow cinematic push-in while the page is read
    tween.current!.to(rig, { halfW: p.halfW * 0.94, halfH: p.halfH * 0.94, duration: 7, ease: "none" });
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
    const par = recording ? 0.22 : 0.12;
    const px = input.tx * par * rig.interior;
    const py = input.ty * par * 0.75 * rig.interior;
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

  useFrame(({ clock }, dt) => {
    if (recording) {
      const t = clock.elapsedTime;
      // closed card starts at a 3/4 angle and settles; inside, a slow lateral drift
      const settle = Math.exp(-t * 0.6);
      input.tx = 0.85 * settle + (1 - settle) * 0.55 * Math.sin(t * 0.33);
      input.ty = 0.45 * settle + (1 - settle) * 0.35 * Math.sin(t * 0.23 + 1);
    }
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
  return (
    <EffectComposer multisampling={hq ? 4 : 0}>
      <N8AO halfRes={!recording} aoRadius={0.35} distanceFalloff={0.6} intensity={recording ? 2.6 : 2} color="#3b2f28" quality={recording ? "ultra" : "medium"} />
      <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.1} intensity={0.25} radius={0.6} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.35} darkness={0.3} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.06} />
    </EffectComposer>
  );
}

// ------------------------------------------------- dust motes in the light ---
/** Warm specks of dust drifting through the light inside the card (twinkle, bokeh near the lens). */
function Motes({ count }: { count: number }) {
  const phase = useInvitation((s) => s.phase);
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p.set([(Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 3.6, -1.1 + Math.random() * 3.2], i * 3);
      seed[i] = Math.random() * 100;
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uFade: { value: 0 } }), []);

  useEffect(() => {
    if (phase === "idle") return;
    const tw = gsap.to(uniforms.uFade, { value: 1, duration: 2.5, delay: TIMELINE.cameraDolly });
    return () => {
      tw.kill();
    };
  }, [phase, uniforms]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute float aSeed;
          uniform float uTime;
          varying float vTw;
          void main() {
            vec3 p = position;
            p.x += sin(uTime * 0.13 + aSeed) * 0.12;
            p.y += mod(uTime * 0.03 + aSeed, 3.6) - 1.8 - position.y * 0.0;
            p.z += cos(uTime * 0.11 + aSeed * 1.7) * 0.1;
            vTw = 0.55 + 0.45 * sin(uTime * (1.5 + fract(aSeed) * 2.0) + aSeed);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = (6.0 + fract(aSeed * 3.1) * 8.0) / -mv.z * 3.0;
            gl_Position = projectionMatrix * mv;
          }`}
        fragmentShader={/* glsl */ `
          uniform float uFade;
          varying float vTw;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(1.0, 0.94, 0.84, a * a * 0.35 * vTw * uFade);
          }`}
      />
    </points>
  );
}

// -------------------------------------------- ?pass=wire|clay breakdowns ---
/** Technical render passes for "how it's made" stills: polygon wireframe or untextured clay (light & shadow only). */
function BreakdownPass() {
  const { scene } = useThree();
  useEffect(() => {
    const pass = new URLSearchParams(window.location.search).get("pass");
    if (pass === "wire") scene.overrideMaterial = new THREE.MeshBasicMaterial({ color: "#7fd3ff", wireframe: true });
    if (pass === "clay") scene.overrideMaterial = new THREE.MeshStandardMaterial({ color: "#d9d6d2", roughness: 0.8 });
    return () => {
      scene.overrideMaterial = null;
    };
  }, [scene]);
  return null;
}
