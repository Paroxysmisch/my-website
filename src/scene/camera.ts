import { CatmullRomCurve3, type PerspectiveCamera, Vector3 } from "three";
import { DETAIL_K, detail } from "./layout";

export const FOV = 28;
const TAN = Math.tan((FOV * Math.PI) / 360);

interface Stop {
  target: Vector3;
  dir: Vector3;
  rx: number;
  ry: number;
}

const k = DETAIL_K;
/**
 * Camera stops (index = stop id used by the timeline). `rx`/`ry` are the half-extents that must fit in the
 * visible region of the stage, so the framing adapts to desktop (right column) and phone (stage above text).
 */
export const STOPS: Stop[] = [
  { target: new Vector3(0, 0, 1), dir: new Vector3(-0.1, 0.34, 1), rx: 7.2, ry: 7.0 }, // 0 hero: C = A·B
  { target: new Vector3(0, 0, 1), dir: new Vector3(-0.06, 0.24, 1), rx: 6.8, ry: 6.7 }, // 1 tiling
  { target: new Vector3(0, 1.4, 0), dir: new Vector3(0, 0.22, 1), rx: 8.4, ry: 7.7 }, // 2 die
  { target: detail(0, -1, 0), dir: new Vector3(0.1, 0.16, 1), rx: 22.5 * k, ry: 18.5 * k }, // 3 SM pair
  { target: detail(0, -17.5, 0), dir: new Vector3(0.08, 0.2, 1), rx: 22.5 * k, ry: 15.5 * k }, // 4 k-loop (memory side)
  { target: detail(0, 2, 0), dir: new Vector3(0.1, 0.16, 1), rx: 22.5 * k, ry: 18 * k }, // 5 MMA
  { target: detail(0, -7, 0), dir: new Vector3(0.1, 0.16, 1), rx: 22.5 * k, ry: 27.5 * k }, // 6 epilogue
  { target: new Vector3(0, 2.6, 0), dir: new Vector3(0.0, 0.16, 1), rx: 8.6, ry: 9.6 }, // 7 finale
];

/** Where the 3D scene is framed inside the stage (desktop: right column; phone: whole stage). */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function regionFor(W: number, H: number, phone: boolean): Region {
  if (phone) return { x: 6, y: 6, w: W - 12, h: H - 6 - 74 };
  return { x: W * 0.45, y: 84, w: W * 0.55 - 28, h: H - 84 - 120 };
}

export function createCameraRig(camera: PerspectiveCamera) {
  let targets: CatmullRomCurve3;
  let dirs: CatmullRomCurve3;
  let dist: CatmullRomCurve3;
  const n = STOPS.length;
  const p = new Vector3();
  const d = new Vector3();
  const t = new Vector3();
  const l = new Vector3();

  function layout(W: number, H: number, phone: boolean) {
    const r = regionFor(W, H, phone);
    const aspect = W / H;
    const wf = r.w / W;
    const hf = r.h / H;
    camera.aspect = aspect;
    camera.fov = FOV;
    camera.near = 0.005;
    camera.far = 200;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    const dists = STOPS.map((s) => Math.max(s.ry / (TAN * hf), s.rx / (TAN * wf * aspect)));
    targets = new CatmullRomCurve3(
      STOPS.map((s) => s.target.clone()),
      false,
      "catmullrom",
      0.5,
    );
    dirs = new CatmullRomCurve3(
      STOPS.map((s) => s.dir.clone().normalize()),
      false,
      "catmullrom",
      0.5,
    );
    dist = new CatmullRomCurve3(
      dists.map((x) => new Vector3(Math.log(x), 0, 0)),
      false,
      "catmullrom",
      0.5,
    );
  }

  /** stop: continuous stop index in [0, n-1] */
  function update(stop: number) {
    const u = Math.min(1, Math.max(0, stop / (n - 1)));
    targets.getPoint(u, t);
    dirs.getPoint(u, d).normalize();
    dist.getPoint(u, l);
    p.copy(t).addScaledVector(d, Math.exp(l.x));
    camera.position.copy(p);
    camera.lookAt(t);
  }
  return { layout, update };
}
