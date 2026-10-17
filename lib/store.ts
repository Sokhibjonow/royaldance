import { create } from "zustand";
import { SLIDES } from "./invitation.config";

export type Phase = "idle" | "opening" | "open";

type State = {
  phase: Phase;
  slide: number;
  muted: boolean;
  open: () => void;
  setOpen: () => void;
  goTo: (i: number) => void;
  next: () => void;
  prev: () => void;
  toggleMute: () => void;
};

/**
 * High-frequency input (pointer, gyro, wind) lives outside React state so
 * it can be written 60x/s without re-rendering anything.
 */
export const input = {
  /** -1..1 target tilt from pointer or device orientation */
  tx: 0,
  ty: 0,
  /** pointer velocity in NDC/s — used as wind by the petals */
  vx: 0,
  vy: 0,
  /** accumulated wind gust from scroll / swipe / slide changes, decays */
  gust: 0,
  gyro: false,
};

export const useInvitation = create<State>((set, get) => ({
  phase: "idle",
  slide: 0,
  muted: false,
  open: () => {
    if (get().phase === "idle") set({ phase: "opening" });
  },
  setOpen: () => set({ phase: "open" }),
  goTo: (i) => {
    const slide = Math.max(0, Math.min(SLIDES.length - 1, i));
    if (slide !== get().slide && get().phase === "open") {
      input.gust = Math.min(4, input.gust + 1.4);
      set({ slide });
    }
  },
  next: () => get().goTo(get().slide + 1),
  prev: () => get().goTo(get().slide - 1),
  toggleMute: () => set({ muted: !get().muted }),
}));
