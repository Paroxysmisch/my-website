import { Vector3 } from "three";
import { ctaPairs, GPU, pairsPerDie, selectedPair, SELECTED, tilesN } from "./kernel";

/** Iteration-space cube. C = front (+z), A = left (-x), B = top (+y); k runs along z. */
export const CUBE = 6;
const TILE_W = CUBE / tilesN;
export const tileLocal = (row: number, col: number) =>
  new Vector3(-CUBE / 2 + (col + 0.5) * TILE_W, CUBE / 2 - (row + 0.5) * TILE_W, CUBE / 2);
export const SEL_TILE_LOCAL = tileLocal(SELECTED.row, SELECTED.col);
export const TILE_SIZE = TILE_W;

/** B200 package, lying in the z = 0 plane. */
export const DIE = { w: 9, h: 10, gap: 0.4 };
export const dieCenterX = (die: number) => (die === 0 ? -1 : 1) * (DIE.w / 2 + DIE.gap / 2);
export const SM_PITCH = 0.8;
export const SM_SIZE = 0.72;
const SM_COLS = 10;
export const HBM = { w: 1.0, h: 2.2, pitch: 2.5 };

/** SM `i` (0..147): die, and local grid position. SMs 2p and 2p+1 form CTA pair p. */
export function smPosition(i: number) {
  const die = i < GPU.smsPerDie ? 0 : 1;
  const idx = i % GPU.smsPerDie;
  const col = idx % SM_COLS;
  const row = Math.floor(idx / SM_COLS);
  return new Vector3(
    dieCenterX(die) + (-((SM_COLS - 1) / 2) + col) * SM_PITCH,
    ((7 - 1) / 2 - row + 0.5) * SM_PITCH,
    0.05,
  );
}
export const pairPosition = (p: number) =>
  smPosition(2 * p).add(smPosition(2 * p + 1)).multiplyScalar(0.5);
export const PAIR_POS = pairPosition(selectedPair);

/** Detail ("inside the SM pair") group: local units, scaled to sit exactly on the chosen pair. */
export const DETAIL_K = (2 * SM_SIZE + (SM_PITCH - SM_SIZE)) / 42; // pair width / detail width
export const DETAIL_POS = PAIR_POS.clone().setZ(0.2);
export const SM_HALF = 10;
export const SM_X = [-11, 11] as const;
export const detail = (x: number, y: number, z = 0) =>
  new Vector3(x, y, z).multiplyScalar(DETAIL_K).add(DETAIL_POS);

/** Inside one SM (local to SM centre) */
export const RING = { cx: -4.5, cy: 0.5, r: 3.2, w: 2.4, h: 1.3 };
export const TMA_POS = { x: -8, y: 7.5 };
export const TMEM = { cx: 5.25, cy: 3.8, w: 8.5, h: 2.125 };
export const TENSOR = { cx: 5.25, cy: -0.5, w: 8, h: 3 };
export const REGS = { cx: 5.25, cy: -4.6, w: 8, h: 1.8 };
export const WARP_Y = -8.2;
export const warpX = (i: number) => -7.5 + i * 3;
export const STRIP = { a: 14.8, b: 16.8, x0: -9, x1: 9, h: 1.0 };
export const SLAB = { y: 19.8, h: 2.0, w: 42 };
export const LANES = { cy: -19.5, w: 42, h: 8 };

export function slotCenter(i: number) {
  const a = Math.PI / 2 - (i * Math.PI) / 3;
  return { x: RING.cx + Math.cos(a) * RING.r, y: RING.cy + Math.sin(a) * RING.r, rot: a - Math.PI / 2 };
}
export { ctaPairs, pairsPerDie };
