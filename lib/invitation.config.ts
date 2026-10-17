/**
 * Everything that changes from wedding to wedding lives here:
 * texts, date, venue, colours, optional assets and timeline timings.
 */
export const INVITATION = {
  groom: "Азиз",
  bride: "Мадина",
  monogram: "A & M",
  dateLabel: "24 · 05 · 2027",
  dateLong: "Понедельник, 24 мая 2027",
  time: "18:00",
  venue: "Ресторан «Royal Palace»",
  address: "г. Андижан, ул. Навои, 15",
  // Any Google Maps query or coordinates
  mapQuery: "40.7821,72.3442",
  bismillah: "بسم الله الرحمن الرحيم",
  bismillahTranslation: "Во имя Аллаха, Милостивого, Милосердного",
  invitationTitle: "Дорогие гости!",
  invitationText:
    "С радостью в сердцах приглашаем вас разделить с нами\nсамый светлый день нашей жизни —\nдень нашей свадьбы.",
  signature: "С любовью, семьи жениха и невесты",
  finaleText: "Будем счастливы разделить\nэтот день вместе с вами",
} as const;

export const PALETTE = {
  paper: "#f4ecdf",
  paperEdge: "#e9dcc6",
  paperInner: "#f4ebdc",
  wax: "#c4878a",
  ribbon: "#c99c95",
  ribbonSheen: "#fff1ea",
  foil: "#b8966a", // champagne-bronze foil; use "#c7c9cc" for silver
  ink: "#5a4636",
  petal: ["#f2c7c7", "#e9a9ae", "#f6d9d4", "#dc8f99", "#fbe7e2"],
} as const;

/**
 * Optional hand-painted PNG layers (transparent background) in /public/textures.
 * Every layer has a procedural 3D fallback, so the site works without any of them.
 */
export const TEXTURES = {
  flapLeft: "/textures/flap-left.png",
  flapRight: "/textures/flap-right.png",
  seal: "/textures/seal.png",
  backdrop: "/textures/backdrop.png",
  columnLeft: "/textures/column-left.png",
  columnRight: "/textures/column-right.png",
  garland: "/textures/garland.png",
  doveBody: "/textures/dove-body.png",
  doveWing: "/textures/dove-wing.png",
  fountain: "/textures/fountain.png",
} as const;

export const AUDIO = {
  music: "/audio/music.mp3",
  paper: "/audio/paper.mp3", // optional, synthesised if missing
  ribbon: "/audio/ribbon.mp3", // optional, synthesised if missing
};

/** Opening timeline (seconds from the click on the seal). */
export const TIMELINE = {
  sealLift: 0, // seal pops toward camera
  sealExit: 0.55, // flies off to the right
  ribbonUntie: 0.5, // bow unties, tails fly apart
  flapsOpen: 1.55, // gatefold doors swing to 130°
  flapsDuration: 2.2,
  cameraDolly: 2.1, // camera glides inside
  cameraDuration: 3.2,
  contentIn: 4.4, // first slide focuses in
} as const;

/** Scene dimensions (world units ≈ decimetres). */
export const CARD = {
  flapWidth: 1.05, // each door, closed they meet in the middle
  height: 3.0,
  thickness: 0.018, // ≈ 1.8 mm cotton board at this scale
  scallopRadius: 0.075,
  openAngle: (130 * Math.PI) / 180,
  dioramaZ: -1.2, // the interior "Z = 0" plane
} as const;

export const SLIDES = ["bismillah", "invitation", "names", "venue", "finale"] as const;
export type SlideId = (typeof SLIDES)[number];
