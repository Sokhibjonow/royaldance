"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import gsap from "gsap";
import { AssetsContext } from "@/lib/assets";
import { setAvailableAudio } from "@/lib/audio";
import Overlay from "./ui/Overlay";

// WebGL only on the client
const Scene = dynamic(() => import("./three/Scene"), { ssr: false });

export default function Experience({ available }: { available: string[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setAvailableAudio(available), [available]);
  // ?capture — for headless screenshot runs on software GL: let the timeline run on wall-clock time
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("capture")) gsap.ticker.lagSmoothing(0);
    if (q.has("timescale")) gsap.globalTimeline.timeScale(Number(q.get("timescale")) || 1);
  }, []);

  return (
    <AssetsContext.Provider value={available}>
      <main className="fixed inset-0 select-none">
        <Scene onReady={() => setTimeout(() => setReady(true), 400)} />
        <Overlay />
        {/* ivory curtain while shaders compile */}
        <div
          className={`pointer-events-none absolute inset-0 grid place-items-center bg-[#efe6d8] transition-opacity duration-[1600ms] ${
            ready ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="font-script text-4xl text-champagne">загрузка…</span>
        </div>
      </main>
    </AssetsContext.Provider>
  );
}
