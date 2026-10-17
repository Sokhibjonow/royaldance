"use client";
/**
 * DOM layer above the canvas: hints, slide navigation (wheel / swipe / keys),
 * sound toggle and the map link.
 */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { INVITATION, SLIDES, TIMELINE } from "@/lib/invitation.config";
import { input, useInvitation } from "@/lib/store";
import { setMuted } from "@/lib/audio";

export default function Overlay() {
  const { phase, slide, muted, next, prev, goTo, toggleMute, setOpen } = useInvitation();
  const [hintVisible, setHintVisible] = useState(false);

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
      if ((e.target as HTMLElement).closest("[data-scrollable]")) return;
      input.gust = Math.min(4, input.gust + Math.min(0.5, Math.abs(e.deltaY) / 400));
      if (Math.abs(e.deltaY) > 20) step(Math.sign(e.deltaY));
    };
    let y0 = 0;
    const onTouchStart = (e: TouchEvent) => (y0 = e.touches[0].clientY);
    const onTouchEnd = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest("[data-scrollable]")) return;
      const dy = y0 - e.changedTouches[0].clientY;
      if (Math.abs(dy) > 50) {
        input.gust = Math.min(4, input.gust + 0.8);
        step(Math.sign(dy));
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea,select")) return;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) step(1);
      if (["ArrowUp", "PageUp"].includes(e.key)) step(-1);
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

  const id = SLIDES[slide];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-ink">
      {/* idle hint */}
      <div
        className={`absolute inset-x-0 bottom-[9vh] flex flex-col items-center gap-2 transition-all duration-1000 ${
          phase === "idle" && hintVisible ? "opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <span className="font-script text-3xl text-champagne drop-shadow-[0_1px_0_rgba(255,255,255,.6)]">
          {INVITATION.groom} & {INVITATION.bride}
        </span>
        <span className="animate-pulse text-xs tracking-[0.35em] uppercase text-ink/70">Коснитесь печати</span>
      </div>

      {/* sound */}
      {phase !== "idle" && (
        <button
          onClick={toggleMute}
          className="pointer-events-auto absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-champagne/40 bg-ivory/60 text-champagne backdrop-blur-md transition hover:bg-ivory"
          aria-label={muted ? "Включить звук" : "Выключить звук"}
        >
          {muted ? "♪̸" : "♪"}
        </button>
      )}

      {/* slide dots */}
      {phase === "open" && (
        <nav className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3">
          {SLIDES.map((s, i) => (
            <button
              key={s}
              onClick={() => goTo(i)}
              aria-label={`Слайд ${i + 1}`}
              className={`h-2.5 w-2.5 rounded-full border border-champagne transition-all duration-500 ${
                i === slide ? "scale-125 bg-champagne" : "bg-transparent hover:bg-champagne/40"
              }`}
            />
          ))}
        </nav>
      )}

      {/* scroll cue */}
      {phase === "open" && slide < SLIDES.length - 1 && id !== "venue" && (
        <button
          onClick={next}
          className="pointer-events-auto absolute inset-x-0 bottom-5 mx-auto flex w-max flex-col items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-ink/60"
        >
          листайте
          <span className="animate-bounce text-lg leading-none">⌄</span>
        </button>
      )}

      {/* venue: map link — kept compact so the fountain stays in view */}
      {phase === "open" && id === "venue" && (
        <a
          key="venue"
          className="focus-in pointer-events-auto absolute inset-x-0 bottom-16 mx-auto flex w-max items-center gap-2 rounded-full border border-champagne/40 bg-ivory/70 px-6 py-3 text-xs uppercase tracking-[0.25em] text-champagne shadow-[0_15px_40px_-18px_rgba(90,70,50,.55)] backdrop-blur-md transition hover:bg-ivory"
          style={{ animationDelay: "1.2s" }}
          href={`https://maps.google.com/?q=${encodeURIComponent(INVITATION.mapQuery)}`}
          target="_blank"
          rel="noreferrer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
          Открыть карту
        </a>
      )}

    </div>
  );
}
