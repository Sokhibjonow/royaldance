/** Depth of each diorama layer above the interior "Z = 0" plane. */
export const LAYER = {
  backdrop: 0,
  frame: 0.2,
  columns: 0.5,
  doves: 0.7,
  text: 0.8,
} as const;

/** Inner arch: straight sides up to `springY`, elliptical top. */
export const ARCH = { halfW: 0.8, bottom: -1.42, springY: 0.72, rise: 0.55 } as const;

export const FOIL = { metalness: 0.85, roughness: 0.2 } as const;
