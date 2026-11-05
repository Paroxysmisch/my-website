import { Vector3 } from "three";
import { GPU, SELECTED, selectedPair, tilesN } from "./kernel";

/* ───────────────────────── matrices: A (left) · B (top) · C (bottom right), in the XY plane ── */
export const MAT = { S: 6, gap: 0.5 };
export const MAT_POS = new Vector3(0.25, -0.25, 1.0);
const TILE_W = MAT.S / tilesN;
/** Centre of tile (row, col) in the matrix group's local frame (C's top-left corner is the origin). */
export const tileLocal = (row: number, col: number) =>
  new Vector3((col + 0.5) * TILE_W, -(row + 0.5) * TILE_W, 0);
export const SEL_TILE_LOCAL = tileLocal(SELECTED.row, SELECTED.col);
export const TILE_SIZE = TILE_W;

/* ───────────────────────── B200 package, from the die-shot reference (units: 1 = 100 px) ───── */
const CX = 967.5;
const CY = 717.5;
type Rect = [number, number, number, number]; // px x, y, w, h of the LEFT die in the reference image

const px = (r: Rect, mirror: boolean) => {
  const x = mirror ? 1935 - r[0] - r[2] : r[0];
  return {
    cx: (x + r[2] / 2 - CX) / 100,
    cy: (CY - (r[1] + r[3] / 2)) / 100,
    w: r[2] / 100,
    h: r[3] / 100,
  };
};

export interface DieBlock {
  kind: "die" | "hbmctrl" | "io" | "gpc" | "l2" | "giga" | "dec" | "hbi" | "hbm";
  cx: number;
  cy: number;
  w: number;
  h: number;
  die: number;
}

const DIE_RECT: Rect = [240, 265, 705, 905];
const BLOCKS: [DieBlock["kind"], Rect][] = [
  ["hbmctrl", [345, 275, 230, 70]],
  ["hbmctrl", [655, 275, 260, 70]],
  ["hbmctrl", [345, 1075, 230, 70]],
  ["hbmctrl", [655, 1075, 260, 70]],
  ["io", [262, 275, 118, 840]],
  ["l2", [582, 352, 133, 320]],
  ["l2", [582, 752, 133, 320]],
  ["giga", [382, 678, 477, 67]],
  ["dec", [862, 678, 52, 67]],
  ["hbi", [920, 275, 25, 870]],
];
/** GPC rectangles in image px: TL, TR, BL, BR (per die) */
const GPC_RECTS: Rect[] = [
  [382, 350, 195, 322],
  [718, 350, 195, 322],
  [382, 752, 195, 320],
  [718, 752, 195, 320],
];
const HBM_STACKS: Rect[] = [
  [345, 150, 230, 105],
  [655, 150, 260, 105],
  [345, 1185, 230, 105],
  [655, 1185, 260, 105],
];

export const dieBlocks: DieBlock[] = [];
for (const die of [0, 1]) {
  const m = die === 1;
  dieBlocks.push({ kind: "die", ...px(DIE_RECT, m), die });
  for (const [kind, r] of BLOCKS) dieBlocks.push({ kind, ...px(r, m), die });
  for (const r of GPC_RECTS) dieBlocks.push({ kind: "gpc", ...px(r, m), die });
  for (const r of HBM_STACKS) dieBlocks.push({ kind: "hbm", ...px(r, m), die });
}

/** SM tiles on the die: 4 columns x 5 rows per GPC; TPC (= CTA pair) = two adjacent columns. */
export interface DieSm {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** global CTA pair id, or -1 for a fused-off TPC */
  pair: number;
  die: number;
}
export interface DiePair {
  id: number;
  cx: number;
  cy: number;
  die: number;
}
export const dieSmsPairPos: Vector3[] = [];
export const dieSms: DieSm[] = [];
export const dieGpcCenters: { cx: number; cy: number; die: number }[] = [];
export const diePairs: DiePair[] = [];
{
  let pairId = 0;
  for (const die of [0, 1]) {
    GPC_RECTS.forEach((r, gi) => {
      const g = px(r, die === 1);
      dieGpcCenters.push({ cx: g.cx, cy: g.cy, die });
      const cw = g.w / 4;
      const ch = g.h / 5;
      for (let tpc = 0; tpc < GPU.tpcsPerGpc; tpc++) {
        const row = Math.floor(tpc / 2);
        const cpair = tpc % 2;
        // three TPCs per die are fused off (last TPC of the first three GPCs): 37 of 40 pairs enabled
        const off = gi < 3 && tpc === GPU.tpcsPerGpc - 1;
        const id = off ? -1 : pairId++;
        const sx = [] as number[];
        for (const c of [cpair * 2, cpair * 2 + 1]) {
          const x = g.cx - g.w / 2 + (c + 0.5) * cw;
          const y = g.cy + g.h / 2 - (row + 0.5) * ch;
          dieSms.push({ cx: x, cy: y, w: cw * 0.86, h: ch * 0.86, pair: id, die });
          sx.push(x);
        }
        if (id >= 0) {
          dieSmsPairPos[id] = new Vector3(
            (sx[0] as number) / 2 + (sx[1] as number) / 2,
            g.cy + g.h / 2 - (row + 0.5) * ch,
            0.1,
          );
          diePairs.push({ id, cx: dieSmsPairPos[id].x, cy: dieSmsPairPos[id].y, die });
        }
      }
    });
  }
}
export const PAIR_POS = dieSmsPairPos[selectedPair] as Vector3;
export const DIE_SM_W = (dieSms[0] as DieSm).w;
export const DIE_SM_H = (dieSms[0] as DieSm).h;
/** Gigathread engine centre per die (where CTAs are handed out from). */
export const gigaCenter = (die: number) => {
  const b = dieBlocks.find((d) => d.kind === "giga" && d.die === die) as DieBlock;
  return new Vector3(b.cx, b.cy, 0.1);
};

/* ───────────────────────── "inside the SM pair": local units, scaled onto the pair on the die ── */
export const SM_W = 20;
export const SM_H = 31;
export const SM_X = [-10.6, 10.6] as const;
export const DETAIL_K = 0.0205;
export const DETAIL_POS = new Vector3(0, 0, 0.2);
export const detail = (x: number, y: number, z = 0) =>
  new Vector3(x, y, z).multiplyScalar(DETAIL_K).add(DETAIL_POS);

/** Rebuilt once the pair position is known. */
export function placeDetail() {
  DETAIL_POS.set(PAIR_POS.x, PAIR_POS.y, 0.2);
}
placeDetail();

/** SM-local layout (origin = SM centre, y up). Mirrors the reference SM diagram. */
const TOP = SM_H / 2;
export const SM_L = {
  icache: { y: TOP - 0.9, h: 0.8 },
  spRows: [
    { top: TOP - 1.6, bottom: TOP - 12.4 },
    { top: TOP - 12.7, bottom: TOP - 23.5 },
  ],
  spW: 9.45,
  spX: [-4.875, 4.875],
  tma: { y: -8.8, h: 1.0 },
  smem: { y: -11.4, h: 3.6 },
  tex: { y: -13.9, h: 0.8 },
};
/** Sub-partition q (0..3): TL, TR, BL, BR. Returns local centre x/y and internal block positions. */
export function subPartition(q: number) {
  const col = q % 2;
  const row = Math.floor(q / 2);
  const r = SM_L.spRows[row] as { top: number; bottom: number };
  const cx = SM_L.spX[col] as number;
  const innerW = SM_L.spW - 0.5;
  let cursor = r.top - 0.25;
  const take = (h: number) => {
    const y = cursor - h / 2;
    cursor -= h + 0.14;
    return y;
  };
  const l0 = take(0.5);
  const sched = take(0.9);
  const dispatch = take(0.45);
  const regs = take(0.95);
  const tmem = take(1.25);
  const coresH = 4.2;
  const cores = take(coresH);
  const ldst = take(0.8);
  return {
    q,
    cx,
    cy: (r.top + r.bottom) / 2,
    w: SM_L.spW,
    h: r.top - r.bottom,
    innerW,
    l0,
    sched,
    dispatch,
    regs,
    tmem,
    cores,
    coresH,
    ldst,
    top: r.top,
  };
}
export const RING = { slotW: 2.45, gap: 0.2, h: 3.0, count: 6 };
export const ringX = (i: number) => -9.25 + RING.slotW / 2 + i * (RING.slotW + RING.gap);
export const STAGING = { x: 8.55, w: 2.4 };
/** vertical positions of the HBM region below the SM pair (detail units) */
export const STRIP = { a: -20.5, b: -22.7, h: 0.95, half: 9 };
export const HBM_SLAB = { y: -25.4, h: 1.5, w: 41.6 };
export const C_THUMB = { cx: 0, cy: -29.8, size: 5.2 };
