import {
  BufferGeometry,
  Float32BufferAttribute,
  type Group,
  LineSegments,
  Mesh,
  PlaneGeometry,
  QuadraticBezierCurve3,
  ShaderMaterial,
  Vector3,
} from "three";
import { PIPE } from "../kernel";
import { RING, SM_X, STRIP, slotCenter } from "../layout";
import type { BoxSpec } from "../materials";
import { withCommon } from "../materials";
import lineFrag from "../shaders/line.frag.glsl?raw";
import lineVert from "../shaders/line.vert.glsl?raw";
import planeVert from "../shaders/plane.vert.glsl?raw";
import stripFrag from "../shaders/strip.frag.glsl?raw";
import { U } from "../state";

export const A_COL = "#4fd1e0";
export const B_COL = "#e46fd0";

/** Ring of PIPE.stages SMEM slots (A half | B half) + one mbarrier indicator per stage, per SM. */
export function ringSpecs(): BoxSpec[] {
  const out: BoxSpec[] = [];
  for (const X of SM_X) {
    for (let i = 0; i < PIPE.stages; i++) {
      const c = slotCenter(i);
      const cos = Math.cos(c.rot);
      const sin = Math.sin(c.rot);
      const q = RING.w / 4;
      for (const [op, sign, color] of [
        ["A", -1, A_COL],
        ["B", 1, B_COL],
      ] as const) {
        void op;
        out.push({
          pos: [X + c.x + sign * q * cos, c.y + sign * q * sin, 0.35],
          size: [RING.w / 2 - 0.06, RING.h, 0.7],
          rotZ: c.rot,
          color,
          info: [5, i, 0.1, 2],
        });
      }
      // barrier indicator sits radially outside the slot
      const dx = Math.cos(Math.PI / 2 - (i * Math.PI) / 3);
      const dy = Math.sin(Math.PI / 2 - (i * Math.PI) / 3);
      out.push({
        pos: [X + c.x + dx * 1.75, c.y + dy * 1.45, 0.2],
        size: [0.75, 0.75, 0.4],
        color: "#d98a4e",
        info: [9, i, 0.12, 2],
      });
    }
  }
  return out;
}

/** The A and B strips in HBM, one pair per SM, sliced into 128 k-blocks. */
export function createStrips(parent: Group) {
  const geo = new PlaneGeometry(STRIP.x1 - STRIP.x0, STRIP.h);
  for (const X of SM_X) {
    for (const [op, y] of [
      [0, STRIP.a],
      [1, STRIP.b],
    ] as const) {
      const m = new Mesh(
        geo,
        new ShaderMaterial({
          uniforms: { ...U, uOperand: { value: op } } as never,
          vertexShader: planeVert,
          fragmentShader: withCommon(stripFrag),
        }),
      );
      m.position.set(X, y, 0.05);
      m.frustumCulled = false;
      parent.add(m);
    }
  }
}

/** Each SM loads half of B; the paired MMA reads both halves: arcs between the two rings. */
export function createBridge(parent: Group) {
  const pts: number[] = [];
  const top = (X: number, dx: number) => new Vector3(X + RING.cx + dx, RING.cy + RING.r + 1.2, 0.8);
  for (const dx of [0.6, 1.2]) {
    const a = top(SM_X[0], dx);
    const b = top(SM_X[1], dx);
    const mid = new Vector3((a.x + b.x) / 2, 9.4 + dx * 2, 0.8);
    const pl = new QuadraticBezierCurve3(a, mid, b).getPoints(40);
    for (let i = 0; i < pl.length - 1; i++) {
      const p = pl[i] as Vector3;
      const q = pl[i + 1] as Vector3;
      pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pts, 3));
  const m = new ShaderMaterial({
    uniforms: {
      uColor: { value: [0.894, 0.435, 0.816] },
      uAlpha: U.uBridge,
      uTime: U.uTime,
    } as never,
    vertexShader: lineVert,
    fragmentShader: withCommon(lineFrag),
  });
  const l = new LineSegments(g, m);
  l.frustumCulled = false;
  parent.add(l);
}
