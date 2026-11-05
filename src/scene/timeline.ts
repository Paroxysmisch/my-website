import gsap from "gsap";
import { GROUP, S, U } from "./state";

export const CHAPTERS = 8;

type Vars = Record<string, number>;

/**
 * One master timeline. Chapter i owns τ ∈ [i, i+1]; tweens are ordered so every property is
 * only ever driven sequentially (safe to seek anywhere).
 */
export function buildTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "none" } });
  const to = (t: object, v: Vars, at: number, dur: number, ease = "power1.inOut") =>
    tl.to(t, { ...v, duration: dur, ease }, at);
  const g = (i: number, v: number, at: number, dur = 0.12) => to(S.groups, { [i]: v }, at, dur);

  // ── Camera: stop index along the rig (see camera.ts) ──────────────────────────
  to(S, { camT: 1 }, 0.7, 0.5);
  to(S, { camT: 2 }, 2.0, 0.55);
  to(S, { camT: 3 }, 2.95, 0.5);
  to(S, { camT: 4 }, 3.95, 0.3);
  to(S, { camT: 5 }, 4.95, 0.3);
  to(S, { camT: 6 }, 5.6, 0.35);
  to(S, { camT: 7 }, 6.0, 0.3);
  to(S, { camT: 8 }, 6.9, 0.5);

  // ── 1: tiling — C partitions, tiles light in swizzled raster order, one stays lit ──
  to(U.uStreak, { value: 0.3 }, 0.9, 0.5);
  to(U.uTileReveal, { value: 1 }, 1.05, 0.6, "none");
  to(U.uFocus, { value: 1 }, 1.62, 0.3);
  to(U.uTileVis, { value: 1 }, 1.8, 0.15);

  // ── 2: mapping onto the die ───────────────────────────────────────────────────
  to(U.uStreak, { value: 0 }, 2.0, 0.2);
  to(U.uCubeVis, { value: 0 }, 2.15, 0.35);
  to(U.uPkgVis, { value: 1 }, 2.15, 0.35);
  to(U.uAssign, { value: 1 }, 2.35, 0.5, "none");
  to(U.uSelLift, { value: 1 }, 2.58, 0.05);
  to(S, { tileFly: 1 }, 2.6, 0.4, "power2.inOut");
  to(U.uLock, { value: 1 }, 2.98, 0.08);

  // ── 3: inside the SM pair — units introduced one at a time ────────────────────
  to(U.uDetailVis, { value: 1 }, 3.0, 0.3);
  to(U.uTileVis, { value: 0 }, 3.0, 0.2);
  to(U.uPkgVis, { value: 0 }, 3.05, 0.3);
  to(U.uRevTma, { value: 1 }, 3.3, 0.12);
  to(U.uRevSmem, { value: 1 }, 3.45, 0.12);
  to(U.uRevTmem, { value: 1 }, 3.58, 0.12);
  to(U.uRevTensor, { value: 1 }, 3.7, 0.12);
  to(U.uRevWarps, { value: 1 }, 3.82, 0.12);

  // ── 4: the k-loop — TMA streams 64-wide k-blocks into the SMEM ring ───────────
  to(U.uSlice, { value: 1 }, 4.0, 0.2);
  to(U.uTmaOn, { value: 1 }, 4.05, 0.1);
  g(GROUP.tma, 1, 4.05);
  to(U.uK, { value: 0.29 }, 4.1, 0.85, "none");

  // ── 5: single-thread tcgen05.mma accumulates into TMEM ────────────────────────
  to(U.uMma, { value: 1 }, 5.0, 0.15);
  g(GROUP.mmaIn, 1, 5.0);
  g(GROUP.mmaOut, 1, 5.05);
  to(U.uLanes, { value: 1 }, 5.3, 0.2);
  to(U.uK, { value: 1 }, 5.1, 0.85, "none");
  g(GROUP.tma, 0, 5.88, 0.06);
  g(GROUP.mmaIn, 0, 5.94, 0.05);
  g(GROUP.mmaOut, 0, 5.94, 0.05);

  // ── 6: epilogue — TMEM → registers → SMEM → TMA store; other TMEM half fills ──
  to(U.uDrain, { value: 1 }, 6.1, 0.55, "none");
  g(GROUP.drain, 1, 6.1);
  to(U.uShrink, { value: 1 }, 6.2, 0.4);
  to(U.uNext, { value: 1 }, 6.2, 0.7, "none");
  to(U.uStage, { value: 1 }, 6.4, 0.4, "none");
  g(GROUP.store, 1, 6.45);
  to(U.uStore, { value: 1 }, 6.6, 0.3, "none");
  g(GROUP.drain, 0, 6.7, 0.1);
  g(GROUP.store, 0, 6.88, 0.08);

  // ── 7: finale — back to the whole die and C; remaining tiles complete in waves ─
  to(U.uDetailVis, { value: 0 }, 6.95, 0.25);
  to(U.uPkgVis, { value: 1 }, 6.95, 0.3);
  tl.set(S, { cubeScale: 0.75, cubeY: 9.0 }, 7.0);
  to(U.uCubeVis, { value: 1 }, 7.05, 0.3);
  to(U.uWave, { value: 1 }, 7.2, 0.65, "none");
  to(U.uDone, { value: 1 }, 7.2, 0.65, "none");
  to(U.uCalm, { value: 1 }, 7.85, 0.15);
  tl.set({}, {}, CHAPTERS); // pad duration to exactly 8

  // Render through once so each tween records its start value in order.
  tl.time(CHAPTERS).time(0);
  return tl;
}
