import { type Camera, type Group, Vector3 } from "three";

/** Screen-space footprint of the 3D scene (up to 5 convex polygons, 8 points each, CSS px, y down).
 *  The background shader clears itself out under these so the animation reads cleanly. */
export const bgMask = {
  pts: new Float32Array(5 * 8 * 2),
  n: [0, 0, 0, 0, 0],
  a: [0, 0, 0, 0, 0],
  active: false,
};

const v = new Vector3();

/** Octagon of extreme points of the projected corners (convex, ordered counter-clockwise on screen). */
export function setPolygon(
  slot: number,
  corners: Vector3[],
  group: Group | null,
  camera: Camera,
  w: number,
  h: number,
  amt: number,
) {
  bgMask.a[slot] = amt;
  if (amt < 0.01) {
    bgMask.n[slot] = 0;
    return;
  }
  group?.updateMatrixWorld();
  const pts: [number, number][] = corners.map((c) => {
    v.copy(c);
    if (group) v.applyMatrix4(group.matrixWorld);
    v.project(camera);
    return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
  });
  const out: [number, number][] = [];
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4;
    const dx = Math.cos(ang);
    const dy = -Math.sin(ang); // screen y points down, so this walks counter-clockwise on screen
    let best = pts[0] as [number, number];
    let bd = -Infinity;
    for (const p of pts) {
      const d = p[0] * dx + p[1] * dy;
      if (d > bd) {
        bd = d;
        best = p;
      }
    }
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - best[0], last[1] - best[1]) > 0.5) out.push(best);
  }
  bgMask.n[slot] = out.length;
  out.forEach((p, i) => {
    bgMask.pts[(slot * 8 + i) * 2] = p[0];
    bgMask.pts[(slot * 8 + i) * 2 + 1] = p[1];
  });
  bgMask.active = true;
}
