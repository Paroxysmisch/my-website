import { Group, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { addSpot, DETAIL_TIPS, detailHotspots, type Tip } from "../hotspots";
import {
  C_THUMB,
  DETAIL_K,
  DETAIL_POS,
  HBM_SLAB,
  RING,
  ringX,
  SM_H,
  SM_L,
  SM_W,
  SM_X,
  STAGING,
  STRIP,
  subPartition,
} from "../layout";
import { type BoxSpec, makeBoxes, withCommon } from "../materials";
import planeVert from "../shaders/plane.vert.glsl?raw";
import stripFrag from "../shaders/strip.frag.glsl?raw";
import tmemFrag from "../shaders/tmem.frag.glsl?raw";
import { FB, U } from "../state";
import { createDetailFlows } from "./flows";
import { matrixMaterial } from "./matrices";

const KIND = { static: 0, slot: 3, barrier: 4, warp: 5, tensor: 6, regs: 8 } as const;
const WARP_COL = [
  "#36cfc0",
  "#f0a93a",
  "#8b909a",
  "#8b909a",
  "#4ed08a",
  "#4ed08a",
  "#4ed08a",
  "#4ed08a",
];

/** Inside the SM pair, laid out like the Blackwell SM diagram:
 *  L1 I-cache · 4 sub-partitions (L0 I$, warp scheduler, register file, TMEM slice, CUDA cores, Tensor Core,
 *  LD/ST + SFU) · TMA · shared memory (6-stage ring + C staging) · texture units. */
export function createSmPair() {
  const group = new Group();
  group.position.copy(DETAIL_POS);
  group.scale.setScalar(DETAIL_K);

  const specs: BoxSpec[] = [];
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    kind: number,
    idx: number,
    edge: number,
    grp: number,
    tip?: Tip,
  ) => {
    specs.push({ pos: [x, y, z], size: [w, h, d], color, info: [kind, idx, edge, grp] });
    if (tip) addSpot(detailHotspots, [x, y, z], [w, h, Math.max(d, 0.3)], tip);
  };

  const T = DETAIL_TIPS;
  SM_X.forEach((X, si) => {
    box(X, 0, -0.4, SM_W, SM_H, 0.8, "#1b1e25", KIND.static, 0, 0.16, 0, T.sm(si));
    box(
      X,
      SM_L.icache.y,
      0.3,
      19.2,
      SM_L.icache.h,
      0.5,
      "#3b5877",
      KIND.static,
      0,
      0.1,
      FB.ctl,
      T.icache,
    );
    for (let q = 0; q < 4; q++) {
      const sp = subPartition(q);
      const cx = X + sp.cx;
      const hw = sp.innerW / 2;
      box(cx, sp.cy, 0.1, sp.w, sp.h, 0.4, "#252a33", KIND.static, 0, 0.12, 0, T.sp(q));
      box(cx, sp.l0, 0.4, sp.innerW, 0.5, 0.4, "#3b5877", KIND.static, 0, 0.08, FB.ctl, T.l0);
      box(
        cx - 1.5,
        sp.sched,
        0.4,
        sp.innerW - 3.1,
        0.9,
        0.4,
        "#9a6420",
        KIND.static,
        0,
        0.08,
        FB.ctl,
        T.sched,
      );
      box(
        cx,
        sp.dispatch,
        0.4,
        sp.innerW,
        0.45,
        0.4,
        "#6e4414",
        KIND.static,
        0,
        0.07,
        FB.ctl,
        T.dispatch,
      );
      box(cx, sp.regs, 0.4, sp.innerW, 0.95, 0.4, "#2b6577", KIND.regs, 0, 0.08, FB.regs, T.regs);
      // warps w and w+4 are scheduled on sub-partition q (chips stay inside the quadrant)
      for (const [k, w] of [q, q + 4].entries()) {
        box(
          cx + hw - 2.25 + k * 1.5,
          sp.sched,
          0.7,
          1.3,
          0.7,
          0.5,
          WARP_COL[w] as string,
          KIND.warp,
          w,
          0.07,
          FB.warps,
          T.warp(w),
        );
      }
      // CUDA cores | 5th-gen Tensor Core
      box(
        cx - hw + 1.2,
        sp.cores,
        0.4,
        2.3,
        sp.coresH,
        0.4,
        "#33502f",
        KIND.static,
        0,
        0.1,
        FB.ctl,
        T.cuda,
      );
      box(
        cx + 1.2,
        sp.cores,
        0.5,
        6.3,
        sp.coresH,
        0.6,
        "#5a4220",
        KIND.tensor,
        q,
        0.12,
        FB.tensor,
        T.tensor(q),
      );
      // 8 LD/ST + SFU
      for (let i = 0; i < 8; i++) {
        box(
          cx - hw + 0.43 + i * 0.86,
          sp.ldst,
          0.4,
          0.78,
          0.8,
          0.4,
          "#6a312d",
          KIND.static,
          0,
          0.06,
          FB.misc,
          T.ldst,
        );
      }
      box(
        cx + hw - 1.015,
        sp.ldst,
        0.4,
        2.03,
        0.8,
        0.4,
        "#7a3a33",
        KIND.static,
        0,
        0.06,
        FB.misc,
        T.sfu,
      );
    }
    box(X, SM_L.tma.y, 0.25, 19.2, SM_L.tma.h, 0.5, "#3d6a5d", KIND.static, 0, 0.1, FB.tma, T.tma);
    box(
      X,
      SM_L.smem.y,
      0.1,
      19.2,
      SM_L.smem.h,
      0.4,
      "#2a3a55",
      KIND.static,
      0,
      0.12,
      FB.smem,
      T.smem,
    );
    for (let i = 0; i < RING.count; i++) {
      const x = X + ringX(i);
      box(
        x,
        SM_L.smem.y + 0.78,
        0.45,
        RING.slotW,
        1.35,
        0.5,
        "#6aa6ff",
        KIND.slot,
        i,
        0.1,
        FB.smem,
        T.slotA(i),
      );
      box(
        x,
        SM_L.smem.y - 0.78,
        0.45,
        RING.slotW,
        1.35,
        0.5,
        "#e062d0",
        KIND.slot,
        i,
        0.1,
        FB.smem,
        T.slotB(i),
      );
      box(
        x,
        SM_L.smem.y + 1.64,
        0.4,
        0.6,
        0.28,
        0.3,
        "#f0a93a",
        KIND.barrier,
        i,
        0.07,
        FB.smem,
        T.barrier(i),
      );
    }
    box(
      X + STAGING.x,
      SM_L.smem.y,
      0.45,
      STAGING.w,
      2.8,
      0.5,
      "#2f4a3a",
      KIND.regs,
      1,
      0.1,
      FB.smem,
      T.staging,
    );
    for (let i = 0; i < 4; i++) {
      box(
        X - 7.2 + i * 4.8,
        SM_L.tex.y,
        0.2,
        4.5,
        SM_L.tex.h,
        0.4,
        "#27345c",
        KIND.static,
        0,
        0.07,
        FB.misc,
        T.tex,
      );
    }
  });
  // HBM / L2 slab the strips live in
  box(
    0,
    HBM_SLAB.y,
    -0.2,
    HBM_SLAB.w,
    HBM_SLAB.h,
    0.6,
    "#2a3141",
    KIND.static,
    0,
    0.12,
    FB.hbm,
    T.slab,
  );
  makeBoxes(specs, group, 10);

  // TMEM slices: 32 lanes x 512 columns per sub-partition (4 slices = 128 x 512 per SM)
  const tmemGeo = new PlaneGeometry(8.95, 1.25);
  for (const X of SM_X) {
    for (let q = 0; q < 4; q++) {
      const sp = subPartition(q);
      const m = new Mesh(
        tmemGeo,
        new ShaderMaterial({
          uniforms: { ...U, uQuad: { value: q } } as never,
          vertexShader: planeVert,
          fragmentShader: withCommon(tmemFrag),
        }),
      );
      m.position.set(X + sp.cx, sp.tmem, 0.55);
      m.frustumCulled = false;
      group.add(m);
      addSpot(detailHotspots, [X + sp.cx, sp.tmem, 0.55], [8.95, 1.25, 0.4], T.tmem(q));
    }
  }
  // operand strips in HBM
  const stripGeo = new PlaneGeometry(STRIP.half * 2, STRIP.h);
  for (const X of SM_X) {
    for (const [op, y] of [
      [0, STRIP.a],
      [1, STRIP.b],
    ] as const) {
      const m = new Mesh(
        stripGeo,
        new ShaderMaterial({
          uniforms: { ...U, uOperand: { value: op } } as never,
          vertexShader: planeVert,
          fragmentShader: withCommon(stripFrag),
        }),
      );
      m.position.set(X, y, 0.05);
      m.frustumCulled = false;
      group.add(m);
      const si = X < 0 ? 0 : 1;
      addSpot(
        detailHotspots,
        [X, y, 0.05],
        [STRIP.half * 2, STRIP.h, 0.4],
        op === 0 ? T.stripA(si) : T.stripB(si),
      );
    }
  }
  // C in HBM (thumbnail of the output matrix; the stored tile lights up)
  const thumb = new Mesh(new PlaneGeometry(C_THUMB.size, C_THUMB.size), matrixMaterial(3));
  thumb.position.set(C_THUMB.cx, C_THUMB.cy, 0.05);
  thumb.frustumCulled = false;
  group.add(thumb);
  addSpot(
    detailHotspots,
    [C_THUMB.cx, C_THUMB.cy, 0.05],
    [C_THUMB.size, C_THUMB.size, 0.4],
    T.thumb,
  );

  createDetailFlows(group);
  return { group };
}
