/**
 * Hand-drawn-looking illustration layers, painted procedurally on <canvas>:
 * pen-and-ink toile vines for the doors, the watercolour rose frame,
 * frayed silk ribbon alpha, and the embossed bouquet for the oval wax seal.
 */
import * as THREE from "three";
import { mulberry32 } from "./textures";

type Ctx = CanvasRenderingContext2D;
type Rnd = () => number;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

export function canvasTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

// ------------------------------------------------------------ pen motifs ---
function penLeaf(ctx: Ctx, x: number, y: number, len: number, ang: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.45, -len * 0.38, len, 0);
  ctx.quadraticCurveTo(len * 0.45, len * 0.38, 0, 0);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(len * 0.1, 0);
  ctx.lineTo(len * 0.8, 0);
  ctx.stroke();
  ctx.restore();
}

/** Line-drawn rose seen from above: spiral heart + scalloped outer petals. */
function penRose(ctx: Ctx, x: number, y: number, r: number, fill: string, rnd: Rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rnd() * 6.28);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += 0.2) {
    const rr = (a / (Math.PI * 5)) * r * 0.62;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a0 + 0.6) * r * 0.55, Math.sin(a0 + 0.6) * r * 0.55, r * 0.5, a0 - 0.4, a0 + 1.7);
    ctx.stroke();
  }
  ctx.restore();
}

function penBud(ctx: Ctx, x: number, y: number, r: number, ang: number, fill: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.ellipse(0, -r, r * 0.65, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.2);
  ctx.quadraticCurveTo(0, r * 0.4, r * 0.6, -r * 0.2);
  ctx.stroke();
  ctx.restore();
}

function curl(ctx: Ctx, x: number, y: number, r: number, dir: number) {
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2.6; a += 0.15) {
    const rr = r * (1 - a / (Math.PI * 3));
    const px = x + Math.cos(a * dir) * rr;
    const py = y + Math.sin(a * dir) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}

/**
 * Toile de Jouy style lattice of rose vines, drawn in brown ink —
 * ogee ovals formed by mirrored sinuous vines, roses at the crossings,
 * leaves and tendrils along the stems. Drawn for the LEFT door
 * (hinge at x = 0); the right door is mirrored.
 */
export function drawToile(side: "left" | "right", w = 768, h = 2196, ink = "#6f6256") {
  const { c, ctx } = canvas(w, h);
  const rnd = mulberry32(side === "left" ? 11 : 12);
  if (side === "right") {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  const s = w / 768;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const leafFill = "rgba(150,160,128,0.22)";
  const roseFill = "rgba(226,178,168,0.28)";
  const period = 760 * s;
  const amp = 150 * s;
  const columns = [0.36 * w, 1.12 * w];

  for (const cx of columns) {
    for (const sign of [1, -1]) {
      // the vine
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      for (let y = -20; y <= h + 20; y += 4) {
        const ph = (y / period) * Math.PI * 2;
        const x = cx + sign * (amp * Math.sin(ph) + amp * 0.18 * Math.sin(2 * ph + 1.3));
        if (y === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // leaves, buds and tendrils along it
      ctx.lineWidth = 2 * s;
      for (let y = 0; y < h; y += 44 * s) {
        const ph = (y / period) * Math.PI * 2;
        const x = cx + sign * (amp * Math.sin(ph) + amp * 0.18 * Math.sin(2 * ph + 1.3));
        const dx = sign * amp * (Math.cos(ph) + 0.36 * Math.cos(2 * ph + 1.3)) * ((Math.PI * 2) / period);
        const ang = Math.atan2(1, dx);
        const nearCross = Math.abs(Math.sin(ph)) < 0.25;
        if (nearCross) continue;
        const out = Math.sign(Math.sin(ph)) * sign; // which side of the vine faces outwards
        const k = Math.round(y / (44 * s)) % 4;
        if (k === 0) penLeaf(ctx, x, y, 44 * s, ang + out * 1.9, leafFill);
        else if (k === 1) penLeaf(ctx, x, y, 36 * s, ang - out * 1.4 + Math.PI, leafFill);
        else if (k === 2 && rnd() < 0.55) {
          // little stem with a bud pointing outward
          const ex = x + out * 30 * s;
          const ey = y - 10 * s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + out * 18 * s, y + 4 * s, ex, ey);
          ctx.stroke();
          penBud(ctx, ex, ey, 8 * s, out * 0.9, roseFill);
        } else if (rnd() < 0.35) curl(ctx, x + out * 16 * s, y, 9 * s, out);
      }
    }
    // roses where the two vines cross, and on the outer bulges
    for (let y = 0; y <= h + period; y += period / 2) {
      penRose(ctx, cx, y, 34 * s, roseFill, rnd);
      penLeaf(ctx, cx - 30 * s, y + 24 * s, 40 * s, 2.4, leafFill);
      penLeaf(ctx, cx + 30 * s, y + 24 * s, 40 * s, 0.7, leafFill);
    }
    for (let y = period / 4; y <= h + period; y += period / 2) {
      for (const sign of [1, -1]) {
        const ph = (y / period) * Math.PI * 2;
        const x = cx + sign * (amp * Math.sin(ph) + amp * 0.18 * Math.sin(2 * ph + 1.3));
        penRose(ctx, x + sign * 4 * s * Math.sign(Math.sin((y / period) * Math.PI * 2)), y, 24 * s, roseFill, rnd);
      }
    }
  }
  return c;
}

// ----------------------------------------------------- watercolour motifs ---
function wcLeaf(ctx: Ctx, x: number, y: number, len: number, ang: number, rnd: Rnd) {
  const tones = ["#a9b294", "#9aa587", "#b8bfa5", "#8e9a7d"];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
  ctx.fillStyle = tones[Math.floor(rnd() * tones.length)];
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(95,100,80,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
}

function wcBud(ctx: Ctx, x: number, y: number, r: number, ang: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 1.3, r * 0.2, 0, -r, r * 1.2);
  g.addColorStop(0, "#f8e3dc");
  g.addColorStop(1, "#dca59d");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -r, r * 0.75, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(150,100,95,0.5)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "#9aa587";
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, -r * 0.3);
  ctx.quadraticCurveTo(0, r * 0.6, r * 0.8, -r * 0.3);
  ctx.quadraticCurveTo(0, r * 0.1, -r * 0.8, -r * 0.3);
  ctx.fill();
  ctx.restore();
}

/** Watercolour garden rose: soft blush disc, layered petal arcs, darker heart. */
export function wcRose(ctx: Ctx, x: number, y: number, r: number, rnd: Rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rnd() * 6.28);
  const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#e2b3aa");
  g.addColorStop(0.55, "#f2d9d0");
  g.addColorStop(1, "#f8ebe4");
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = r * (0.9 + 0.1 * Math.sin(a * 5));
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(160,112,104,0.45)";
  ctx.lineWidth = Math.max(0.8, r * 0.05);
  for (let ring = 0; ring < 3; ring++) {
    const rr = r * (0.85 - ring * 0.25);
    const n = 5 - ring;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr * 0.3, Math.sin(a) * rr * 0.3, rr * 0.75, a + 0.3, a + 1.9);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(190,120,112,0.6)";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A meandering stem from (x0,y0) to (x1,y1) dressed with leaves and buds. */
function vine(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, rnd: Rnd, s: number, density = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  const wav = 14 * s;
  const pts: [number, number][] = [];
  const steps = Math.ceil(len / 6);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const off = Math.sin(t * len * 0.018 + x0) * wav;
    pts.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off]);
  }
  ctx.strokeStyle = "rgba(120,112,90,0.75)";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  const every = Math.max(3, Math.round(6 / density));
  for (let i = 3; i < pts.length - 2; i += every) {
    const [x, y] = pts[i];
    const [xa, ya] = pts[i + 1];
    const ang = Math.atan2(ya - y, xa - x);
    const side = i % 2 ? 1 : -1;
    const r = rnd();
    if (r < 0.55) wcLeaf(ctx, x, y, (16 + rnd() * 12) * s, ang + side * (0.7 + rnd() * 0.5), rnd);
    else if (r < 0.85) {
      const bx = x + Math.cos(ang + side * 1.2) * 14 * s;
      const by = y + Math.sin(ang + side * 1.2) * 14 * s;
      ctx.strokeStyle = "rgba(120,112,90,0.7)";
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(bx, by);
      ctx.stroke();
      wcBud(ctx, bx, by, (5 + rnd() * 3) * s, ang + side * 1.2 + Math.PI / 2);
    } else wcRose(ctx, x, y, (9 + rnd() * 6) * s, rnd);
  }
}

function roseCluster(ctx: Ctx, x: number, y: number, n: number, spread: number, size: number, rnd: Rnd, s: number) {
  for (let i = 0; i < n * 2.5; i++) {
    const a = rnd() * 6.28;
    const d = spread * (0.5 + rnd() * 0.8);
    wcLeaf(ctx, x + Math.cos(a) * d * 0.7, y + Math.sin(a) * d * 0.7, (22 + rnd() * 16) * s, a, rnd);
  }
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28;
    const d = Math.sqrt(rnd()) * spread * 0.7;
    wcRose(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, size * (0.7 + rnd() * 0.5) * s, rnd);
  }
}

/**
 * Portrait page frame: thin double rose-taupe rule with notched corners and
 * small ornaments, wrapped in watercolour rose vines. `lush` adds the
 * fuller rose clusters used from the monogram page on.
 */
export function drawFrame(lush: boolean, w = 1024, h = 1820) {
  const { c, ctx } = canvas(w, h);
  const rnd = mulberry32(lush ? 77 : 41);
  const s = (w / 1024) * 1.6;
  const m = 18 * s;
  const notch = 22 * s;
  const rule = (inset: number, lw: number) => {
    const x0 = m + inset;
    const y0 = m + inset;
    const x1 = w - m - inset;
    const y1 = h - m - inset;
    const n = notch;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x0 + n, y0);
    ctx.lineTo(x1 - n, y0);
    ctx.arc(x1, y0, n, Math.PI, Math.PI / 2, true);
    ctx.lineTo(x1, y1 - n);
    ctx.arc(x1, y1, n, -Math.PI / 2, Math.PI, true);
    ctx.lineTo(x0 + n, y1);
    ctx.arc(x0, y1, n, 0, -Math.PI / 2, true);
    ctx.lineTo(x0, y0 + n);
    ctx.arc(x0, y0, n, Math.PI / 2, 0, true);
    ctx.closePath();
    ctx.stroke();
  };
  ctx.strokeStyle = "#c7a59b";
  rule(0, 2.2 * s);
  rule(8 * s, 1 * s);
  // little diamond ornaments at the middle of the top & bottom rules
  for (const y of [m + 6 * s, h - m - 6 * s]) {
    ctx.save();
    ctx.translate(w / 2, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#efe6de";
    ctx.fillRect(-11 * s, -11 * s, 22 * s, 22 * s);
    ctx.strokeRect(-11 * s, -11 * s, 22 * s, 22 * s);
    ctx.strokeRect(-5 * s, -5 * s, 10 * s, 10 * s);
    ctx.restore();
  }

  const i0 = m + 22 * s;
  // vines climbing along all four sides
  vine(ctx, i0, h - i0, i0 + 6 * s, h * 0.55, rnd, s); // left, lower
  vine(ctx, i0 + 6 * s, h * 0.55, i0, i0 + 40 * s, rnd, s);
  vine(ctx, w - i0, h - i0 - 60 * s, w - i0 - 4 * s, h * 0.5, rnd, s);
  vine(ctx, w - i0 - 4 * s, h * 0.5, w - i0, i0 + 30 * s, rnd, s);
  vine(ctx, i0 + 20 * s, i0, w * 0.45, i0 + 12 * s, rnd, s);
  vine(ctx, w * 0.55, i0 + 12 * s, w - i0 - 40 * s, i0, rnd, s);
  vine(ctx, w * 0.35, h - i0, w * 0.75, h - i0 - 8 * s, rnd, s, 0.8);
  // rose clusters
  roseCluster(ctx, w - i0 - 40 * s, i0 + 90 * s, lush ? 6 : 3, lush ? 110 * s : 60 * s, 30, rnd, s);
  roseCluster(ctx, w - i0 - 30 * s, h - i0 - 70 * s, 3, 70 * s, 24, rnd, s);
  roseCluster(ctx, i0 + 40 * s, i0 + 60 * s, lush ? 2 : 1, 50 * s, 20, rnd, s);
  if (lush) {
    roseCluster(ctx, w - i0 - 10 * s, h * 0.3, 2, 60 * s, 22, rnd, s);
    roseCluster(ctx, w * 0.62, i0 + 20 * s, 2, 50 * s, 20, rnd, s);
  }
  return c;
}

/** Inner liner seen between the opened doors: plain cotton with two pen sprigs at the bottom. */
export function drawLinerSprigs(w = 512, h = 732) {
  const { c, ctx } = canvas(w, h);
  const rnd = mulberry32(5);
  const s = w / 512;
  ctx.strokeStyle = "#7a6c60";
  ctx.lineCap = "round";
  for (const [x, dir] of [
    [60 * s, 1],
    [w - 60 * s, -1],
  ] as const) {
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(x, h - 20 * s);
    ctx.quadraticCurveTo(x + dir * 30 * s, h - 120 * s, x + dir * 10 * s, h - 200 * s);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      const yy = h - 30 * s - t * 170 * s;
      const xx = x + dir * Math.sin(t * 3) * 22 * s;
      penLeaf(ctx, xx, yy, (20 - t * 8) * s, (i % 2 ? -0.6 : -2.5) * dir + (dir < 0 ? Math.PI : 0), "rgba(150,160,128,0.25)");
      if (i % 3 === 1) penRose(ctx, xx + dir * 20 * s, yy - 8 * s, 11 * s, "rgba(226,178,168,0.35)", rnd);
    }
  }
  return c;
}

// ------------------------------------------------------------- ribbon -----
/** Alpha for raw-edged silk chiffon ribbon: solid middle, frayed threads at both edges. */
export function makeFrayedRibbonAlpha() {
  const W = 1024;
  const H = 64;
  const { c, ctx } = canvas(W, H);
  const img = ctx.createImageData(W, H);
  const rnd = mulberry32(3);
  const frayTop = new Float32Array(W);
  const frayBot = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    frayTop[x] = 2 + rnd() * 5 + (rnd() < 0.08 ? rnd() * 6 : 0);
    frayBot[x] = 2 + rnd() * 5 + (rnd() < 0.08 ? rnd() * 6 : 0);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let a = 1;
      if (y < frayTop[x]) a = y < frayTop[x] - 3 ? 0 : 0.6;
      if (H - 1 - y < frayBot[x]) a = H - 1 - y < frayBot[x] - 3 ? 0 : 0.6;
      // alphaMap reads the green channel → write coverage into RGB
      const v = a * (235 + Math.floor(rnd() * 20));
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// --------------------------------------------------------------- seal -----
/** Embossed bouquet tied with a bow, inside an oval rim: height map (white = raised). */
export function drawSealBouquet(S = 512) {
  const { c, ctx } = canvas(S, S);
  const rnd = mulberry32(9);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  // stamped oval rim (the seal shape itself is an oval, rim sits just inside)
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(0, 0, S * 0.4, S * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  // stems
  ctx.lineWidth = 5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3, S * 0.3);
    ctx.quadraticCurveTo(i * 10, S * 0.05, i * 26, -S * 0.08);
    ctx.stroke();
  }
  // bow at the tie
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(-22, S * 0.12, 20, 10, -0.4, 0, Math.PI * 2);
  ctx.ellipse(22, S * 0.12, 20, 10, 0.4, 0, Math.PI * 2);
  ctx.stroke();
  // leaves
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
    const d = 70 + rnd() * 50;
    ctx.save();
    ctx.translate(Math.cos(a) * d * 0.8, -S * 0.05 + Math.sin(a) * d * 0.6);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // roses (raised discs with carved spirals)
  const heads: [number, number, number][] = [
    [0, -S * 0.2, 34],
    [-58, -S * 0.12, 28],
    [58, -S * 0.12, 28],
    [-30, -S * 0.3, 24],
    [32, -S * 0.3, 24],
    [-82, -S * 0.24, 20],
    [84, -S * 0.25, 20],
    [0, -S * 0.04, 22],
  ];
  for (const [x, y, r] of heads) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const rr = (a / (Math.PI * 4)) * r * 0.8;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.stroke();
  }
  return c;
}
