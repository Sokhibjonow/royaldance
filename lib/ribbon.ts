/**
 * Ribbon strip geometry: a flat band swept along a polyline.
 * Positions are rewritten in place every frame while the bow unties,
 * which gives us cloth-like deformation without a physics engine.
 */
import * as THREE from "three";

export type StripDef = {
  /** control points (tied state) */
  from: THREE.Vector3[];
  /** control points (untied / flown away) */
  to: THREE.Vector3[];
  /**
   * Width direction. "project": hint projected ⟂ tangent (band across the card).
   * "cross": hint × tangent — with hint = +Z the ribbon face looks at the camera (loops, tails).
   */
  hint: THREE.Vector3;
  mode?: "project" | "cross";
  width: number;
  /** stagger of the untie wave along the strip (0..1) */
  wave?: number;
  /** twist (radians) applied progressively along the strip while untied */
  twist?: number;
};

export class RibbonStrip {
  geometry: THREE.BufferGeometry;
  private curve: THREE.CatmullRomCurve3;
  private pts: THREE.Vector3[];
  private segs: number;

  constructor(private def: StripDef, segs = 72) {
    this.segs = segs;
    this.pts = def.from.map((p) => p.clone());
    this.curve = new THREE.CatmullRomCurve3(this.pts, false, "centripetal");
    this.geometry = new THREE.BufferGeometry();
    const n = (segs + 1) * 2;
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const uv = new Float32Array(n * 2);
    const index: number[] = [];
    for (let i = 0; i <= segs; i++) {
      uv.set([i / segs, 0, i / segs, 1], i * 4);
      if (i < segs) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(index);
    this.update(0, 0);
  }

  /** progress 0 = tied, 1 = flown away. time adds a fabric flutter. */
  update(progress: number, time: number) {
    const { from, to, wave = 0.5, twist = 0, hint, width, mode = "project" } = this.def;
    const count = from.length;
    for (let i = 0; i < count; i++) {
      const along = i / (count - 1);
      // the end of the strip leaves first, like ribbon sliding out of a knot
      const local = THREE.MathUtils.clamp((progress * (1 + wave) - (1 - along) * wave) / 1, 0, 1);
      const e = local * local * (3 - 2 * local);
      this.pts[i].lerpVectors(from[i], to[i], e);
      const flutter = Math.sin(time * 9 + along * 7) * 0.02 * Math.sin(e * Math.PI);
      this.pts[i].z += flutter;
      this.pts[i].y += flutter * 0.6;
    }
    this.curve.updateArcLengths();
    const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i <= this.segs; i++) {
      const u = i / this.segs;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t);
      if (mode === "cross") b.crossVectors(hint, t).normalize();
      else b.copy(hint).addScaledVector(t, -hint.dot(t)).normalize();
      if (twist) b.applyAxisAngle(t, twist * progress * u);
      pos.setXYZ(i * 2, p.x - (b.x * width) / 2, p.y - (b.y * width) / 2, p.z - (b.z * width) / 2);
      pos.setXYZ(i * 2 + 1, p.x + (b.x * width) / 2, p.y + (b.y * width) / 2, p.z + (b.z * width) / 2);
    }
    pos.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
