import gsap from "gsap";
import { FB, GROUP, S, U } from "./state";

export const CHAPTERS = 8;

/**
 * How the player dwells in each chapter. The master timeline (τ) is *not* driven by scroll: scrolling only picks
 * the active chapter; the player then travels τ to the chapter's `arrive` point (camera pans, visibility changes)
 * and loops the chapter's data-movement animation between `l0` and `l1`.
 *  - static:   no loop (hero loops through uTime)
 *  - pingpong: forward then backward (smooth, for state changes: tiling, scheduling, unit tour)
 *  - wrap:     forward only, restarts (data movement; the SMEM ring is periodic so the restart is seamless)
 *  - once:     plays to the end and stays
 */
export interface Dwell {
  arrive: number;
  l0: number;
  l1: number;
  mode: "static" | "pingpong" | "wrap" | "once";
  /** seconds for one pass l0 → l1 */
  secs: number;
}
export const DWELL: Dwell[] = [
  { arrive: 0.3, l0: 0.3, l1: 0.3, mode: "static", secs: 1 },
  { arrive: 1.4, l0: 1.4, l1: 1.99, mode: "pingpong", secs: 7.5 },
  { arrive: 2.45, l0: 2.45, l1: 2.99, mode: "pingpong", secs: 5.5 },
  { arrive: 3.45, l0: 3.45, l1: 3.99, mode: "pingpong", secs: 12 },
  { arrive: 4.4, l0: 4.4, l1: 5.0, mode: "wrap", secs: 10 },
  { arrive: 5.4, l0: 5.4, l1: 6.0, mode: "wrap", secs: 12 },
  { arrive: 6.4, l0: 6.4, l1: 7.0, mode: "wrap", secs: 10 },
  { arrive: 7.45, l0: 7.45, l1: 8.0, mode: "once", secs: 6 },
];

type Vars = Record<string, number>;

/**
 * One master timeline. Chapter i owns τ ∈ [i, i+1]: the first ~0.4 is the transition in (camera pan + other minor
 * changes), the rest is the dwell/loop window. Every property is only driven sequentially (safe to seek anywhere).
 *  0 C = A·B · 1 tiling · 2 map onto the die · 3 inside the SM pair · 4 k-loop (TMA → SMEM ring)
 *  5 tcgen05.mma into TMEM · 6 epilogue · 7 finale
 */
export function buildTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  const to = (t: object, v: Vars, at: number, dur: number, ease = "none") =>
    tl.to(t, { ...v, duration: dur, ease }, at);
  const g = (i: number, v: number, at: number, dur = 0.06) => to(S.groups, { [i]: v }, at, dur);
  /** Spotlight a set of hardware units (everything else dims). */
  const focus = (mask: number, at: number) => {
    to(U.uFocusAmt, { value: 0 }, at - 0.03, 0.03);
    tl.set(U.uFocusMask, { value: mask }, at);
    to(U.uFocusAmt, { value: mask ? 1 : 0 }, at, 0.05);
  };

  // ── Camera pans (stop index along the rig, see camera.ts) ──
  to(S, { camT: 1 }, 1.0, 0.4);
  to(S, { camT: 2 }, 2.0, 0.45);
  to(S, { camT: 3 }, 3.0, 0.45);
  to(S, { camT: 4 }, 4.0, 0.4);
  to(S, { camT: 5 }, 5.0, 0.35);
  to(S, { camT: 6 }, 6.0, 0.35);
  to(S, { camT: 7 }, 7.0, 0.45);

  // ── 1 · tiling: coarse hero grid refines into 32×32; one tile + its strips stay lit ──
  to(U.uBand, { value: 0 }, 1.05, 0.15);
  to(U.uRefine, { value: 1 }, 1.1, 0.2);
  to(U.uGrid, { value: 1 }, 1.25, 0.15);
  to(U.uSweep, { value: 1 }, 1.45, 0.35); // swizzled raster order
  to(U.uFocus, { value: 1 }, 1.8, 0.1);
  to(U.uTileVis, { value: 1 }, 1.85, 0.07);
  to(U.uSplit, { value: 1 }, 1.92, 0.06);
  to(U.uSlice, { value: 1 }, 1.94, 0.06);

  // ── 2 · matrices shrink away, the B200 package appears, CTA pairs are dealt out, our tile lands ──
  to(S, { matX: -8.85, matY: 8.05, matScale: 0.34 }, 2.0, 0.45);
  to(U.uDieVis, { value: 1 }, 2.15, 0.3);
  g(GROUP.assign, 1, 2.5, 0.03);
  to(U.uAssign, { value: 1 }, 2.5, 0.4);
  g(GROUP.assign, 0, 2.92, 0.05);
  to(U.uDieFocus, { value: 1 }, 2.8, 0.1);
  to(U.uSelLift, { value: 1 }, 2.62, 0.03);
  to(S, { tileFly: 1 }, 2.65, 0.3);
  to(U.uLock, { value: 1 }, 2.95, 0.04);

  // ── 3 · dive into the SM pair, then tour its units ──
  to(U.uMatVis, { value: 0 }, 3.0, 0.15);
  to(U.uTileVis, { value: 0 }, 3.05, 0.1);
  to(U.uDetailVis, { value: 1 }, 3.2, 0.25);
  to(U.uDieVis, { value: 0 }, 3.25, 0.2);
  focus(FB.ctl | FB.regs | FB.tmem | FB.tensor | FB.warps | FB.misc, 3.52); // 4 sub-partitions
  focus(FB.tmem, 3.64); // Tensor Memory
  focus(FB.tensor, 3.76); // Tensor Cores
  focus(FB.tma | FB.smem, 3.88); // TMA + shared memory ring
  focus(FB.warps, 3.97); // warp roles

  // ── 4 · k-loop: TMA streams 64-wide k-blocks from HBM into the 6-slot SMEM ring ──
  focus(FB.tma | FB.smem | FB.hbm, 4.05);
  to(U.uSliceD, { value: 1 }, 4.05, 0.15);
  to(U.uTma, { value: 1 }, 4.2, 0.08);
  g(GROUP.tma, 1, 4.2);
  to(U.uT, { value: 6 }, 4.2, 0.2); // prologue: the ring fills slot by slot
  to(U.uT, { value: 30 }, 4.4, 0.6); // 24 blocks = 4 ring cycles, so the loop restart is seamless

  // ── 5 · one thread issues tcgen05.mma; accumulators build up in Tensor Memory ──
  focus(FB.tma | FB.smem | FB.tensor | FB.tmem | FB.warps, 5.05);
  to(U.uT, { value: 36 }, 5.0, 0.4);
  to(U.uMma, { value: 1 }, 5.1, 0.15);
  g(GROUP.mmaIn, 1, 5.2);
  g(GROUP.mmaOut, 1, 5.25);
  to(U.uT, { value: 60 }, 5.4, 0.6);
  to(U.uAcc, { value: 1 }, 5.4, 0.5);

  // ── 6 · epilogue: TMEM → registers → SMEM → TMA store; the other TMEM buffer starts the next tile ──
  g(GROUP.tma, 0, 6.0, 0.05);
  g(GROUP.mmaIn, 0, 6.0, 0.05);
  g(GROUP.mmaOut, 0, 6.0, 0.05);
  focus(FB.warps | FB.tmem | FB.regs | FB.smem | FB.hbm, 6.06);
  to(U.uDrain, { value: 1 }, 6.42, 0.28);
  g(GROUP.drain, 1, 6.42);
  g(GROUP.drain, 0, 6.7);
  to(U.uShrink, { value: 1 }, 6.45, 0.2);
  to(U.uNext, { value: 0.55 }, 6.45, 0.5);
  to(U.uStage, { value: 1 }, 6.62, 0.2);
  g(GROUP.store, 1, 6.66);
  to(U.uStore, { value: 1 }, 6.74, 0.2);
  g(GROUP.store, 0, 6.94);

  // ── 7 · finale: every pair works through the remaining tiles; C fills in waves, then settles ──
  focus(0, 7.0);
  to(U.uMma, { value: 0 }, 7.0, 0.05);
  to(U.uDetailVis, { value: 0 }, 7.0, 0.2);
  to(U.uDieVis, { value: 1 }, 7.05, 0.25);
  to(U.uDieFocus, { value: 0 }, 7.05, 0.2);
  to(U.uABVis, { value: 0 }, 7.0, 0.05);
  to(S, { matX: -1.75, matY: 9.2, matScale: 0.5 }, 7.0, 0.1);
  to(U.uMatVis, { value: 1 }, 7.15, 0.2);
  to(U.uWave, { value: 1 }, 7.5, 0.45);
  to(U.uDone, { value: 1 }, 7.5, 0.45);
  to(U.uCalm, { value: 1 }, 7.9, 0.1);
  tl.set({}, {}, CHAPTERS);

  tl.time(CHAPTERS).time(0); // render through once so each tween records its start value
  return tl;
}
