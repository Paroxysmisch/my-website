import { Group } from "three";
import {
  DETAIL_K,
  DETAIL_POS,
  REGS,
  RING,
  SLAB,
  SM_X,
  TENSOR,
  TMA_POS,
  WARP_Y,
  warpX,
} from "../layout";
import { type BoxSpec, makeBoxes } from "../materials";
import { createDetailFlows } from "./flows";
import { createLanes } from "./pipelineLanes";
import { createBridge, createStrips, ringSpecs } from "./smemRing";
import { createTmem } from "./tmemGrid";

/** "Inside the SM pair": two SMs with TMA, SMEM ring, TMEM, Tensor Cores, warp roles. */
export function createSmPair() {
  const group = new Group();
  group.position.copy(DETAIL_POS);
  group.scale.setScalar(DETAIL_K);

  const specs: BoxSpec[] = [];
  const GR = "#2a323d";
  for (const X of SM_X) {
    specs.push({ pos: [X, 0, -0.4], size: [20, 20, 0.8], color: "#1a1e25", info: [4, 0, 0.2, 0] });
    specs.push({
      pos: [X + TMA_POS.x, TMA_POS.y, 0.4],
      size: [4, 2.2, 0.8],
      color: GR,
      info: [4, 0, 0.14, 1],
    });
    specs.push({
      pos: [X + TENSOR.cx, TENSOR.cy, 0.5],
      size: [TENSOR.w, TENSOR.h, 1.0],
      color: "#5a4030",
      info: [8, 0, 0.16, 0],
    });
    specs.push({
      pos: [X + REGS.cx, REGS.cy, 0.3],
      size: [REGS.w, REGS.h, 0.6],
      color: GR,
      info: [10, 0, 0.12, 4],
    });
    specs.push({
      pos: [X + RING.cx, RING.cy, 0.3],
      size: [2.6, 2.0, 0.6],
      color: GR,
      info: [10, 1, 0.12, 2],
    });
    // warp roles: producer, single MMA thread, 4 epilogue warps
    for (let i = 0; i < 6; i++) {
      const color = i === 0 ? "#8aa0b8" : i === 1 ? "#ffc46b" : "#d98a4e";
      specs.push({
        pos: [X + warpX(i), WARP_Y, 0.4],
        size: [2.2, 1.6, 0.8],
        color,
        info: [6, i, 0.12, 5],
      });
    }
    // HBM slab above the strips (C tile is written back here)
    specs.push({
      pos: [X, SLAB.y, -0.2],
      size: [20.8, SLAB.h, 0.8],
      color: "#2b3441",
      info: [11, RING.cx, 0.16, 0],
    });
  }
  specs.push(...ringSpecs());
  makeBoxes(specs, group, 10);
  createStrips(group);
  createTmem(group);
  createLanes(group);
  createBridge(group);
  createDetailFlows(group);
  return { group };
}
