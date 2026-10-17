"use client";
/**
 * DioramaInterior.tsx — the multi-plane "theatre maquette" inside the card.
 *
 *   Z = 0     ivory backdrop + inner paper sheet (gobo foliage light lands here)
 *   Z = +0.2  far rose garlands + thin foil arch frame
 *   Z = +0.5  marble columns, fountain, near roses
 *   Z = +0.7  doves
 *   Z = +0.8  text slides
 *   Z = +1.0 … +2.5  3D rose petals (RosePetals3D, in world space)
 *
 * Every layer sits at its own depth, so camera dolly + pointer / gyro
 * parallax produce real optical volume.
 */
import { useMemo } from "react";
import { CARD } from "@/lib/invitation.config";
import { ARCH, LAYER } from "./diorama/layers";
import { ArchFrame, Backdrop, COLUMN, Columns } from "./diorama/Architecture";
import { Fountain } from "./diorama/Fountain";
import { Doves } from "./diorama/Doves";
import { Slides } from "./diorama/Slides";
import { RoseField, cluster, mergeClusters } from "./diorama/Roses";

const COLUMN_X = 0.93;

export default function DioramaInterior() {
  // far garland: blooms swag along the top of the arch
  const far = useMemo(() => {
    const list = [];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.12 + (i / (n - 1)) * 0.76);
      const x = Math.cos(a) * ARCH.halfW;
      const y = ARCH.springY + Math.sin(a) * ARCH.rise;
      list.push(cluster(x, y, 0, i % 2 ? 3 : 4, 0.08, 100 + i, 0.06));
    }
    return mergeClusters(list);
  }, []);

  // near roses: crowns on the capitals and bouquets at the column feet
  const near = useMemo(() => {
    const top = COLUMN.bottom + COLUMN.height + 0.04;
    return mergeClusters([
      cluster(-COLUMN_X, top, 0.08, 6, 0.14, 7, 0.085),
      cluster(COLUMN_X, top, 0.08, 6, 0.14, 8, 0.085),
      cluster(-COLUMN_X + 0.05, COLUMN.bottom + 0.12, 0.14, 7, 0.17, 9, 0.09),
      cluster(COLUMN_X - 0.05, COLUMN.bottom + 0.12, 0.14, 7, 0.17, 10, 0.09),
      cluster(-0.5, COLUMN.bottom + 0.05, 0.1, 4, 0.1, 11, 0.07),
      cluster(0.5, COLUMN.bottom + 0.05, 0.1, 4, 0.1, 12, 0.07),
    ]);
  }, []);

  return (
    <group position={[0, 0, CARD.dioramaZ]}>
      <group position-z={LAYER.backdrop}>
        <Backdrop />
      </group>

      <group position-z={LAYER.frame}>
        <ArchFrame />
        <RoseField roses={far.roses} leaves={far.leaves} />
      </group>

      <group position-z={LAYER.columns}>
        <Columns x={COLUMN_X} />
        <Fountain position={[0, COLUMN.bottom, -0.05]} />
        <RoseField roses={near.roses} leaves={near.leaves} />
      </group>

      <group position-z={LAYER.doves}>
        <Doves />
      </group>

      <group position-z={LAYER.text}>
        <Slides />
      </group>
    </group>
  );
}
