import {
  Color,
  type Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Vector3,
} from "three";
import { GROUP } from "../state";
import { CUBE, RING, REGS, SM_X, STRIP, SLAB, TENSOR, TMEM, slotCenter } from "../layout";
import { PIPE } from "../kernel";
import { additiveMaterial } from "../materials";
import flowFrag from "../shaders/flow.frag.glsl?raw";
import flowVert from "../shaders/flow.vert.glsl?raw";
import { A_COL, B_COL } from "./smemRing";

interface Flow {
  start: Vector3 | number[];
  end: Vector3 | number[];
  color: string;
  type: number;
  group: number;
  size: number;
  w: number;
  speed?: number;
}

const v = (a: Vector3 | number[]) => (Array.isArray(a) ? a : [a.x, a.y, a.z]);

function build(flows: Flow[], parent: Group, strip: [number, number], uniformsExtra: Record<string, unknown> = {}) {
  const n = flows.length;
  const geo = new InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.instanceCount = n;
  const start = new Float32Array(n * 3);
  const end = new Float32Array(n * 3);
  const color = new Float32Array(n * 3);
  const info = new Float32Array(n * 4);
  const extra = new Float32Array(n * 4);
  const c = new Color();
  flows.forEach((f, i) => {
    start.set(v(f.start), i * 3);
    end.set(v(f.end), i * 3);
    c.set(f.color).convertLinearToSRGB();
    color.set([c.r, c.g, c.b], i * 3);
    info.set([f.type, f.group, f.size, f.w], i * 4);
    extra.set([f.speed ?? 0.3, 0, 0, 0], i * 4);
  });
  geo.setAttribute("aStart", new InstancedBufferAttribute(start, 3));
  geo.setAttribute("aEnd", new InstancedBufferAttribute(end, 3));
  geo.setAttribute("aColor", new InstancedBufferAttribute(color, 3));
  geo.setAttribute("aInfo", new InstancedBufferAttribute(info, 4));
  geo.setAttribute("aExtra", new InstancedBufferAttribute(extra, 4));
  const mat = additiveMaterial(flowVert, flowFrag, {
    uGroup: { value: S_GROUPS },
    uStrip: { value: strip },
    ...uniformsExtra,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 40;
  parent.add(mesh);
  return mesh;
}

// shared array so the timeline can drive all flow meshes with one write
import { S } from "../state";
const S_GROUPS = S.groups;

let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

export function createCubeFlows(parent: Group) {
  const h = CUBE / 2;
  const flows: Flow[] = [];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const y = (rnd() * 2 - 1) * h * 0.95;
    const z = (rnd() * 2 - 1) * h * 0.95;
    flows.push({ start: [-h, y, z], end: [h, y, z], color: A_COL, type: 0, group: GROUP.cubeA, size: 0.16, w: rnd(), speed: 0.12 + rnd() * 0.06 });
    const x = (rnd() * 2 - 1) * h * 0.95;
    const z2 = (rnd() * 2 - 1) * h * 0.95;
    flows.push({ start: [x, h, z2], end: [x, -h, z2], color: B_COL, type: 0, group: GROUP.cubeB, size: 0.16, w: rnd(), speed: 0.12 + rnd() * 0.06 });
    const x3 = (rnd() * 2 - 1) * h * 0.95;
    const y3 = (rnd() * 2 - 1) * h * 0.95;
    flows.push({ start: [x3, y3, -h], end: [x3, y3, h], color: "#ffc46b", type: 0, group: GROUP.cubeC, size: 0.2, w: rnd(), speed: 0.1 + rnd() * 0.05 });
  }
  return build(flows, parent, [0, 0]);
}

export function createDetailFlows(parent: Group) {
  const flows: Flow[] = [];
  const slotPos = (X: number, i: number, dx = 0) => {
    const c = slotCenter(i);
    return new Vector3(X + c.x + dx, c.y, 1.0);
  };
  const tc = (X: number) => new Vector3(X + TENSOR.cx, TENSOR.cy, 1.4);
  SM_X.forEach((X, si) => {
    const peer = SM_X[1 - si] as number;
    for (let i = 0; i < PIPE.stages; i++) {
      const c = slotCenter(i);
      const cos = Math.cos(c.rot);
      // TMA: strip (x set in shader) -> slot half
      flows.push({ start: [0, STRIP.a, 1.0].map((q, k) => (k === 0 ? X : q)), end: slotPos(X, i, -0.6 * cos), color: A_COL, type: 1, group: GROUP.tma, size: 0.9, w: i });
      flows.push({ start: [0, STRIP.b, 1.0].map((q, k) => (k === 0 ? X : q)), end: slotPos(X, i, 0.6 * cos), color: B_COL, type: 1, group: GROUP.tma, size: 0.9, w: i });
      // MMA operand reads: own slot -> own tensor core; B half of the peer -> this tensor core
      flows.push({ start: slotPos(X, i, -0.6 * cos), end: tc(X), color: A_COL, type: 2, group: GROUP.mmaIn, size: 0.8, w: i });
      flows.push({ start: slotPos(X, i, 0.6 * cos), end: tc(X), color: B_COL, type: 2, group: GROUP.mmaIn, size: 0.8, w: i });
      flows.push({ start: slotPos(peer, i, 0.6 * cos), end: tc(X), color: B_COL, type: 2, group: GROUP.mmaIn, size: 0.7, w: i });
    }
    // tensor core -> TMEM accumulate
    for (let i = 0; i < 6; i++) {
      flows.push({ start: [X + TENSOR.cx - 3 + i * 1.2, TENSOR.cy + 1.5, 1.4], end: [X + TMEM.cx - 3 + i * 1.2, TMEM.cy - 0.6, 0.9], color: "#ffc46b", type: 0, group: GROUP.mmaOut, size: 0.7, w: i / 6, speed: 0.7 });
    }
    // epilogue: TMEM -> registers
    for (let i = 0; i < 6; i++) {
      flows.push({ start: [X + TMEM.cx - 3 + i * 1.2, TMEM.cy - 0.5, 1.5], end: [X + REGS.cx - 3 + i * 1.2, REGS.cy + 0.6, 1.0], color: "#ffc46b", type: 0, group: GROUP.drain, size: 0.7, w: i / 6, speed: 0.55 });
    }
    // registers -> staging (SMEM), then TMA store -> HBM
    for (let i = 0; i < 4; i++) {
      flows.push({ start: [X + REGS.cx - 4 + i, REGS.cy, 1.0], end: [X + RING.cx + (i - 1.5) * 0.4, RING.cy, 1.0], color: "#ffc46b", type: 0, group: GROUP.store, size: 0.7, w: i / 4, speed: 0.6 });
      flows.push({ start: [X + RING.cx + (i - 1.5) * 0.4, RING.cy + 1.0, 1.2], end: [X + RING.cx + (i - 1.5) * 0.4, SLAB.y, 1.2], color: "#fff1c9", type: 0, group: GROUP.store, size: 0.8, w: i / 4, speed: 0.5 });
    }
  });
  return build(flows, parent, [STRIP.x0, STRIP.x1]);
}
