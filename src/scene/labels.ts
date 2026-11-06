import { type Camera, Vector3 } from "three";
import { GPU, kBlocks, PIPE, PROBLEM, SELECTED, selectedPair, stageKB, TILE } from "./kernel";
import {
  detail,
  dieBlocks,
  MAT,
  PAIR_POS,
  RING,
  ringX,
  SEL_TILE_LOCAL,
  SM_L,
  SM_X,
  STRIP,
  subPartition,
} from "./layout";

interface Def {
  text: string;
  tone?: "a" | "b" | "acc" | "ok";
  at: () => Vector3;
  from: number;
  to: number;
  align?: "c" | "l" | "r";
  /** secondary labels are hidden on phones to keep the view clear */
  low?: boolean;
}

const X0 = SM_X[0];
const X1 = SM_X[1];
const sp1 = subPartition(1);
const sp0 = subPartition(0);
const sp2 = subPartition(2);

const blk = (kind: string, die = 0, nth = 0) => {
  const b = dieBlocks.filter((d) => d.kind === kind && d.die === die)[nth];
  return b ? new Vector3(b.cx, b.cy, 0.1) : new Vector3();
};

/** HTML overlay labels projected from 3D anchors (aria-hidden; the page text carries the same facts). */
export function createLabels(
  host: HTMLElement,
  camera: Camera,
  matsToWorld: (v: Vector3) => Vector3,
) {
  const m = (x: number, y: number) => () => matsToWorld(new Vector3(x, y, 0.2));
  const S = MAT.S;
  const g = MAT.gap;
  const defs: Def[] = [
    // 0 · C = A · B
    {
      text: `A · ${PROBLEM.M}×${PROBLEM.K} · bf16`,
      tone: "a",
      at: m(-g - S / 2, 0.55),
      from: -1,
      to: 0.95,
    },
    {
      text: `B · ${PROBLEM.K}×${PROBLEM.N} · bf16`,
      tone: "b",
      at: m(S / 2, g + S + 0.55),
      from: -1,
      to: 0.95,
    },
    {
      text: `C · ${PROBLEM.M}×${PROBLEM.N}`,
      tone: "acc",
      at: m(S / 2, -S - 0.5),
      from: -1,
      to: 0.95,
    },
    // 1 · tiling
    {
      text: "1,024 output tiles · 256×256",
      tone: "acc",
      at: m(S / 2, -S - 0.5),
      from: 1.5,
      to: 1.85,
    },
    {
      text: `tile (${SELECTED.row}, ${SELECTED.col})`,
      tone: "acc",
      at: () => matsToWorld(SEL_TILE_LOCAL.clone().add(new Vector3(1.5, -0.7, 0.2))),
      from: 1.86,
      to: 2.08,
    },
    {
      text: "its row strip of A",
      tone: "a",
      at: m(-g - S / 2, SEL_TILE_LOCAL.y),
      from: 1.86,
      to: 2.08,
    },
    {
      text: "its column strip of B",
      tone: "b",
      at: m(SEL_TILE_LOCAL.x, g + S + 0.55),
      from: 1.86,
      to: 2.08,
      align: "c",
    },
    {
      text: "2 CTAs · 128 rows each",
      tone: "acc",
      at: () => matsToWorld(SEL_TILE_LOCAL.clone().add(new Vector3(-1.4, -0.9, 0.2))),
      from: 1.95,
      to: 2.08,
      low: true,
    },
    // 2 · die
    { text: "GigaThread Engine", tone: "acc", at: () => blk("giga", 0), from: 2.55, to: 3.05 },
    {
      text: `NV-HBI · ${GPU.d2dTBps} TB/s`,
      at: () => blk("hbi", 0).add(new Vector3(0.4, 3.3, 0)),
      from: 2.47,
      to: 3.05,
      low: true,
    },
    {
      text: "GPC · SMs",
      at: () => blk("gpc", 1, 0).add(new Vector3(0, 1.9, 0)),
      from: 2.47,
      to: 3.05,
      low: true,
    },
    {
      text: "L2 cache",
      at: () => blk("l2", 1, 0).add(new Vector3(0, 1.0, 0)),
      from: 2.47,
      to: 3.05,
      low: true,
    },
    {
      text: `${GPU.hbmPerDie} × HBM3e per die`,
      at: () => blk("hbm", 0, 0).add(new Vector3(1.2, 0.9, 0)),
      from: 2.47,
      to: 3.05,
      low: true,
    },
    {
      text: `CTA pair ${selectedPair}`,
      tone: "acc",
      at: () => PAIR_POS.clone().add(new Vector3(0.9, -0.55, 0.2)),
      from: 2.9,
      to: 3.3,
    },
    // 3 · inside the SM pair
    { text: "SM A · leader", at: () => detail(X0, 17.2, 1), from: 3.4, to: 4.05 },
    { text: "SM B · peer", at: () => detail(X1, 17.2, 1), from: 3.4, to: 4.05 },
    {
      text: "4 sub-partitions",
      at: () => detail(X0 + sp0.cx - 2.2, sp0.top + 0.9, 1),
      from: 3.5,
      to: 3.64,
    },
    {
      text: `TMEM · ${GPU.tmemLanes} lanes × ${GPU.tmemCols} cols per SM`,
      tone: "acc",
      at: () => detail(X1 + sp1.cx, sp1.tmem + 1.6, 1),
      from: 3.64,
      to: 3.76,
    },
    {
      text: "5th-gen Tensor Core",
      tone: "acc",
      at: () => detail(X1 + sp1.cx, sp1.cores + sp1.coresH / 2 + 1.1, 1),
      from: 3.76,
      to: 3.88,
    },
    { text: "TMA", at: () => detail(X0 - 6, SM_L.tma.y + 1.4, 1), from: 3.88, to: 3.97 },
    {
      text: `shared memory · ${PIPE.stages}-stage ring`,
      at: () => detail(X0 - 3, SM_L.smem.y - 2.7, 1),
      from: 3.88,
      to: 3.97,
    },
    {
      text: "warp roles: TMA · MMA · epilogue",
      at: () => detail(X1 + sp1.cx, sp1.sched + 1.4, 1.2),
      from: 3.97,
      to: 4.05,
    },
    // 4 · k-loop
    {
      text: `A strip · ${kBlocks} k-blocks of ${TILE.blkK}`,
      tone: "a",
      at: () => detail(X0 - 1, STRIP.a + 1.6, 1),
      from: 4.25,
      to: 5.05,
    },
    {
      text: "B strip · this SM's half of B",
      tone: "b",
      at: () => detail(X0 - 1, STRIP.b - 1.5, 1),
      from: 4.25,
      to: 5.05,
    },
    {
      text: "SM B loads the other half",
      tone: "b",
      at: () => detail(X1 + 1, STRIP.b - 1.5, 1),
      from: 4.25,
      to: 5.05,
      low: true,
    },
    {
      text: `${stageKB} KB per stage`,
      at: () => detail(X0 + ringX(2.5), SM_L.smem.y + 3.0, 1),
      from: 4.45,
      to: 5.05,
      low: true,
    },
    {
      text: "full barrier per stage",
      tone: "acc",
      at: () => detail(X1 + ringX(2.5), SM_L.smem.y + 3.0, 1),
      from: 4.45,
      to: 5.05,
    },
    // 5 · MMA
    {
      text: "1 thread issues tcgen05.mma",
      tone: "acc",
      at: () => detail(X0 + sp1.cx + 1, sp1.sched + 1.6, 1.4),
      from: 5.3,
      to: 6.05,
    },
    {
      text: "B halves of both SMs → every Tensor Core",
      tone: "b",
      at: () => detail(0, SM_L.tma.y + 3.4, 1.5),
      from: 5.35,
      to: 6.05,
      low: true,
    },
    {
      text: "accumulate in TMEM",
      tone: "acc",
      at: () => detail(X1 + sp1.cx, sp1.tmem + 1.6, 1),
      from: 5.35,
      to: 6.05,
    },
    // 6 · epilogue
    {
      text: "tcgen05.ld · 4 epilogue warps",
      tone: "ok",
      at: () => detail(X0 + sp0.cx - 0.5, sp0.top + 1.2, 1),
      from: 6.4,
      to: 7.05,
    },
    {
      text: "FP32 → BF16",
      tone: "ok",
      at: () => detail(X1 + sp1.cx, sp1.regs + 1.2, 1.3),
      from: 6.5,
      to: 7.05,
      low: true,
    },
    {
      text: "TMA store → C in HBM",
      tone: "ok",
      at: () => detail(X0 + RING.slotW + 4, SM_L.tex.y - 2.2, 1),
      from: 6.68,
      to: 7.05,
    },
    {
      text: "next tile accumulates in cols 256–511",
      tone: "acc",
      at: () => detail(X0 + sp2.cx, sp2.tmem - 1.5, 1.3),
      from: 6.5,
      to: 7.05,
      low: true,
    },
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
  const measure = () => {
    els.forEach((e, i) => {
      widths[i] = e.offsetWidth;
    });
  };
  requestAnimationFrame(measure);
  document.fonts?.ready.then(measure);
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
      const y = (-v.y * 0.5 + 0.5) * h;
      const lw = widths[i] || 120;
      const lo = d.align === "r" ? lw : d.align === "l" ? 0 : lw / 2;
      const hi = d.align === "r" ? 0 : d.align === "l" ? lw : lw / 2;
      x = Math.min(w - hi - 6, Math.max(lo + 6, x));
      const vis = v.z < 1 && y > 8 && y < h - 8;
      el.style.opacity = vis ? String(a) : "0";
      const tx = d.align === "r" ? "-100%" : d.align === "l" ? "0" : "-50%";
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(${tx}, -50%)`;
    }
  };
}
