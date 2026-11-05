/**
 * Single source of truth for the GEMM story (spec §5.1).
 * Datacenter Blackwell (SM100, B200). Every on-screen number derives from here.
 */
const KB = 1024;

export const GPU = {
  name: "B200",
  dies: 2,
  smsPerDie: 74,
  hbmStacks: 8,
  d2dTBps: 10,
  hbmPerDie: 4,
  smemPerSmKB: 228,
  tmemLanes: 128,
  tmemCols: 512,
  tmemBitsPerCell: 32,
} as const;

export const PROBLEM = { M: 8192, N: 8192, K: 8192 } as const;

export const TILE = { M: 256, N: 256, blkK: 64, mmaK: 16, mmaM: 256, mmaN: 256 } as const;

export const PIPE = { stages: 6, bytesPerElem: 2, smRows: 128 } as const;

export const totalSMs = GPU.dies * GPU.smsPerDie; // 148
export const ctaPairs = totalSMs / 2; // 74
export const pairsPerDie = GPU.smsPerDie / 2; // 37
export const flops = 2 * PROBLEM.M * PROBLEM.N * PROBLEM.K;
export const tflops = flops / 1e12; // 1.0995
export const tilesM = PROBLEM.M / TILE.M; // 32
export const tilesN = PROBLEM.N / TILE.N; // 32
export const totalTiles = tilesM * tilesN; // 1024
export const tilesPerPair = totalTiles / ctaPairs; // ≈ 13.8
export const kBlocks = PROBLEM.K / TILE.blkK; // 128
export const mmasPerKBlock = TILE.blkK / TILE.mmaK; // 4

/** A: 128 x 64 x 2 B per SM per stage. */
export const stageABytes = PIPE.smRows * TILE.blkK * PIPE.bytesPerElem;
/** B half: each SM of the pair loads half of the 256-wide B tile -> 128 x 64 x 2 B. */
export const stageBBytes = (TILE.N / 2) * TILE.blkK * PIPE.bytesPerElem;
export const stageKB = (stageABytes + stageBBytes) / KB; // 32
export const smemUsedKB = stageKB * PIPE.stages; // 192
/** Accumulator: 128 lanes x 256 columns FP32 = half of TMEM. */
export const accumCols = TILE.N;
export const tmemHalfCols = GPU.tmemCols / 2;

/** Selected tile for the story. */
export const SELECTED = { row: 12, col: 7 } as const;
/** Rows are swizzled in groups so consecutive tiles share A/B strips in L2. */
export const SWIZZLE_GROUP = 8;

/** Swizzled raster order: groups of SWIZZLE_GROUP tile-rows, walked column-major within a group. */
export function rasterOrder(row: number, col: number): number {
  const g = Math.floor(row / SWIZZLE_GROUP);
  return g * SWIZZLE_GROUP * tilesN + col * SWIZZLE_GROUP + (row % SWIZZLE_GROUP);
}
export const selectedOrder = rasterOrder(SELECTED.row, SELECTED.col);
/** Persistent scheduler: n-th tile goes to CTA pair (n mod pairs). */
export const selectedPair = selectedOrder % ctaPairs;

const fmt = (n: number) => n.toLocaleString("en-US");

export const hud = {
  gemm: `gemm · bf16 · M=N=K=${PROBLEM.M} · ${tflops.toFixed(2)} TFLOP`,
  tile: `tile (${SELECTED.row}, ${SELECTED.col}) of ${fmt(totalTiles)} · ${TILE.M}×${TILE.N}`,
  map: `${totalSMs} SMs · ${ctaPairs} CTA pairs · tile → pair ${selectedPair}`,
  sm: `SMEM ${PIPE.stages} × ${stageKB} KB stages · TMEM ${GPU.tmemLanes} × ${GPU.tmemCols} × ${GPU.tmemBitsPerCell}b`,
  kloop: (kb: number) =>
    `k-block ${kb} / ${kBlocks} · stage ${((kb - 1) % PIPE.stages) + 1} / ${PIPE.stages} · ${stageKB} KB/stage`,
  mma: `tcgen05.mma.cta_group::2 · ${TILE.mmaM}×${TILE.mmaN}×${TILE.mmaK} · TMEM cols 0–${accumCols - 1}`,
  epilogue: `epilogue · FP32 → BF16 · TMEM cols ${tmemHalfCols}–${GPU.tmemCols - 1} → next tile`,
  done: (n: number) =>
    `${fmt(n)} / ${fmt(totalTiles)} tiles · ${n >= totalTiles ? "done" : "running"}`,
};
