import gsap from "gsap";
import { FB, GROUP, S, U } from "./state";

export const CHAPTERS = 8;

type Vars = Record<string, number>;

/**
 * One master timeline. Chapter i owns τ ∈ [i, i+1]. Every property is only driven sequentially
 * (safe to seek anywhere). The story, in order:
 *  0 C = A·B · 1 tiling · 2 map onto the die · 3 inside the SM pair · 4 k-loop (TMA → SMEM ring)
 *  5 tcgen05.mma into TMEM · 6 epilogue · 7 finale
 */
export function buildTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  const to = (t: object, v: Vars, at: number, dur: number, ease = "power1.inOut") =>
    tl.to(t, { ...v, duration: dur, ease }, at);
  const g = (i: number, v: number, at: number, dur = 0.1) => to(S.groups, { [i]: v }, at, dur);
  /** Spotlight a set of hardware units (everything else dims). */
  const focus = (mask: number, at: number) => {
    to(U.uFocusAmt, { value: 0 }, at - 0.04, 0.04, "none");
    tl.set(U.uFocusMask, { value: mask }, at);
    to(U.uFocusAmt, { value: mask ? 1 : 0 }, at, 0.06, "none");
  };

  // ── Camera (stop index along the rig, see camera.ts) ──
  to(S, { camT: 1 }, 0.75, 0.45);
  to(S, { camT: 2 }, 2.0, 0.5);
  to(S, { camT: 3 }, 2.85, 0.5);
  to(S, { camT: 4 }, 3.98, 0.27);
  to(S, { camT: 5 }, 4.95, 0.3);
  to(S, { camT: 6 }, 5.85, 0.25);
  to(S, { camT: 7 }, 6.95, 0.45);

  // ── 1 · tiling: C splits into 32×32 tiles; one tile + its A row strip and B column strip stay lit ──
  to(U.uBand, { value: 0 }, 0.9, 0.25);
  to(U.uGrid, { value: 1 }, 1.1, 0.2);
  to(U.uSweep, { value: 1 }, 1.3, 0.4);
  to(U.uFocus, { value: 1 }, 1.7, 0.15);
  to(U.uTileVis, { value: 1 }, 1.8, 0.1);
  to(U.uSplit, { value: 1 }, 1.88, 0.1);
  to(U.uSlice, { value: 1 }, 1.92, 0.08);

  // ── 2 · the matrices shrink away, the B200 package appears, CTA pairs are handed out ──
  to(S, { matX: -8.85, matY: 8.05, matScale: 0.34 }, 2.0, 0.5);
  to(U.uDieVis, { value: 1 }, 2.2, 0.3);
  g(GROUP.assign, 1, 2.5, 0.05);
  to(U.uAssign, { value: 1 }, 2.5, 0.35);
  g(GROUP.assign, 0, 2.88, 0.08);
  to(U.uDieFocus, { value: 1 }, 2.8, 0.12);
  to(U.uSelLift, { value: 1 }, 2.77, 0.03);
  to(S, { tileFly: 1 }, 2.78, 0.35, "none");
  to(U.uMatVis, { value: 0 }, 2.9, 0.2);
  to(U.uLock, { value: 1 }, 3.08, 0.08);

  // ── 3 · inside the SM pair ──
  to(U.uDetailVis, { value: 1 }, 3.15, 0.25);
  to(U.uTileVis, { value: 0 }, 3.1, 0.1);
  to(U.uDieVis, { value: 0 }, 3.2, 0.2);
  focus(FB.ctl | FB.regs | FB.tmem | FB.tensor | FB.warps | FB.misc, 3.42); // 4 sub-partitions
  focus(FB.tmem, 3.58); // Tensor Memory
  focus(FB.tensor, 3.7); // Tensor Cores
  focus(FB.tma | FB.smem, 3.82); // TMA + shared memory ring
  focus(FB.warps, 3.93); // warp roles

  // ── 4 · the k-loop: TMA streams 64-wide k-blocks from HBM into the 6-slot SMEM ring ──
  focus(FB.tma | FB.smem | FB.hbm, 4.02);
  to(U.uSliceD, { value: 1 }, 4.0, 0.15);
  to(U.uTma, { value: 1 }, 4.1, 0.08);
  g(GROUP.tma, 1, 4.1);
  to(U.uT, { value: 32 }, 4.15, 0.8, "none");

  // ── 5 · one thread issues tcgen05.mma; accumulators build up in Tensor Memory ──
  focus(FB.tma | FB.smem | FB.tensor | FB.tmem | FB.warps, 5.02);
  to(U.uMma, { value: 1 }, 5.02, 0.13);
  g(GROUP.mmaIn, 1, 5.08);
  g(GROUP.mmaOut, 1, 5.12);
  to(U.uT, { value: 133 }, 5.15, 0.8, "none");
  g(GROUP.tma, 0, 5.86, 0.05);
  g(GROUP.mmaIn, 0, 5.94, 0.05);
  g(GROUP.mmaOut, 0, 5.95, 0.05);

  // ── 6 · epilogue: TMEM → registers → SMEM → TMA store; the other TMEM buffer starts the next tile ──
  focus(FB.warps | FB.tmem | FB.regs | FB.smem | FB.hbm, 6.04);
  to(U.uDrain, { value: 1 }, 6.1, 0.45, "none");
  g(GROUP.drain, 1, 6.1);
  to(U.uShrink, { value: 1 }, 6.15, 0.35);
  to(U.uNext, { value: 0.55 }, 6.2, 0.7, "none");
  to(U.uStage, { value: 1 }, 6.4, 0.4, "none");
  g(GROUP.store, 1, 6.45);
  to(U.uStore, { value: 1 }, 6.6, 0.3, "none");
  g(GROUP.drain, 0, 6.65, 0.08);
  g(GROUP.store, 0, 6.9, 0.06);

  // ── 7 · finale: every pair works through the remaining tiles; C fills in waves, then settles ──
  focus(0, 6.97);
  to(U.uMma, { value: 0 }, 6.95, 0.05);
  to(U.uDetailVis, { value: 0 }, 6.97, 0.25);
  to(U.uDieVis, { value: 1 }, 7.0, 0.25);
  to(U.uDieFocus, { value: 0 }, 7.0, 0.2);
  to(U.uABVis, { value: 0 }, 6.9, 0.05);
  to(S, { matX: -1.75, matY: 9.2, matScale: 0.5 }, 6.9, 0.1);
  to(U.uMatVis, { value: 1 }, 7.1, 0.2);
  to(U.uWave, { value: 1 }, 7.25, 0.65, "none");
  to(U.uDone, { value: 1 }, 7.25, 0.65, "none");
  to(U.uCalm, { value: 1 }, 7.88, 0.12);
  tl.set({}, {}, CHAPTERS);

  tl.time(CHAPTERS).time(0); // render through once so each tween records its start value
  return tl;
}
