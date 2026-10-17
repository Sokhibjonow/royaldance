/**
 * Sound design. Background music is a file (/public/audio/music.mp3);
 * paper rustle, ribbon swish and wax "crack" are synthesised with WebAudio
 * unless you drop real recordings into /public/audio.
 */
import { AUDIO } from "./invitation.config";

let ctx: AudioContext | null = null;
let music: HTMLAudioElement | null = null;
let master: GainNode | null = null;
let available: string[] = [];

export function setAvailableAudio(list: string[]) {
  available = list;
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function playFile(url: string, volume: number) {
  const a = new Audio(url);
  a.volume = volume;
  void a.play().catch(() => {});
}

/** Crisp crinkle of 600 gsm paper: band-passed noise with random amplitude spikes. */
export function paperRustle(duration = 1.6, delay = 0) {
  if (available.includes(AUDIO.paper)) return void setTimeout(() => playFile(AUDIO.paper, 0.55), delay * 1000);
  const c = ac();
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, duration);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400;
  bp.Q.value = 0.7;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 700;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  // crackles
  let t = t0;
  while (t < t0 + duration) {
    const env = Math.sin(((t - t0) / duration) * Math.PI);
    g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.22 * env, t);
    t += 0.015 + Math.random() * 0.05;
  }
  g.gain.linearRampToValueAtTime(0, t0 + duration);
  src.connect(bp).connect(hp).connect(g).connect(master!);
  src.start(t0);
}

/** Silky swish of a satin ribbon sliding out of its knot. */
export function ribbonSwish(delay = 0) {
  if (available.includes(AUDIO.ribbon)) return void setTimeout(() => playFile(AUDIO.ribbon, 0.5), delay * 1000);
  const c = ac();
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 1.2);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 2.2;
  bp.frequency.setValueAtTime(900, t0);
  bp.frequency.exponentialRampToValueAtTime(5200, t0 + 0.7);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.16, t0 + 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
  src.connect(bp).connect(g).connect(master!);
  src.start(t0);
}

/** Dull wax "tock" when the seal pops off. */
export function waxPop(delay = 0) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(240, t0);
  o.frequency.exponentialRampToValueAtTime(90, t0 + 0.12);
  const g = c.createGain();
  g.gain.setValueAtTime(0.35, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
  o.connect(g).connect(master!);
  o.start(t0);
  o.stop(t0 + 0.2);
}

export function startMusic() {
  if (!available.includes(AUDIO.music) || music) return;
  music = new Audio(AUDIO.music);
  music.loop = true;
  music.volume = 0;
  void music.play().catch(() => {});
  const start = performance.now();
  const fade = () => {
    if (!music) return;
    const k = Math.min(1, (performance.now() - start) / 4000);
    if (!music.muted) music.volume = 0.6 * k;
    if (k < 1) requestAnimationFrame(fade);
  };
  fade();
}

export function setMuted(m: boolean) {
  if (music) music.muted = m;
  if (master) master.gain.value = m ? 0 : 0.9;
}

export function haptic(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}
