/**
 * Records the invitation as a vertical MP4, frame by frame.
 *
 *   npm run build && npm start            # in one terminal
 *   node scripts/render-video.mjs         # needs playwright + ffmpeg
 *
 * The page runs on a virtual clock (performance.now / requestAnimationFrame
 * are replaced), so every frame lands exactly 1/FPS apart no matter how slow
 * the GPU is. Frames are read straight from the WebGL canvas, the "dip to
 * grey" veil from the DOM overlay is composited on top, and the music track
 * is muxed in at the end.
 *
 * Env: URL (default http://localhost:3000), OUT (default invitation.mp4),
 *      W, H, FPS, SECONDS, PLAYWRIGHT (path to the playwright package).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || "playwright");

const URL = process.env.URL || "http://localhost:3000";
const OUT = process.env.OUT || "invitation.mp4";
const W = Number(process.env.W || 720);
const H = Number(process.env.H || 1280);
const FPS = Number(process.env.FPS || 30);
const SECONDS = Number(process.env.SECONDS || 31);
const HOLD = Number(process.env.HOLD || 0.8); // closed card before the seal is tapped
const FRAMES = process.env.FRAMES_DIR || join(process.cwd(), ".video-frames");

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("pageerror:", e.message));

await page.addInitScript(() => {
  let now = 0;
  let queue = [];
  performance.now = () => now;
  const start = Date.now();
  Date.now = () => start + now;
  window.requestAnimationFrame = (cb) => {
    queue.push(cb);
    return queue.length;
  };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms) => {
    now += ms;
    const list = queue;
    queue = [];
    for (const cb of list) cb(now);
  };
  window.__grab = () => {
    const gl = document.querySelector("canvas");
    const c = document.createElement("canvas");
    c.width = gl.width;
    c.height = gl.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(gl, 0, 0);
    const veil = document.querySelector(".bg-\\[\\#5f5a55\\]");
    const a = veil ? Number(getComputedStyle(veil).opacity) : 0;
    if (a > 0.001) {
      ctx.fillStyle = `rgba(95,90,85,${a})`;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    return c.toDataURL("image/jpeg", 0.93);
  };
});

await page.goto(`${URL}/?render`, { waitUntil: "load" });
// let fonts, procedural textures and shaders settle (real time), stepping the virtual clock slowly
for (let i = 0; i < 40; i++) {
  await page.evaluate(() => window.__step(1000 / 30));
  await page.waitForTimeout(250);
}
const dt = 1000 / FPS;
const total = Math.round(SECONDS * FPS);
const tapAt = Math.round(HOLD * FPS);
const t0 = Date.now();
for (let f = 0; f < total; f++) {
  if (f === tapAt) await page.mouse.click(W / 2, H / 2 + H * 0.04); // the wax seal
  await page.evaluate((ms) => window.__step(ms), dt);
  const url = await page.evaluate(() => window.__grab());
  writeFileSync(join(FRAMES, `f${String(f).padStart(5, "0")}.jpg`), Buffer.from(url.split(",")[1], "base64"));
  if (f % 30 === 0) {
    const el = (Date.now() - t0) / 1000;
    console.log(`frame ${f}/${total}  ${el.toFixed(0)}s elapsed, ~${((el / (f + 1)) * (total - f - 1) / 60).toFixed(1)} min left`);
  }
}
await browser.close();

const music = join(process.cwd(), "public/audio/music.mp3");
const args = ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(FRAMES, "f%05d.jpg")];
if (existsSync(music)) {
  const fadeOut = Math.max(0, SECONDS - 2);
  args.push("-i", music, "-shortest", "-c:a", "aac", "-b:a", "160k", "-af", `afade=t=in:d=1.5,afade=t=out:st=${fadeOut}:d=2`);
}
args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", OUT);
execFileSync("ffmpeg", args, { stdio: "inherit" });
console.log("✓", OUT);
