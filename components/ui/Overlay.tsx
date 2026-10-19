"use client";
/**
 * DOM layer above the canvas: the "tap the seal" hint, autoplay through the
 * story (like the reference film), wheel / swipe / key navigation, the
 * soft dip-to-grey between the Bismillah scene and the framed pages,
 * and the sound toggle.
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { AUTOPLAY, INVITATION, SLIDES, TIMELINE } from "@/lib/invitation.config";
import { input, useInvitation } from "@/lib/store";
import { setMuted } from "@/lib/audio";

export default function Overlay() {
  const { phase, slide, muted, next, prev, goTo, toggleMute, setOpen } = useInvitation();
  const [hintVisible, setHintVisible] = useState(false);
  const veil = useRef<HTMLDivElement>(null);
  const prevSlide = useRef(slide);

  useEffect(() => {
    const t = setTimeout(() => setHintVisible(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // opening timeline ends → interactive interior (on GSAP's clock, so it stays
  // in sync with the 3D timeline even when lag smoothing slows it down)
  useEffect(() => {
    if (phase !== "opening") return;
    const call = gsap.delayedCall(TIMELINE.contentIn + 0.2, setOpen);
    return () => {
      call.kill();
    };
  }, [phase, setOpen]);

  useEffect(() => setMuted(muted), [muted]);

  // autoplay: each page holds for a moment, then the story moves on by itself
  useEffect(() => {
    if (phase !== "open" || slide >= AUTOPLAY.length) return;
    const hold = AUTOPLAY[slide] + (slide === 0 ? 0 : 1.6);
    const call = gsap.delayedCall(hold, next);
    return () => {
      call.kill();
    };
  }, [phase, slide, next]);

  // dip to soft grey when leaving the Bismillah scene for the framed pages
  useEffect(() => {
    const from = prevSlide.current;
    prevSlide.current = slide;
    if (!veil.current || phase !== "open") return;
    if ((from === 0 && slide === 1) || (from === 1 && slide === 0)) {
      gsap.fromTo(veil.current, { opacity: 0 }, { opacity: 0.42, duration: 0.55, ease: "sine.in", yoyo: true, repeat: 1 });
    }
  }, [slide, phase]);

  // wheel / swipe / keyboard navigation, each also blows a gust through the petals
  const lock = useRef(0);
  useEffect(() => {
    const step = (dir: number) => {
      const now = performance.now();
      if (now - lock.current < 1300) return;
      lock.current = now;
      if (dir > 0) next();
      else prev();
    };
    const onWheel = (e: WheelEvent) => {
      input.gust = Math.min(4, input.gust + Math.min(0.5, Math.abs(e.deltaY) / 400));
      if (Math.abs(e.deltaY) > 20) step(Math.sign(e.deltaY));
    };
    let y0 = 0;
    const onTouchStart = (e: TouchEvent) => (y0 = e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => {
      const dy = y0 - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50) {
        input.gust = Math.min(4, input.gust + 0.8);
        step(Math.sign(dy));
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "ArrowRight"].includes(e.key)) step(1);
      if (["ArrowUp", "PageUp", "ArrowLeft"].includes(e.key)) step(-1);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [next, prev]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-ink">
      <div ref={veil} className="absolute inset-0 bg-[#5f5a55] opacity-0" />

      {/* idle hint */}
      <div
        className={`absolute inset-x-0 bottom-[6vh] flex flex-col items-center gap-1 transition-all duration-1000 ${
          phase === "idle" && hintVisible ? "opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <span className="rounded-full bg-[#f3ede3]/70 px-4 py-1.5 text-[11px] tracking-[0.3em] uppercase text-ink/75 backdrop-blur-sm">
          <span className="animate-pulse">Коснитесь печати</span>
        </span>
        <span className="sr-only">
          {INVITATION.groom} & {INVITATION.bride}
        </span>
      </div>

      {/* sound */}
      {phase !== "idle" && (
        <button
          onClick={toggleMute}
          className="pointer-events-auto absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-[#c9ada3]/50 bg-[#f3ede3]/60 text-[#9c8378] backdrop-blur-md transition hover:bg-[#f3ede3]"
          aria-label={muted ? "Включить звук" : "Выключить звук"}
        >
          {muted ? "♪̸" : "♪"}
        </button>
      )}

      {/* slide dots */}
      {phase === "open" && (
        <nav className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2.5">
          {SLIDES.map((s, i) => (
            <button
              key={s}
              onClick={() => goTo(i)}
              aria-label={`Страница ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === slide ? "w-5 bg-[#b9998f]" : "w-1.5 bg-[#b9998f]/40"}`}
            />
          ))}
        </nav>
      )}
    </div>
  );
}
