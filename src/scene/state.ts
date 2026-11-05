import { Vector2 } from "three";
import { SELECTED } from "./kernel";

const f = (v = 0) => ({ value: v });

/** Shared uniforms: the timeline tweens `.value`, shaders read them. The CPU never touches instances per frame. */
export const U = {
  uTime: f(),
  uFlowT: f(),
  uCubeVis: f(1),
  uPkgVis: f(),
  uDetailVis: f(),
  uStreak: f(1),
  uTileReveal: f(),
  uFocus: f(),
  uSelLift: f(),
  uTileVis: f(),
  uDone: f(),
  uCalm: f(),
  uAssign: f(),
  uLock: f(),
  uWave: f(),
  uRevTma: f(),
  uRevSmem: f(),
  uRevTmem: f(),
  uRevTensor: f(),
  uRevWarps: f(),
  uSlice: f(),
  uK: f(),
  uTmaOn: f(),
  uMma: f(),
  uLanes: f(),
  uDrain: f(),
  uShrink: f(),
  uStage: f(),
  uStore: f(),
  uNext: f(),
  uBridge: f(),
  uSel: { value: new Vector2(SELECTED.col, SELECTED.row) },
};

/** Plain (non-uniform) animated state. */
export const S = {
  camT: 0,
  tileFly: 0,
  cubeY: 0,
  cubeScale: 1,
  /** master timeline position in chapter units (chapter i spans [i, i+1]) */
  tau: 0,
  /** flow group intensities (see flow.vert.glsl) */
  groups: [0, 0, 0, 0, 0, 0, 0, 0] as number[],
};

export const GROUP = {
  cubeA: 0,
  cubeB: 1,
  cubeC: 2,
  tma: 3,
  mmaIn: 4,
  mmaOut: 5,
  drain: 6,
  store: 7,
};
