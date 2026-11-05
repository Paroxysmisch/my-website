import { CatmullRomCurve3, type PerspectiveCamera, Vector3 } from "three";
import { DETAIL_K, detail } from "./layout";

export const FOV = 38;
const TAN = Math.tan((FOV * Math.PI) / 360);

interface Stop {
  target: Vector3;
  dir: Vector3;
  rx: number;
  ry: number;
}

const k = DETAIL_K;
/** Camera stops: one per "beat" (several chapters have two). Index = stop id used by the timeline. */
export const STOPS: Stop[] = [
  { target: new Vector3(0, 0, 0), dir: new Vector3(-0.62, 0.5, 1), rx: 5.4, ry: 5.4 }, // 0 hero cube
  { target: new Vector3(0, 0.1, 0), dir: new Vector3(-0.42, 0.3, 1), rx: 4.6, ry: 4.6 }, // 1 tiling
  { target: new Vector3(0, 0, 0), dir: new Vector3(0.1, -0.3, 1), rx: 12.4, ry: 6.6 }, // 2 die
  { target: detail(0, 5.5), dir: new Vector3(0.3, -0.14, 1), rx: 22 * k, ry: 16.5 * k }, // 3 SM pair
  { target: detail(0, 8.5), dir: new Vector3(0.14, -0.38, 1), rx: 22 * k, ry: 13.5 * k }, // 4 k-loop
  { target: detail(0, 1), dir: new Vector3(0.16, -0.3, 1), rx: 22 * k, ry: 11.5 * k }, // 5 MMA / TMEM
  { target: detail(0, -9), dir: new Vector3(0.1, 0.12, 1), rx: 22 * k, ry: 15.5 * k }, // 6 lanes
  { target: detail(0, 5.5), dir: new Vector3(0.22, -0.2, 1), rx: 22 * k, ry: 16.5 * k }, // 7 epilogue
  { target: new Vector3(0, 2.7, 0), dir: new Vector3(0.05, -0.2, 1), rx: 12.8, ry: 9.2 }, // 8 finale
];

/** Where the 3D scene is framed inside the viewport (desktop: right 55%; phone: upper ~55%). */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function regionFor(W: number, H: number): Region {
  if (W >= 1025) return { x: W * 0.46, y: 100, w: W * 0.54 - 16, h: H - 120 };
  return { x: 0, y: 96, w: W, h: Math.max(160, H * 0.56 - 96) };
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

  function layout(W: number, H: number) {
    const r = regionFor(W, H);
    const aspect = W / H;
    const wf = r.w / W;
    const hf = r.h / H;
    camera.aspect = aspect;
    camera.fov = FOV;
    camera.near = 0.01;
    camera.far = 200;
    // shift the projection so the scene centre lands in the middle of the region
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
