import { GPU, PIPE, selectedPair, stageKB, TILE, WARP_ROLES } from "./kernel";
import { U } from "./state";

/** A hoverable/clickable part of the scene: an axis-aligned box in its group's local space. */
export interface Hotspot {
  cx: number;
  cy: number;
  cz: number;
  w: number;
  h: number;
  d: number;
  title: string;
  body: string;
  /** live state line (evaluated when the tooltip is shown / refreshed) */
  dyn?: () => string;
}
export type Tip = { t: string; b: string; dyn?: () => string };

export const dieHotspots: Hotspot[] = [];
export const detailHotspots: Hotspot[] = [];

export const addSpot = (
  list: Hotspot[],
  pos: [number, number, number],
  size: [number, number, number],
  tip: Tip,
) =>
  list.push({
    cx: pos[0],
    cy: pos[1],
    cz: pos[2],
    w: size[0],
    h: size[1],
    d: size[2],
    title: tip.t,
    body: tip.b,
    dyn: tip.dyn,
  });

/** Ring stage state at k-block time t (see box.frag.glsl). */
export function slotState(i: number): string {
  const t = U.uT.value;
  if (t < i) return "empty: its first k-block has not been requested yet";
  const c = (((t - i) % 6) + 6) % 6;
  const b = i + 6 * Math.floor((t - i) / 6);
  if (c < 1) return `TMA is loading k-block ${b} into this stage`;
  if (c < 5) return `full: k-block ${b} has landed (full barrier set), waiting for the MMA`;
  return `the Tensor Cores are reading k-block ${b}; the stage is freed afterwards`;
}

export const tmemProgress = () => {
  const done = Math.max(0, Math.min(128, Math.floor(U.uAcc.value * 128)));
  const drained = U.uDrain.value;
  if (drained > 0.02)
    return `epilogue: ${Math.round(Math.min(1, drained) * 100)}% of the accumulator read out`;
  return `${done} / 128 k-blocks accumulated so far`;
};

export const DIE_TIPS = {
  die: {
    t: "GPU die",
    b: `One of two dies, each with ${GPU.smsPerDie} enabled SMs. Software sees both as one GPU.`,
  },
  hbmctrl: {
    t: "HBM memory controller",
    b: "Drives one HBM3e stack above/below the die. Together the stacks hold A, B and C.",
  },
  hbm: {
    t: "HBM3e stack",
    b: `${GPU.hbmPerDie} stacks per die, ${GPU.hbmStacks} per GPU: the global memory the operands and results live in.`,
  },
  io: {
    t: "I/O: PCIe and NVLink",
    b: "Host and GPU-to-GPU links. Not used while a GEMM is running.",
  },
  l2: {
    t: "L2 cache",
    b: "Shared by all SMs. The two dies' L2s are kept coherent over NV-HBI. A swizzled tile order makes neighbouring tiles reuse A/B strips from L2.",
  },
  giga: {
    t: "GigaThread Engine",
    b: "Hands thread blocks (CTAs) out to SMs. With cluster launch control a finished CTA pair can claim a new tile: a persistent kernel.",
  },
  dec: { t: "NVDEC", b: "Video decode engine. Unused by GEMM." },
  hbi: {
    t: "NV-HBI",
    b: `High-bandwidth die-to-die interface, ${GPU.d2dTBps} TB/s.`,
  },
  gpc: {
    t: "Graphics Processing Cluster (GPC)",
    b: `${GPU.tpcsPerGpc} TPCs = ${GPU.tpcsPerGpc * 2} SMs. The two SMs of a TPC can form a CTA pair running one 256×256 tile together.`,
  },
};

export const pairTip = (pair: number, die: number): Tip => {
  if (pair < 0)
    return {
      t: "Fused-off TPC",
      b: "Disabled for yield: 80 SMs are built per die, 74 are enabled on B200.",
    };
  return {
    t: `CTA pair ${pair} · die ${die}`,
    b:
      `A TPC (2 SMs). One cluster of 2 CTAs runs here and computes a ${TILE.M}×${TILE.N} tile with tcgen05 cta_group::2.` +
      (pair === selectedPair ? " This is the pair that receives our tile." : ""),
  };
};

const smName = (si: number) => (si === 0 ? "SM A · leader CTA" : "SM B · peer CTA");
export const DETAIL_TIPS = {
  sm: (si: number): Tip => ({
    t: `Streaming Multiprocessor · ${smName(si)}`,
    b:
      si === 0
        ? "Rank 0 of the CTA pair: owns C rows 0–127 and hosts the leader barriers. The single MMA thread lives here."
        : "Rank 1 of the CTA pair: owns C rows 128–255. Its producer and epilogue signal the leader's barriers remotely.",
  }),
  icache: { t: "L1 instruction cache", b: "Shared by the SM's four sub-partitions." },
  sp: (q: number): Tip => ({
    t: `Sub-partition ${q}`,
    b: `One of 4 per SM. Has its own scheduler, registers, TMEM slice (lanes ${32 * q}–${32 * q + 31}) and Tensor Core. Warps w with w mod 4 = ${q} run here.`,
  }),
  l0: { t: "L0 instruction cache", b: "Per sub-partition instruction cache." },
  sched: {
    t: "Warp scheduler",
    b: "Picks one ready warp per clock and issues its instruction (32 threads/clk).",
  },
  dispatch: { t: "Dispatch unit", b: "Sends the chosen instruction to the execution units." },
  regs: {
    t: "Register file",
    b: "16,384 × 32-bit (64 KB) per sub-partition. In this kernel it only holds epilogue data: the accumulators live in TMEM, not registers.",
  },
  tmem: (q: number): Tip => ({
    t: `Tensor Memory (TMEM) · slice ${q}`,
    b: `32 lanes × 512 columns × 32-bit = 64 KB. Lanes ${32 * q}–${32 * q + 31} of this SM's 128. Columns 0–255 accumulate this tile, 256–511 the next one (double buffer).`,
    dyn: tmemProgress,
  }),
  cuda: {
    t: "CUDA cores",
    b: "Scalar FP32/INT ALUs. Idle in the main loop; the epilogue uses them to convert FP32 → BF16.",
  },
  tensor: (q: number): Tip => ({
    t: `5th-gen Tensor Core · sub-partition ${q}`,
    b: "4 per SM. One tcgen05.mma instruction drives all of them (and the peer SM's) as a single 256×256×16 multiply-accumulate; A and B come from shared memory, the accumulator is in TMEM.",
  }),
  ldst: { t: "LD/ST units", b: "Load/store pipeline for ordinary memory instructions." },
  sfu: { t: "Special function unit", b: "exp, rsqrt, sin… Unused by GEMM." },
  warp: (w: number): Tip => {
    const role = WARP_ROLES[w] ?? "";
    const more = [
      "One elected thread issues the TMA copies for every k-block.",
      "One elected thread, in the leader CTA, issues tcgen05.mma for both SMs.",
      "Fetches the next tile to work on.",
      "Allocates the 512 TMEM columns.",
      `Reads TMEM lanes ${32 * (w - 4)}–${32 * (w - 4) + 31} with tcgen05.ld, converts to BF16 and stores.`,
    ][Math.min(w, 4)];
    return {
      t: `Warp ${w} · ${role}`,
      b: `${more} Runs on sub-partition ${w % 4}.`,
    };
  },
  tma: {
    t: "Tensor Memory Accelerator (TMA)",
    b: "One thread issues one instruction; TMA copies a whole tile between HBM and shared memory and counts bytes on an mbarrier.",
  },
  smem: {
    t: "Shared memory (L1 / SMEM)",
    b: `${GPU.smemPerSmKB} KB usable per SM: ${PIPE.stages} ring stages of ${stageKB} KB plus a C staging buffer.`,
  },
  slotA: (i: number): Tip => ({
    t: `Ring stage ${i} · A tile`,
    b: "128 rows × 64 k of this SM's slice of A (16 KB).",
    dyn: () => slotState(i),
  }),
  slotB: (i: number): Tip => ({
    t: `Ring stage ${i} · half of B`,
    b: "128 of the 256 B columns × 64 k (16 KB). The peer SM holds the other half; the MMA reads both.",
    dyn: () => slotState(i),
  }),
  barrier: (i: number): Tip => ({
    t: `Full barrier · stage ${i}`,
    b: "An mbarrier that flips when TMA's bytes for this stage have landed. The MMA thread waits on it. Filled = full.",
    dyn: () => slotState(i),
  }),
  staging: {
    t: "C staging buffer",
    b: "The epilogue writes BF16 results here before TMA stores them to HBM.",
  },
  tex: { t: "Texture units", b: "Unused by GEMM." },
  slab: {
    t: "HBM3e / L2",
    b: "Global memory holding A, B and C (via L2).",
  },
  stripA: (si: number): Tip => ({
    t: `A strip · ${smName(si)}`,
    b: "This SM's 128 rows of the tile's A strip, K = 8192, sliced into 128 k-blocks of 64.",
  }),
  stripB: (si: number): Tip => ({
    t: `B strip · ${smName(si)}`,
    b: "This SM's half of the tile's B columns (128 of 256), sliced into 128 k-blocks of 64. The peer loads the other half.",
  }),
  thumb: {
    t: "C in HBM",
    b: "The output matrix. Each CTA writes its 128 rows of the finished 256×256 tile here as BF16.",
  },
};
