import {
  Color,
  Float32BufferAttribute,
  type Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  Vector3,
} from "three";
import {
  C_THUMB,
  diePairs,
  gigaCenter,
  RING,
  ringX,
  SM_L,
  SM_X,
  STAGING,
  STRIP,
  subPartition,
} from "../layout";
import { additiveMaterial } from "../materials";
import flowFrag from "../shaders/flow.frag.glsl?raw";
import flowVert from "../shaders/flow.vert.glsl?raw";
import { GROUP, S } from "../state";

export const A_HEX = "#6aa6ff";
export const B_HEX = "#e062d0";
const ACC_HEX = "#f0a93a";
const OK_HEX = "#4ed08a";

interface Flow {
  start: number[];
  end: number[];
  via?: number[];
  color: string;
  type: number;
  group: number;
  size: number;
  w: number;
  speed?: number;
  arc?: number;
  tail?: number;
}

function build(flows: Flow[], parent: Group) {
  const n = flows.length;
  const geo = new InstancedBufferGeometry();
  geo.setAttribute(
    "position",
    new Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3),
  );
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.instanceCount = n;
  const A = (len: number) => new Float32Array(n * len);
  const start = A(3);
  const end = A(3);
  const via = A(3);
  const color = A(3);
  const info = A(4);
  const extra = A(4);
  const c = new Color();
  flows.forEach((f, i) => {
    start.set(f.start, i * 3);
    end.set(f.end, i * 3);
    via.set(f.via ?? f.end, i * 3);
    c.set(f.color).convertLinearToSRGB();
    color.set([c.r, c.g, c.b], i * 3);
    info.set([f.type, f.group, f.size, f.w], i * 4);
    extra.set([f.speed ?? 0.3, f.arc ?? 0, f.tail ?? 0, 0], i * 4);
  });
  geo.setAttribute("aStart", new InstancedBufferAttribute(start, 3));
  geo.setAttribute("aEnd", new InstancedBufferAttribute(end, 3));
  geo.setAttribute("aVia", new InstancedBufferAttribute(via, 3));
  geo.setAttribute("aColor", new InstancedBufferAttribute(color, 3));
  geo.setAttribute("aInfo", new InstancedBufferAttribute(info, 4));
  geo.setAttribute("aExtra", new InstancedBufferAttribute(extra, 4));
  const mat = additiveMaterial(flowVert, flowFrag, { uGroup: { value: S.groups } });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 40;
  parent.add(mesh);
  return mesh;
}

let seed = 11;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

/** Hero: tiled matmul. Sparks stream from the active A tile and B tile into the C tile being accumulated. */
export function createMatrixFlows(parent: Group) {
  const flows: Flow[] = [];
  for (let i = 0; i < 18; i++) {
    const jit = () => (rnd() - 0.5) * 0.5;
    flows.push({
      start: [jit(), jit(), 0],
      end: [jit(), jit(), 0],
      color: A_HEX,
      type: 4,
      group: GROUP.matA,
      size: 0.1,
      w: i / 18,
      speed: 0.42,
      arc: 0.9 + rnd() * 0.7,
      tail: 0.16,
    });
    flows.push({
      start: [jit(), jit(), 0],
      end: [jit(), jit(), 0],
      color: B_HEX,
      type: 5,
      group: GROUP.matB,
      size: 0.1,
      w: i / 18 + 0.5 / 18,
      speed: 0.42,
      arc: 0.9 + rnd() * 0.7,
      tail: 0.16,
    });
  }
  return build(flows, parent);
}

/** Die: GigaThread engine hands CTA pairs out to every enabled SM pair. */
export function createAssignFlows(parent: Group) {
  const flows: Flow[] = diePairs.map((p) => {
    const g = gigaCenter(p.die);
    return {
      start: [g.x, g.y, 0.12],
      end: [p.cx, p.cy, 0.14],
      color: ACC_HEX,
      type: 3,
      group: GROUP.assign,
      size: 0.1,
      w: p.id % 37,
      arc: 0.35,
      tail: 0.2,
    };
  });
  return build(flows, parent);
}

/** Inside the SM pair (all coordinates in detail units). */
export function createDetailFlows(parent: Group) {
  const flows: Flow[] = [];
  const tma = SM_L.tma.y;
  const sm = SM_L.smem.y;
  SM_X.forEach((X, si) => {
    const peer = SM_X[1 - si] as number;
    const sps = [0, 1, 2, 3].map(subPartition);
    for (let i = 0; i < RING.count; i++) {
      const x = X + ringX(i);
      for (const [op, y, hex, off] of [
        ["A", STRIP.a, A_HEX, 0.78],
        ["B", STRIP.b, B_HEX, -0.78],
      ] as const) {
        flows.push({
          start: [X, y, 0.9],
          via: [x, tma, 1.4],
          end: [x, sm + off, 1.0],
          color: hex,
          type: 1,
          group: GROUP.tma,
          size: 1.5,
          w: i,
          arc: 3.5,
        });
        void op;
      }
      // MMA reads the slot: own A rows and own B half -> all four tensor cores; peer's B half too
      for (const sp of sps) {
        const tc = [X + sp.cx, sp.cores, 1.5];
        flows.push({
          start: [x, sm + 0.78, 1.1],
          end: tc,
          color: A_HEX,
          type: 2,
          group: GROUP.mmaIn,
          size: 1.2,
          w: i,
          arc: 2,
        });
        flows.push({
          start: [x, sm - 0.78, 1.1],
          end: tc,
          color: B_HEX,
          type: 2,
          group: GROUP.mmaIn,
          size: 1.2,
          w: i,
          arc: 2,
        });
        flows.push({
          start: [peer + ringX(i), sm - 0.78, 1.1],
          end: tc,
          color: B_HEX,
          type: 2,
          group: GROUP.mmaIn,
          size: 1.05,
          w: i,
          arc: 4,
        });
      }
    }
    for (const sp of sps) {
      for (let k = 0; k < 3; k++) {
        const dx = (k - 1) * 2.2;
        // tensor core -> TMEM accumulate
        flows.push({
          start: [X + sp.cx + dx, sp.cores + sp.coresH / 2 - 0.2, 1.3],
          end: [X + sp.cx + dx, sp.tmem, 0.9],
          color: ACC_HEX,
          type: 0,
          group: GROUP.mmaOut,
          size: 0.98,
          w: k / 3,
          speed: 0.9,
        });
        // epilogue: TMEM -> registers (tcgen05.ld)
        flows.push({
          start: [X + sp.cx + dx, sp.tmem, 1.0],
          end: [X + sp.cx + dx, sp.regs, 1.0],
          color: OK_HEX,
          type: 0,
          group: GROUP.drain,
          size: 0.9,
          w: k / 3,
          speed: 0.8,
        });
      }
      // registers -> C staging buffer in shared memory
      for (let k = 0; k < 2; k++) {
        flows.push({
          start: [X + sp.cx + (k - 0.5) * 2, sp.regs, 1.3],
          end: [X + STAGING.x + (k - 0.5) * 0.8, sm, 1.2],
          color: OK_HEX,
          type: 0,
          group: GROUP.store,
          size: 1.05,
          w: (k + sp.q * 2) / 8,
          speed: 0.45,
          arc: 2.5,
        });
      }
    }
    // TMA store: staging -> C in HBM
    for (let k = 0; k < 6; k++) {
      flows.push({
        start: [X + STAGING.x, sm - 1.0, 1.3],
        end: [
          C_THUMB.cx + (si === 0 ? -1.3 : 1.3) + (k - 2.5) * 0.15,
          C_THUMB.cy + (si === 0 ? 1.2 : -1.2) * 0,
          1.0,
        ],
        color: OK_HEX,
        type: 0,
        group: GROUP.store,
        size: 1.2,
        w: k / 6,
        speed: 0.4,
        arc: 3,
      });
    }
  });
  return build(flows, parent);
}

export const _unused = Vector3;
