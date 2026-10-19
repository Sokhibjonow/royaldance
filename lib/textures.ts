/**
 * Procedural PBR textures generated on <canvas>.
 * No network, no image files: cotton paper fibres, foil stamping masks,
 * wax emboss, marble, linen, leaf gobo, petals and doves.
 */
import * as THREE from "three";

// ---------------------------------------------------------------- noise ----
function hash(x: number, y: number, seed: number) {
  let h = x * 374761393 + y * 668265263 + seed * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
export function valueNoise(x: number, y: number, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fbm(x: number, y: number, octaves = 4, seed = 1) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * valueNoise(x * f, y * f, seed + i * 17);
    f *= 2.03;
    amp *= 0.5;
  }
  return v;
}
/** Seeded PRNG for deterministic layouts */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -------------------------------------------------------------- helpers ----
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, srgb: boolean, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

/** Converts a height field (0..1) into a tangent-space normal map. */
function heightToNormal(h: Float32Array, w: number, hh: number, strength: number, wrap = false) {
  const { c, ctx } = canvas(w, hh);
  const img = ctx.createImageData(w, hh);
  const at = (x: number, y: number) => {
    if (wrap) {
      x = (x + w) % w;
      y = (y + hh) % hh;
    } else {
      x = Math.max(0, Math.min(w - 1, x));
      y = Math.max(0, Math.min(hh - 1, y));
    }
    return h[y * w + x];
  };
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      // canvas y goes down, texture v goes up → flip the y gradient
      const dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
      img.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function readAlpha(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4 + 3] / 255;
  return out;
}

function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const n = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Cotton watercolour paper: soft cloudy fbm + fine fibres. */
function paperHeight(w: number, h: number, seed: number, scale = 1) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 9 * scale;
      const ny = (y / w) * 9 * scale;
      const cloud = fbm(nx, ny, 4, seed);
      const grain = valueNoise(x * 0.9, y * 0.9, seed + 99);
      out[y * w + x] = cloud * 0.9 + grain * 0.1;
    }
  }
  // fibres: short random strokes
  const rnd = mulberry32(seed * 31);
  const fibres = Math.floor((w * h) / 900);
  for (let i = 0; i < fibres; i++) {
    let x = rnd() * w;
    let y = rnd() * h;
    const a = rnd() * Math.PI * 2;
    const len = 6 + rnd() * 22;
    const s = (rnd() - 0.3) * 0.18;
    for (let k = 0; k < len; k++) {
      x += Math.cos(a + k * 0.05);
      y += Math.sin(a + k * 0.05);
      const xi = x | 0;
      const yi = y | 0;
      if (xi >= 0 && yi >= 0 && xi < w && yi < h) out[yi * w + xi] += s;
    }
  }
  return out;
}

type Ornament = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  ctx.fill();
  ctx.restore();
}

export type PaperSet = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  metalnessMap?: THREE.Texture;
};

/**
 * Paper with optional foil-stamped ornament.
 * Foil areas: metalness 0.85, roughness 0.2, slightly debossed into the paper.
 * Roughness/metalness are packed as G/B channels like glTF, so one texture
 * drives both maps.
 */
export function makePaper(opts: {
  width: number;
  height: number;
  paper: string;
  foil?: string;
  ornament?: Ornament;
  seed?: number;
  overlay?: CanvasImageSource | null;
}): PaperSet {
  const { width: w, height: h, seed = 3 } = opts;
  const height = paperHeight(w, h, seed);

  let foilMask: Float32Array | null = null;
  if (opts.ornament) {
    const { ctx } = canvas(w, h);
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.lineCap = "round";
    opts.ornament(ctx, w, h);
    foilMask = readAlpha(ctx, w, h);
    const soft = boxBlur(foilMask, w, h, 2);
    // foil stamping presses the paper: deboss + crisp foil edge
    for (let i = 0; i < w * h; i++) height[i] -= soft[i] * 0.9 - foilMask[i] * 0.25;
  }

  const base = new THREE.Color(opts.paper);
  const foil = new THREE.Color(opts.foil ?? "#c9b28a");
  const { c: colorC, ctx: cctx } = canvas(w, h);
  const { c: ormC, ctx: octx } = canvas(w, h);
  const col = cctx.createImageData(w, h);
  const orm = octx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const n = height[i];
    const f = foilMask ? foilMask[i] : 0;
    const shade = 0.95 + (n - 0.5) * 0.06;
    const foilShade = 0.85 + n * 0.3;
    col.data[i * 4] = Math.min(255, (base.r * shade * (1 - f) + foil.r * foilShade * f) * 255);
    col.data[i * 4 + 1] = Math.min(255, (base.g * shade * (1 - f) + foil.g * foilShade * f) * 255);
    col.data[i * 4 + 2] = Math.min(255, (base.b * shade * (1 - f) + foil.b * foilShade * f) * 255);
    col.data[i * 4 + 3] = 255;
    const rough = 0.82 + (n - 0.5) * 0.25;
    orm.data[i * 4] = 255;
    orm.data[i * 4 + 1] = (rough * (1 - f) + 0.2 * f) * 255;
    orm.data[i * 4 + 2] = 0.85 * f * 255;
    orm.data[i * 4 + 3] = 255;
  }
  cctx.putImageData(col, 0, 0);
  octx.putImageData(orm, 0, 0);
  if (opts.overlay) {
    // hand-painted PNG on top of the paper (keeps paper relief underneath)
    cctx.globalCompositeOperation = "multiply";
    cctx.drawImage(opts.overlay, 0, 0, w, h);
    cctx.globalCompositeOperation = "source-over";
  }

  const ormTex = toTexture(ormC, false);
  return {
    map: toTexture(colorC, true),
    normalMap: toTexture(heightToNormal(height, w, h, 3.2), false),
    roughnessMap: ormTex,
    metalnessMap: foilMask ? ormTex : undefined,
  };
}

// --------------------------------------------------------------- marble ----
export function makeMarble(seed = 11) {
  const W = 256;
  const H = 1024;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const hgt = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / W;
      const turb = fbm(u * 3, v * 3, 5, seed);
      const vein = Math.abs(Math.sin((u * 2 + v * 1.3 + turb * 3.2) * Math.PI));
      const veinDark = Math.pow(1 - vein, 14);
      const tone = 0.93 - veinDark * 0.35 - turb * 0.06;
      const i = y * W + x;
      hgt[i] = turb;
      img.data[i * 4] = tone * 246;
      img.data[i * 4 + 1] = tone * 240;
      img.data[i * 4 + 2] = tone * 232;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const map = toTexture(c, true, true);
  const normalMap = toTexture(heightToNormal(hgt, W, H, 1.2, true), false, true);
  return { map, normalMap };
}

// ----------------------------------------------------------------- gobo ----
/** Soft foliage shadow projected by the SpotLight (spotLight.map). White = light. */
export function makeGobo() {
  const S = 512;
  const { c, ctx } = canvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
  g.addColorStop(0, "#fff");
  g.addColorStop(1, "#fff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const rnd = mulberry32(42);
  ctx.filter = "blur(7px)";
  ctx.fillStyle = "rgba(60,55,45,0.55)";
  ctx.strokeStyle = "rgba(60,55,45,0.5)";
  for (let b = 0; b < 7; b++) {
    let x = rnd() * S;
    let y = rnd() * S;
    const ang = rnd() * Math.PI * 2;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < 9; i++) {
      x += Math.cos(ang + Math.sin(i) * 0.4) * 30;
      y += Math.sin(ang + Math.sin(i) * 0.4) * 30;
      ctx.lineTo(x, y);
      leaf(ctx, x, y, 30 + rnd() * 30, ang + (rnd() - 0.5) * 2.4);
      leaf(ctx, x, y, 26 + rnd() * 26, ang + Math.PI * 0.5 + (rnd() - 0.5) * 2);
    }
    ctx.stroke();
  }
  ctx.filter = "none";
  const t = toTexture(c, true);
  return t;
}

// ---------------------------------------------------------------- petal ----
/** Rose petal: colour gradient with veins + alpha silhouette (heart-ish). */
export function makePetal() {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  ctx.translate(S / 2, S);
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.bezierCurveTo(-S * 0.62, -S * 0.42, -S * 0.42, -S * 1.02, -S * 0.06, -S * 0.9);
  ctx.quadraticCurveTo(0, -S * 0.86, S * 0.06, -S * 0.9);
  ctx.bezierCurveTo(S * 0.42, -S * 1.02, S * 0.62, -S * 0.42, 0, -4);
  const g = ctx.createLinearGradient(0, 0, 0, -S);
  g.addColorStop(0, "#f3e6c8");
  g.addColorStop(0.25, "#ffffff");
  g.addColorStop(1, "#f2f2f2");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(170,120,120,0.16)";
  ctx.lineWidth = 1.2;
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(i * 10, -S * 0.5, i * 22, -S);
    ctx.stroke();
  }
  return toTexture(c, true);
}

// ----------------------------------------------------------------- dove ----
export function makeDove() {
  const W = 512;
  const H = 256;
  const body = canvas(W, H);
  const b = body.ctx;
  const grad = (ctx: CanvasRenderingContext2D, y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#e4e0dc");
    return g;
  };
  b.fillStyle = grad(b, 60, 200);
  // body facing right: tail on the left, head on the right
  b.beginPath();
  b.moveTo(30, 150);
  b.lineTo(150, 120);
  b.bezierCurveTo(220, 90, 330, 92, 380, 110);
  b.bezierCurveTo(400, 80, 440, 70, 462, 92);
  b.lineTo(490, 104);
  b.lineTo(462, 112);
  b.bezierCurveTo(456, 140, 420, 170, 360, 176);
  b.bezierCurveTo(280, 190, 190, 176, 150, 160);
  b.lineTo(40, 186);
  b.quadraticCurveTo(20, 170, 30, 150);
  b.fill();
  b.fillStyle = "#3a302a";
  b.beginPath();
  b.arc(452, 94, 4, 0, Math.PI * 2);
  b.fill();
  b.fillStyle = "#e6b8a8";
  b.beginPath();
  b.moveTo(480, 101);
  b.lineTo(500, 105);
  b.lineTo(478, 110);
  b.fill();

  const wing = canvas(W, H);
  const w = wing.ctx;
  w.fillStyle = grad(w, 0, 200);
  // wing hinge at bottom-centre (u=0.5, v=0); feathers spread upward
  w.beginPath();
  w.moveTo(170, 250);
  w.bezierCurveTo(140, 150, 180, 40, 300, 8);
  for (let i = 0; i < 7; i++) {
    const x = 300 - i * 22;
    w.quadraticCurveTo(x - 4, 40 + i * 12, x - 22, 24 + i * 18);
  }
  w.bezierCurveTo(120, 160, 230, 230, 320, 250);
  w.closePath();
  w.fill();
  w.strokeStyle = "rgba(150,140,130,0.35)";
  w.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    w.beginPath();
    w.moveTo(240, 240);
    w.quadraticCurveTo(220 - i * 10, 160, 290 - i * 22, 30 + i * 18);
    w.stroke();
  }
  return { body: toTexture(body.c, true), wing: toTexture(wing.c, true) };
}

/** Load an image, resolving to null instead of throwing when it is missing. */
export function loadOptionalImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Sage leaf silhouette with a midrib, used by the rose garlands. */
export function makeLeaf() {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.translate(S / 2, S);
  const g = ctx.createLinearGradient(-S / 2, 0, S / 2, 0);
  g.addColorStop(0, "#c9cfba");
  g.addColorStop(0.5, "#f4f6ef");
  g.addColorStop(1, "#c9cfba");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-S * 0.42, -S * 0.3, -S * 0.3, -S * 0.8, 0, -S);
  ctx.bezierCurveTo(S * 0.3, -S * 0.8, S * 0.42, -S * 0.3, 0, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,100,80,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -S * 0.95);
  ctx.stroke();
  return toTexture(c, true);
}

/** Height map drawn on a canvas (luma, white = raised) → tangent-space normal map. */
export function normalFromCanvas(src: HTMLCanvasElement, strength = 4, blur = 2) {
  const w = src.width;
  const h = src.height;
  const d = src.getContext("2d")!.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = d[i * 4] / 255;
  const soft = blur > 0 ? boxBlur(lum, w, h, blur) : lum;
  return toTexture(heightToNormal(soft, w, h, strength), false);
}
