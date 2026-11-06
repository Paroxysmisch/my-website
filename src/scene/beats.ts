import { GPU, PIPE, selectedPair, TILE, tilesM, tilesN, totalTiles } from "./kernel";

/** Plain-language narration shown under the scene; one line per beat of the story (τ = chapter units). */
export const BEATS: { from: number; text: string }[] = [
  {
    from: 0,
    text: "Each number in C is a row of A times a column of B, summed. A whole matrix of those is a GEMM.",
  },
  {
    from: 1.1,
    text: `C is cut into ${tilesM}×${tilesN} = ${totalTiles.toLocaleString("en-US")} tiles of ${TILE.M}×${TILE.N}. Each tile is an independent job.`,
  },
  {
    from: 1.8,
    text: "One tile needs just one strip of A (its rows) and one strip of B (its columns).",
  },
  {
    from: 1.92,
    text: "A pair of SMs shares the tile: 128 rows each, and each loads half of B. K is sliced into 128 blocks.",
  },
  {
    from: 2.0,
    text: `The B200 is two dies joined by NV-HBI. A GigaThread engine deals tiles out to ${(GPU.dies * GPU.smsPerDie) / 2} CTA pairs.`,
  },
  { from: 2.7, text: `Our tile lands on CTA pair ${selectedPair}. Now, inside its two SMs.` },
  {
    from: 3.2,
    text: "Each SM has 4 sub-partitions: warp scheduler, registers, TMEM, CUDA cores and a Tensor Core.",
  },
  {
    from: 3.6,
    text: `TMEM is a ${GPU.tmemLanes}-lane × ${GPU.tmemCols}-column scratchpad for accumulators; each sub-partition owns 32 lanes.`,
  },
  { from: 3.72, text: "The 5th-gen Tensor Cores do the multiply-accumulate." },
  {
    from: 3.84,
    text: `TMA copies tiles from HBM into shared memory, organised as a ${PIPE.stages}-stage ring.`,
  },
  {
    from: 3.95,
    text: "Warps have fixed roles: one loads (TMA), one issues the MMA, four run the epilogue.",
  },
  {
    from: 4.05,
    text: "TMA streams one k-block at a time into the next free ring slot; a barrier flips when it is full.",
  },
  {
    from: 4.6,
    text: "Loading and computing overlap: Tensor Cores read one slot (amber) while TMA fills another.",
  },
  {
    from: 5.02,
    text: "One thread issues tcgen05.mma for both SMs: it reads A and both halves of B from shared memory.",
  },
  {
    from: 5.5,
    text: "Partial products accumulate in TMEM, not registers; it brightens with every k-block.",
  },
  {
    from: 6.04,
    text: "All 128 k-blocks done. Four epilogue warps read their 32 TMEM lanes into registers.",
  },
  {
    from: 6.5,
    text: "FP32 results are converted to BF16, staged in shared memory, and TMA-stored to HBM.",
  },
  { from: 6.7, text: "Meanwhile the second TMEM buffer is already accumulating the next tile." },
  {
    from: 7.0,
    text: "Every pair repeats this over its share of the 1,024 tiles until C is complete.",
  },
];

export function beatAt(tau: number): string {
  let t = BEATS[0]?.text ?? "";
  for (const b of BEATS) if (tau >= b.from) t = b.text;
  return t;
}
