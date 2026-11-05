import { Vector2 } from "three";
import { SELECTED } from "./kernel";

const f = (v = 0) => ({ value: v });

/** Shared uniforms: the timeline tweens `.value`, shaders read them. The CPU never touches instances. */
export const U = {
  uTime: f(),
  uFlowT: f(),
  // matrices
  uMatVis: f(1),
  uABVis: f(1),
  uBand: f(1),
  uGrid: f(),
  uSweep: f(),
  uFocus: f(),
  uSplit: f(),
  uSlice: f(),
  uSelLift: f(),
  uTileVis: f(),
  uDone: f(),
  uCalm: f(),
  // die
  uDieVis: f(),
  uDieFocus: f(),
  uAssign: f(),
  uLock: f(),
  uWave: f(),
  // inside the SM pair
  uDetailVis: f(),
  uFocusMask: f(),
  uFocusAmt: f(),
  uSliceD: f(),
  /** k-block time: block b is loaded during [b, b+1) and consumed by the MMA during [b+5, b+6) */
  uT: f(),
  uTma: f(),
  uMma: f(),
  uDrain: f(),
  uShrink: f(),
  uStage: f(),
  uStore: f(),
  uNext: f(),
  uSel: { value: new Vector2(SELECTED.col, SELECTED.row) },
};

/** Plain (non-uniform) animated state. */
export const S = {
  camT: 0,
  tileFly: 0,
  /** matrices group transform (hero → finale) */
  matX: 0,
  matY: 0,
  matScale: 1,
  /** master timeline position in chapter units (chapter i spans [i, i+1]) */
  tau: 0,
  /** flow group intensities (see flow.vert.glsl) */
  groups: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as number[],
};

export const GROUP = {
  matA: 0,
  matB: 1,
  matC: 2,
  assign: 3,
  tma: 4,
  mmaIn: 5,
  mmaOut: 6,
  drain: 7,
  store: 8,
};

/** Focus bit mask (detail): instances carry a bit; the focused set stays bright, the rest dims. */
export const FB = {
  ctl: 1,
  regs: 2,
  tmem: 4,
  tensor: 8,
  tma: 16,
  smem: 32,
  warps: 64,
  hbm: 128,
  misc: 256,
};
