/**
 * Everything that changes from wedding to wedding lives here:
 * texts, date, venue, colours, optional assets and timeline timings.
 *
 * Every text block is an optional Arabic line plus a Russian line,
 * typeset like the reference: dark taupe ink on cream paper.
 * Set an `ar` field to "" to hide the Arabic line.
 */
export const INVITATION = {
  groom: "Азиз",
  bride: "Мадина",
  /** big silver monogram (two initials) */
  initials: "AM",
  date: "24.05.2027",
  time: "18:00",
  venue: "Royal Palace",
  venueSub: "Андижан",
  // Any Google Maps query or coordinates — tapping the venue opens it
  mapQuery: "40.7821,72.3442",

  bismillah: "بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  love: { ar: "بكل الحب والامتنان،", ru: "С любовью и благодарностью" },
  invite: {
    ar: "ندعوكم لتشهدوا بداية فصل جديد\nمن حياتنا",
    ru: "приглашаем вас стать свидетелями\nначала новой главы\nнашей жизни.",
  },
  dua: "اللهم بارك لنا وبارك علينا واجمع بيننا في خير",
  presence: {
    ar: "حضوركم يسعدنا ويزيد فرحنا جمالاً",
    ru: "Ваше присутствие порадует нас и сделает\nнаш праздник ещё прекраснее.",
  },
} as const;

export const PALETTE = {
  paper: "#f6f1e9",
  paperEdge: "#e7ddcf",
  paperInner: "#efe8dd",
  wall: "#f1ede7",
  ink: "#5c5049", // text
  toile: "#6f6256", // pen-drawn vines on the doors
  wax: "#c9a5a3", // dusty pink oval seal
  ribbon: "#d4c0a9", // ivory silk with frayed edges
  ribbonSheen: "#fffaf3",
  marble: "#efe7da",
  petal: ["#f1cfc8", "#e8b9b3", "#f6dfd8", "#ddb0aa"],
  leaf: ["#a7b195", "#98a387", "#b6bea6"],
} as const;

/**
 * Optional hand-painted PNG layers (transparent background) in /public/textures.
 * Every layer has a procedural fallback, so the site works without any of them.
 */
export const TEXTURES = {
  flapLeft: "/textures/flap-left.png",
  flapRight: "/textures/flap-right.png",
  seal: "/textures/seal.png",
  backdrop: "/textures/backdrop.png",
  frame: "/textures/frame.png",
  columnLeft: "/textures/column-left.png",
  columnRight: "/textures/column-right.png",
  doveBody: "/textures/dove-body.png",
  doveWing: "/textures/dove-wing.png",
  fountain: "/textures/fountain.png",
} as const;

export const AUDIO = {
  music: "/audio/music.mp3",
  paper: "/audio/paper.mp3", // optional, synthesised if missing
  ribbon: "/audio/ribbon.mp3", // optional, synthesised if missing
};

/** Opening timeline (seconds from the tap on the seal) — paced like the reference video. */
export const TIMELINE = {
  sealLift: 0, // seal pops toward the camera
  sealExit: 0.4, // drops away to the bottom right
  ribbonUntie: 1.0, // bow loops widen, then slide off
  ribbonDuration: 1.8,
  flapsOpen: 2.7, // side doors swing open
  flapsDuration: 1.6,
  innerFlaps: 3.7, // top & bottom scalloped flaps fold away
  innerDuration: 1.3,
  linerFade: 4.4, // inner sheet dissolves into the diorama
  cameraDolly: 2.8,
  cameraDuration: 2.9,
  contentIn: 5.2,
} as const;

/** Seconds each slide stays before the story moves on by itself (last one stays). */
export const AUTOPLAY = [4.2, 4.2, 5.2, 5.2] as const;

/** Scene dimensions (world units ≈ decimetres). */
export const CARD = {
  flapWidth: 1.05, // each door; closed they meet in the middle
  height: 3.0,
  thickness: 0.018, // ≈ 1.8 mm cotton board
  openAngle: (130 * Math.PI) / 180,
  dioramaZ: -1.2, // the interior "Z = 0" plane
} as const;

export const SLIDES = ["bismillah", "love", "invite", "monogram", "venue"] as const;
export type SlideId = (typeof SLIDES)[number];
