import { type Camera, Vector3 } from "three";
import { GPU, kBlocks, PIPE, PROBLEM, SELECTED, selectedPair, stageKB, TILE } from "./kernel";
import { detail, LANES, PAIR_POS, REGS, RING, SEL_TILE_LOCAL, SM_X, STRIP, TENSOR, TMA_POS, TMEM, WARP_Y, warpX } from "./layout";

interface Def {
  text: string;
  tone?: "a" | "b" | "hw";
  at: () => Vector3;
  from: number;
  to: number;
  align?: "c" | "l" | "r";
  /** 2 = secondary: hidden on phones to keep the view uncluttered */
  low?: boolean;
}

const X0 = SM_X[0];
const X1 = SM_X[1];
const cubeLocal = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** HTML overlay labels projected from 3D anchors (aria-hidden; text duplicates information in the page). */
export function createLabels(
  host: HTMLElement,
  camera: Camera,
  getCube: () => { toWorld: (v: Vector3) => Vector3 },
) {
  const defs: Def[] = [
    // chapter 0
    { text: `A · ${PROBLEM.M}×${PROBLEM.K} · BF16`, tone: "a", at: () => getCube().toWorld(cubeLocal(-3, 0.4, 0.2)), from: -0.1, to: 0.95 },
    { text: "B · BF16", tone: "b", at: () => getCube().toWorld(cubeLocal(0.6, 3, -0.4)), from: -0.1, to: 0.95 },
    { text: "C = A · B", tone: "hw", at: () => getCube().toWorld(cubeLocal(0, -3, 3)), from: -0.1, to: 0.95 },
    // chapter 1
    { text: `tile (${SELECTED.row}, ${SELECTED.col}) · ${TILE.M}×${TILE.N}`, tone: "hw", at: () => getCube().toWorld(SEL_TILE_LOCAL.clone().add(new Vector3(0.9, 0.7, 0.2))), from: 1.7, to: 1.98 },
    { text: "A row strip", tone: "a", at: () => getCube().toWorld(cubeLocal(-3, SEL_TILE_LOCAL.y, 0.0)), from: 1.7, to: 1.98 },
    { text: "B column strip", tone: "b", at: () => getCube().toWorld(cubeLocal(SEL_TILE_LOCAL.x, 3, 0.0)), from: 1.7, to: 1.98 },
    // chapter 2
    { text: `die 0 · ${GPU.smsPerDie} SMs`, at: () => new Vector3(-4.7, 5.5, 0), from: 2.5, to: 2.98, low: true },
    { text: `die 1 · ${GPU.smsPerDie} SMs`, at: () => new Vector3(4.7, 5.5, 0), from: 2.5, to: 2.98, low: true },
    { text: `${GPU.d2dTBps} TB/s die-to-die link`, tone: "hw", at: () => new Vector3(0, -5.6, 0), from: 2.5, to: 2.98 },
    { text: `${GPU.hbmPerDie} × HBM3e`, at: () => new Vector3(-9.9, 5.8, 0), from: 2.5, to: 2.98, low: true },
    { text: `${GPU.hbmPerDie} × HBM3e`, at: () => new Vector3(9.9, 5.8, 0), from: 2.5, to: 2.98, low: true },
    { text: `CTA pair ${selectedPair}`, tone: "hw", at: () => PAIR_POS.clone().add(new Vector3(0.9, -0.9, 0.2)), from: 2.85, to: 3.1 },
    // chapter 3 — introduced one at a time, kept until the chapter ends
    { text: "TMA unit", at: () => detail(X0 + TMA_POS.x, TMA_POS.y + 2.2, 1), from: 3.35, to: 3.97, tone: "hw", low: true },
    { text: `shared memory · ${PIPE.stages} stages`, at: () => detail(X0 + RING.cx, RING.cy - 5.0, 1), from: 3.5, to: 3.97, tone: "hw" },
    { text: `TMEM ${GPU.tmemLanes} × ${GPU.tmemCols}`, at: () => detail(X0 + TMEM.cx, TMEM.cy + 1.9, 1), from: 3.62, to: 3.97, tone: "hw" },
    { text: "Tensor Cores", at: () => detail(X0 + TENSOR.cx, TENSOR.cy, 2), from: 3.74, to: 3.97, tone: "hw" },
    { text: "producer warp", at: () => detail(X0 + warpX(0) + 1, WARP_Y - 1.7, 1), from: 3.86, to: 3.97, low: true },
    { text: "MMA thread (1)", at: () => detail(X0 + warpX(2), WARP_Y - 3.0, 1), from: 3.9, to: 3.97, tone: "hw", low: true },
    { text: "epilogue warps (4)", at: () => detail(X0 + warpX(4), WARP_Y - 1.7, 1), from: 3.92, to: 3.97, low: true },
    // chapter 4
    { text: `A strip · ${kBlocks} k-blocks`, tone: "a", at: () => detail(X0 - 2, STRIP.a - 1.7, 1), from: 4.1, to: 4.97, low: true },
    { text: "B strip · half per SM", tone: "b", at: () => detail(X1 - 3, STRIP.b + 1.7, 1), from: 4.1, to: 4.97, low: true },
    { text: "full / empty barrier per stage", at: () => detail(X0 + RING.cx, RING.cy - 5.0, 1), from: 4.3, to: 4.97, tone: "hw" },
    { text: `${stageKB} KB per stage`, at: () => detail(X1 + RING.cx, RING.cy - 5.0, 1), from: 4.3, to: 4.97, low: true },
    { text: "each SM loads half of B", tone: "b", at: () => detail(0, 10.4, 1), from: 4.45, to: 4.97 },
    // chapter 5
    { text: "tcgen05.mma", tone: "hw", at: () => detail(X0 + warpX(1), WARP_Y - 1.7, 1), from: 5.1, to: 5.58 },
    { text: "accumulator in TMEM", tone: "hw", at: () => detail(X0 + TMEM.cx, TMEM.cy + 1.9, 1), from: 5.1, to: 5.58 },
    { text: "producer", at: () => detail(-21.2, LANES.cy + LANES.h / 3, 0.2), from: 5.62, to: 5.98, align: "r" },
    { text: "MMA", at: () => detail(-21.2, LANES.cy, 0.2), from: 5.62, to: 5.98, align: "r" },
    { text: "epilogue", at: () => detail(-21.2, LANES.cy - LANES.h / 3, 0.2), from: 5.62, to: 5.98, align: "r" },
    { text: "time → (k-blocks)", at: () => detail(0, LANES.cy - LANES.h / 2 - 1.4, 0.2), from: 5.62, to: 5.98, low: true },
    // chapter 6
    { text: "tcgen05.ld → registers", tone: "hw", at: () => detail(X0 + REGS.cx, REGS.cy - 1.8, 1), from: 6.12, to: 6.97 },
    { text: "FP32 → BF16", at: () => detail(X0 + RING.cx, RING.cy - 2.5, 1), from: 6.3, to: 6.97, low: true },
    { text: "TMA store → HBM", tone: "hw", at: () => detail(X0 + RING.cx + 3.5, 12.4, 1), from: 6.5, to: 6.97 },
    { text: "next tile accumulating", tone: "hw", at: () => detail(X0 + TMEM.cx, TMEM.cy + 1.9, 1), from: 6.25, to: 6.97 },
  ];

  const els = defs.map((d) => {
    const el = document.createElement("div");
    el.className = "scene-label";
    if (d.tone) el.dataset.tone = d.tone;
    el.textContent = d.text;
    host.appendChild(el);
    return el;
  });

  const widths = els.map(() => 0);
  requestAnimationFrame(() => els.forEach((e, i) => { widths[i] = e.offsetWidth; }));
  const v = new Vector3();
  const FADE = 0.04;

  return function update(tau: number, w: number, h: number) {
    const phone = w < 640;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i] as Def;
      const el = els[i] as HTMLElement;
      let a = Math.min(1, Math.max(0, Math.min((tau - d.from) / FADE, (d.to - tau) / FADE)));
      if (phone && d.low) a = 0;
      if (a <= 0) {
        if (el.style.opacity !== "0") el.style.opacity = "0";
        continue;
      }
      v.copy(d.at()).project(camera);
      let x = (v.x * 0.5 + 0.5) * w;
      const lw = widths[i] || 120;
      const lo = d.align === "r" ? lw : d.align === "l" ? 0 : lw / 2;
      const hi = d.align === "r" ? 0 : d.align === "l" ? lw : lw / 2;
      x = Math.min(w - hi - 6, Math.max(lo + 6, x));
      const y = (-v.y * 0.5 + 0.5) * h;
      const vis = v.z < 1 && x > -50 && x < w + 50 && y > 40 && y < h + 20;
      el.style.opacity = vis ? String(a) : "0";
      const tx = d.align === "r" ? "-100%" : d.align === "l" ? "0" : "-50%";
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(${tx}, -50%)`;
    }
  };
}
