import * as THREE from "three";

/** ?render — deterministic frame-by-frame recording (scripts/render-video.mjs) */
export const recording = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("render");

/**
 * Shared mutable camera state. The CameraRig tweens `pose` with GSAP,
 * other systems (DOF, petals, gobo) read from it every frame.
 */
export const rig = {
  look: new THREE.Vector3(0, -0.04, 0),
  /** half-extent of the area that must stay visible around `look` (starts at POSES.closed) */
  halfW: 0.84,
  halfH: 1.5,
  /** extra dolly (negative = closer) */
  push: 0,
  /** world point the depth-of-field keeps sharp */
  focus: new THREE.Vector3(0, 0, 0.1),
  /** 0 = closed card tilts, 1 = interior parallax */
  interior: 0,
};

export type Pose = { look: [number, number, number]; halfW: number; halfH: number; focusZ: number };

/** Camera poses, in world space. The interior text plane sits at z = -0.4. */
export const POSES: { closed: Pose; slides: Pose[] } = {
  // the closed card fills the (portrait) screen, as in the reference
  closed: { look: [0, -0.04, 0], halfW: 0.84, halfH: 1.5, focusZ: 0.12 },
  slides: [
    { look: [0, 0, -0.4], halfW: 0.93, halfH: 1.65, focusZ: -0.75 }, // Bismillah
    { look: [0, 0, -0.4], halfW: 0.95, halfH: 1.69, focusZ: -0.75 }, // With love
    { look: [0, 0, -0.4], halfW: 0.95, halfH: 1.69, focusZ: -0.75 }, // Invitation
    { look: [0, 0, -0.4], halfW: 0.95, halfH: 1.69, focusZ: -0.75 }, // Monogram
    { look: [0, 0, -0.4], halfW: 0.95, halfH: 1.69, focusZ: -0.75 }, // Venue
  ],
};

/** Distance from `look` that frames halfW × halfH for a given vertical fov & aspect. */
export function fitDistance(halfW: number, halfH: number, fovDeg: number, aspect: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  return Math.max(halfH / t, halfW / (t * aspect));
}
