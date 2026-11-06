import { Group } from "three";
import { addSpot, DIE_TIPS, dieHotspots, pairTip } from "../hotspots";
import { DIE_SM_H, DIE_SM_W, dieBlocks, dieSms } from "../layout";
import { type BoxSpec, makeBoxes } from "../materials";

const COLORS: Record<string, string> = {
  die: "#1c1f26",
  hbmctrl: "#2c313b",
  io: "#22262e",
  gpc: "#21252d",
  l2: "#262c3a",
  giga: "#3a3125",
  dec: "#2c313b",
  hbi: "#2f3646",
  hbm: "#303b4d",
};

/** B200 package laid out like the Blackwell Ultra die shot: two dies joined by NV-HBI, 4 GPCs + 2 L2 slabs
 *  per die, a GigaThread engine band across the middle, HBM controllers on the top/bottom edges. */
export function createDie() {
  const group = new Group();
  const specs: BoxSpec[] = [];
  specs.push({
    pos: [0, 0, -0.12],
    size: [15.6, 12.6, 0.1],
    color: "#14161b",
    info: [1, 0, 0.04, 0],
  });
  for (const b of dieBlocks) {
    const z = b.kind === "die" ? -0.04 : b.kind === "hbm" ? 0.05 : b.kind === "gpc" ? 0.0 : 0.01;
    const th = b.kind === "die" ? 0.1 : b.kind === "hbm" ? 0.22 : 0.06;
    // the die body is a fallback hotspot; everything on top of it is picked first (smaller t)
    addSpot(dieHotspots, [b.cx, b.cy, z], [b.w, b.h, Math.max(th, 0.12)], DIE_TIPS[b.kind]);
    specs.push({
      pos: [b.cx, b.cy, z],
      size: [b.w - (b.kind === "die" ? 0 : 0.04), b.h - (b.kind === "die" ? 0 : 0.04), th],
      color: COLORS[b.kind] ?? "#222",
      info: [1, 0, b.kind === "gpc" || b.kind === "hbm" ? 0.025 : 0.018, 0],
    });
  }
  makeBoxes(specs, group, 5);

  for (const s of dieSms) {
    addSpot(dieHotspots, [s.cx, s.cy, 0.07], [DIE_SM_W, DIE_SM_H, 0.1], pairTip(s.pair, s.die));
  }
  const sm: BoxSpec[] = dieSms.map((s) => ({
    pos: [s.cx, s.cy, 0.07],
    size: [DIE_SM_W, DIE_SM_H, 0.06],
    color: "#38404d",
    info: [2, s.pair, 0.016, 0],
  }));
  makeBoxes(sm, group, 6);
  return { group };
}
