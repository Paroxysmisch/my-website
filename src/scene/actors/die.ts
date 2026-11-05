import { Group } from "three";
import { ctaPairs, GPU, totalSMs } from "../kernel";
import { DIE, dieCenterX, HBM, SM_SIZE, smPosition } from "../layout";
import { type BoxSpec, makeBoxes } from "../materials";

/** B200 package: 2 dies + die-to-die link + 8 HBM3e stacks + 148 SMs (74 CTA pairs). */
export function createDie() {
  const group = new Group();
  const specs: BoxSpec[] = [];
  const full = 2 * DIE.w + DIE.gap + 2 * (HBM.w + 0.5);
  specs.push({
    pos: [0, 0, -0.16],
    size: [full + 0.8, DIE.h + 1.5, 0.2],
    color: "#171b21",
    info: [1, 0, 0.05, 0],
  });
  for (const die of [0, 1]) {
    specs.push({
      pos: [dieCenterX(die), 0, -0.03],
      size: [DIE.w, DIE.h, 0.12],
      color: "#242a33",
      info: [1, 0, 0.05, 0],
    });
    const side = die === 0 ? -1 : 1;
    for (let i = 0; i < GPU.hbmPerDie; i++) {
      specs.push({
        pos: [
          side * (DIE.w + DIE.gap / 2 + 0.2 + HBM.w / 2),
          ((GPU.hbmPerDie - 1) / 2 - i) * HBM.pitch,
          0.0,
        ],
        size: [HBM.w, HBM.h, 0.3],
        color: "#33404f",
        info: [3, 0, 0.05, 0],
      });
    }
  }
  specs.push({
    pos: [0, 0, 0.0],
    size: [DIE.gap * 0.85, DIE.h * 0.55, 0.12],
    color: "#8a5a36",
    info: [1, 0, 0.03, 0],
  });
  for (let i = 0; i < totalSMs; i++) {
    const p = smPosition(i);
    specs.push({
      pos: [p.x, p.y, 0.1],
      size: [SM_SIZE, SM_SIZE, 0.1],
      color: "#2c333d",
      info: [2, Math.floor(i / 2), 0.035, 0],
    });
  }
  makeBoxes(specs, group, 5);
  return { group, pairCount: ctaPairs };
}
