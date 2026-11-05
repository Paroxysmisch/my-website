/** Chapter metadata shared by the Astro page (subtitles) and the scene (HUD). */
import { PROBLEM, TILE, tilesM, tilesN } from "./kernel";

export interface Chapter {
  id: string;
  /** Plain-language one-liner for non-experts (rendered as real text in the section). */
  subtitle: string | null;
  /** Short name of this kernel stage (rendered in the section as a caption). */
  stage: string;
}

export const chapters: Chapter[] = [
  {
    id: "hero",
    stage: "C = A · B",
    subtitle: `Multiplying two ${PROBLEM.M}×${PROBLEM.N} matrices — the core operation of modern AI.`,
  },
  {
    id: "about",
    stage: "Tiling the output",
    subtitle: `The output is split into ${tilesM}×${tilesN} tiles of ${TILE.M}×${TILE.N}; each tile needs one strip of A and one strip of B.`,
  },
  {
    id: "research",
    stage: "Mapping onto the die",
    subtitle:
      "Each tile is assigned to a pair of streaming multiprocessors (SMs) that work on it together.",
  },
  {
    id: "projects",
    stage: "Inside the SM pair",
    subtitle: "Specialised units: one loads data, one does the maths, others write results back.",
  },
  {
    id: "publications",
    stage: "The k-loop: TMA → shared memory",
    subtitle:
      "Data is streamed in chunks into a ring of on-chip buffers so loading and computing overlap.",
  },
  {
    id: "experience",
    stage: "MMA into Tensor Memory",
    subtitle:
      "One thread drives the Tensor Cores; partial results accumulate in dedicated Tensor Memory.",
  },
  {
    id: "news",
    stage: "Epilogue",
    subtitle:
      "Results are converted and written back while the next tile is already being computed.",
  },
  { id: "contact", stage: "Finale", subtitle: null },
];
