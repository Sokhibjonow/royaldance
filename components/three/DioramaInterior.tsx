"use client";
/**
 * DioramaInterior.tsx — the multi-plane "theatre maquette" inside the card,
 * staged like the reference film:
 *
 *   Bismillah   — two rose-wrapped columns, bouquets at their feet,
 *                 a garland across the top carried by two doves.
 *   Love/Invite — a painted page frame with one column on the left.
 *   Monogram/Venue — the column gives way to a marble fountain and the
 *                 frame blooms with fuller rose clusters.
 *
 * Layers sit at their own depth (Z = 0 wall, +0.5 architecture, +0.7 doves,
 * +0.74 frame, +0.8 text) so pointer / gyro parallax gives real volume.
 */
import { useMemo } from "react";
import { CARD } from "@/lib/invitation.config";
import { useInvitation } from "@/lib/store";
import { Backdrop, Column, PaintedFrame } from "./diorama/Architecture";
import { Fountain } from "./diorama/Fountain";
import { Doves } from "./diorama/Doves";
import { Slides } from "./diorama/Slides";
import { Fade } from "./diorama/Fade";
import { RoseField, cluster, garland, mergeClusters } from "./diorama/Roses";

export const LAYER = { wall: 0, architecture: 0.5, doves: 0.68, frame: 0.74, text: 0.8 } as const;
/** Visible page at the text plane (portrait 9:16) — see lib/rig.ts */
export const PAGE = { halfW: 0.95, halfH: 1.69 } as const;

const COLUMN_X = 0.86;
const COLUMN_BOTTOM = -1.85;
const COLUMN_H = 2.95;

function BismillahStage() {
  const flowers = useMemo(() => {
    const top = COLUMN_BOTTOM + COLUMN_H + 0.05;
    return mergeClusters([
      // bouquets at the column feet
      cluster(-COLUMN_X + 0.08, COLUMN_BOTTOM + 0.32, 0.16, 10, 0.24, 9, 0.1),
      cluster(COLUMN_X - 0.08, COLUMN_BOTTOM + 0.32, 0.16, 10, 0.24, 10, 0.1),
      // crowns on the capitals
      cluster(-COLUMN_X, top, 0.08, 4, 0.12, 7, 0.06),
      cluster(COLUMN_X, top, 0.08, 4, 0.12, 8, 0.06),
      // swags from the capitals to the doves, and the garland in their beaks
      garland([-COLUMN_X + 0.05, top + 0.05, 0.1], [-0.2, 1.36, 0.17], 0.16, 31),
      garland([COLUMN_X - 0.05, top + 0.05, 0.1], [0.2, 1.36, 0.17], 0.16, 32),
      garland([-0.14, 1.4, 0.19], [0.14, 1.4, 0.19], 0.07, 33, 1.4),
      // vines climbing up into the top corners
      garland([-COLUMN_X, top, 0.06], [-COLUMN_X + 0.1, 1.75, 0.06], -0.06, 34),
      garland([COLUMN_X, top, 0.06], [COLUMN_X - 0.1, 1.75, 0.06], 0.06, 35),
    ]);
  }, []);
  return (
    <group position-z={LAYER.architecture}>
      <Column x={-COLUMN_X} height={COLUMN_H} bottom={COLUMN_BOTTOM} vineSeed={3} side="left" />
      <Column x={COLUMN_X} height={COLUMN_H} bottom={COLUMN_BOTTOM} vineSeed={5} side="right" />
      <RoseField roses={flowers.roses} leaves={flowers.leaves} />
      <group position-z={LAYER.doves - LAYER.architecture}>
        <group scale={1.5} position={[0, -0.72, 0]}>
          <Doves y={1.45} gap={0.2} />
        </group>
      </group>
    </group>
  );
}

function FrameColumn() {
  const bouquet = useMemo(() => cluster(-0.66, -1.48, 0.14, 7, 0.16, 21, 0.075), []);
  return (
    <group position-z={LAYER.architecture + 0.08}>
      <group scale={0.85} position={[-0.11, -0.2, 0]}>
        <Column x={-0.74} height={2.9} bottom={-1.6} vineSeed={9} side="left" />
      </group>
      <RoseField roses={bouquet.roses} leaves={bouquet.leaves} />
    </group>
  );
}

function FountainCorner() {
  const flowers = useMemo(
    () =>
      mergeClusters([
        cluster(-0.86, -1.3, 0.2, 9, 0.2, 41, 0.085),
        cluster(-0.15, -1.48, 0.25, 5, 0.14, 42, 0.07),
        cluster(-0.85, -0.85, 0.12, 4, 0.12, 43, 0.06),
      ]),
    []
  );
  return (
    <group position-z={LAYER.architecture + 0.1}>
      <group position={[-0.5, -1.62, 0]} scale={0.95}>
        <Fountain position={[0, 0, 0]} />
      </group>
      <RoseField roses={flowers.roses} leaves={flowers.leaves} />
    </group>
  );
}

export default function DioramaInterior() {
  const slide = useInvitation((s) => s.slide);
  const phase = useInvitation((s) => s.phase);
  const inside = phase !== "idle";
  // frame plane sits a touch behind the text → scale it so it still fills the page
  const k = 1.03;

  return (
    <group position={[0, 0, CARD.dioramaZ]}>
      <group position-z={LAYER.wall}>
        <Backdrop />
      </group>

      <Fade show={slide === 0} duration={1.1}>
        <BismillahStage />
      </Fade>

      <Fade show={inside && slide >= 1} duration={1.3} delay={0.35}>
        <group position-z={LAYER.frame}>
          <PaintedFrame width={PAGE.halfW * 2 * k} height={PAGE.halfH * 2 * k} lush={false} />
        </group>
      </Fade>
      <Fade show={inside && slide >= 3} duration={1.4}>
        <group position-z={LAYER.frame + 0.002}>
          <PaintedFrame width={PAGE.halfW * 2 * k} height={PAGE.halfH * 2 * k} lush />
        </group>
      </Fade>

      <Fade show={inside && (slide === 1 || slide === 2)} duration={1.3} delay={0.35}>
        <FrameColumn />
      </Fade>
      <Fade show={inside && slide >= 3} duration={1.4}>
        <FountainCorner />
      </Fade>

      <group position-z={LAYER.text}>
        <Slides />
      </group>
    </group>
  );
}
