import * as THREE from "three";

/**
 * Shared mutable camera state. The CameraRig tweens `pose` with GSAP,
 * other systems (DOF, petals, gobo) read from it every frame.
 */
export const rig = {
  look: new THREE.Vector3(0, 0, 0),
  /** half-extent of the area that must stay visible around `look` */
  halfW: 1.3,
  halfH: 1.75,
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
  closed: { look: [0, 0, 0], halfW: 1.28, halfH: 1.72, focusZ: 0.12 },
  slides: [
    { look: [0, 0.3, -0.45], halfW: 0.82, halfH: 1.0, focusZ: -0.4 }, // Bismillah
    { look: [0, 0.12, -0.45], halfW: 0.82, halfH: 1.05, focusZ: -0.4 }, // Invitation
    { look: [0, -0.12, -0.5], halfW: 0.84, halfH: 1.1, focusZ: -0.4 }, // Monogram & names
    { look: [0, -0.62, -0.55], halfW: 0.86, halfH: 1.05, focusZ: -0.4 }, // Venue → fountain
    { look: [0, 0.05, -0.5], halfW: 0.95, halfH: 1.25, focusZ: -0.4 }, // RSVP
  ],
};

/** Distance from `look` that frames halfW × halfH for a given vertical fov & aspect. */
export function fitDistance(halfW: number, halfH: number, fovDeg: number, aspect: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  return Math.max(halfH / t, halfW / (t * aspect));
}
