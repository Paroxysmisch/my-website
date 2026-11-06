import { type Camera, type Group, Matrix4, Raycaster, Vector2, Vector3 } from "three";
import { detailHotspots, dieHotspots, type Hotspot } from "./hotspots";
import { PROBLEM, SELECTED } from "./kernel";
import { MAT } from "./layout";
import { S, U } from "./state";

interface Hit {
  t: number;
  title: string;
  body: string;
  dyn?: () => string;
  /** corners (in the group's local space) used to outline the part */
  corners: Vector3[];
  group: Group;
}

const slab = (o: number, d: number, lo: number, hi: number): [number, number] => {
  if (Math.abs(d) < 1e-9) return o < lo || o > hi ? [1, 0] : [-Infinity, Infinity];
  const a = (lo - o) / d;
  const b = (hi - o) / d;
  return a < b ? [a, b] : [b, a];
};

function boxCorners(h: Hotspot): Vector3[] {
  const out: Vector3[] = [];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1])
        out.push(new Vector3(h.cx + (sx * h.w) / 2, h.cy + (sy * h.h) / 2, h.cz + (sz * h.d) / 2));
  return out;
}

/** Hover / tap tooltips for the 3D scene: CPU ray picking against a few hundred boxes + the matrix planes. */
export function createPicker(opts: {
  stage: HTMLElement;
  camera: Camera;
  mats: Group;
  die: Group;
  detail: Group;
  getTau: () => number;
}) {
  const { stage, camera, mats, die, detail } = opts;
  const rc = new Raycaster();
  const ndc = new Vector2();
  const inv = new Matrix4();
  const o = new Vector3();
  const d = new Vector3();
  const tip = document.createElement("div");
  tip.id = "tip";
  tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  const hl = document.createElement("div");
  hl.className = "scene-hl";
  stage.appendChild(hl);
  let current: Hit | null = null;
  let hideTimer = 0;
  let lastX = 0;
  let lastY = 0;
  let raf = 0;

  function localRay(g: Group) {
    g.updateMatrixWorld();
    inv.copy(g.matrixWorld).invert();
    o.copy(rc.ray.origin).applyMatrix4(inv);
    d.copy(rc.ray.origin).add(rc.ray.direction).applyMatrix4(inv).sub(o);
  }

  function pickBoxes(list: Hotspot[], g: Group): Hit | null {
    localRay(g);
    let best: Hit | null = null;
    let bestVol = Infinity;
    for (const h of list) {
      const [x0, x1] = slab(o.x, d.x, h.cx - h.w / 2, h.cx + h.w / 2);
      const [y0, y1] = slab(o.y, d.y, h.cy - h.h / 2, h.cy + h.h / 2);
      const [z0, z1] = slab(o.z, d.z, h.cz - h.d / 2, h.cz + h.d / 2);
      const t0 = Math.max(x0, y0, z0);
      const t1 = Math.min(x1, y1, z1);
      if (t1 < 0 || t0 > t1) continue;
      const t = Math.max(0, t0);
      const vol = h.w * h.h;
      // nearest wins; when entry points are (almost) equal prefer the smaller part
      if (!best || t < best.t - 1e-4 || (Math.abs(t - best.t) <= 1e-4 && vol < bestVol)) {
        best = { t, title: h.title, body: h.body, dyn: h.dyn, corners: boxCorners(h), group: g };
        bestVol = vol;
      }
    }
    return best;
  }

  function pickMatrices(): Hit | null {
    localRay(mats);
    if (Math.abs(d.z) < 1e-9) return null;
    const t = -o.z / d.z;
    if (t < 0) return null;
    const x = o.x + d.x * t;
    const y = o.y + d.y * t;
    const { S: size, gap } = MAT;
    const N = U.uRefine.value > 0.5 ? 32 : 8;
    const W = PROBLEM.M / N;
    const idx = (v: number) => Math.min(N - 1, Math.max(0, Math.floor((v / size) * N)));
    const rect = (x0: number, y0: number, ti: number, tj: number) => {
      const ts = size / N;
      const lx = x0 + tj * ts;
      const ly = y0 - ti * ts;
      return [
        new Vector3(lx, ly, 0),
        new Vector3(lx + ts, ly, 0),
        new Vector3(lx + ts, ly - ts, 0),
        new Vector3(lx, ly - ts, 0),
      ];
    };
    const coarse =
      N === 8 ? " (illustrative 8×8 grid; the real kernel uses 32×32 tiles of 256×256)" : "";
    const rng = (i: number) => `${i * W}–${(i + 1) * W - 1}`;
    if (x >= 0 && x <= size && y <= 0 && y >= -size) {
      const tj = idx(x);
      const ti = idx(-y);
      const sel = N === 32 && ti === SELECTED.row && tj === SELECTED.col;
      return {
        t,
        title: `C · tile (${ti}, ${tj})`,
        body: `C[${rng(ti)}, ${rng(tj)}] = Σₖ A(${ti}, k) · B(k, ${tj}). One independent job${coarse}.${sel ? " This is the tile we follow." : ""}`,
        corners: rect(0, 0, ti, tj),
        group: mats,
      };
    }
    if (U.uABVis.value > 0.5 && x >= -gap - size && x <= -gap && y <= 0 && y >= -size) {
      const kt = idx(x + gap + size);
      const ti = idx(-y);
      return {
        t,
        title: `A · tile (${ti}, k ${kt})`,
        body: `A[rows ${rng(ti)}, k ${rng(kt)}] (BF16, left operand). Tile row ${ti} of A feeds every C tile in row ${ti}.${coarse}`,
        corners: rect(-gap - size, 0, ti, kt),
        group: mats,
      };
    }
    if (U.uABVis.value > 0.5 && x >= 0 && x <= size && y >= gap && y <= gap + size) {
      const tj = idx(x);
      const kt = idx(gap + size - y);
      return {
        t,
        title: `B · tile (k ${kt}, ${tj})`,
        body: `B[k ${rng(kt)}, cols ${rng(tj)}] (BF16, right operand). Tile column ${tj} of B feeds every C tile in column ${tj}.${coarse}`,
        corners: rect(0, gap + size, kt, tj),
        group: mats,
      };
    }
    return null;
  }

  function pick(ex: number, ey: number): Hit | null {
    const r = stage.getBoundingClientRect();
    if (ex < r.left || ex > r.right || ey < r.top || ey > r.bottom) return null;
    ndc.set(((ex - r.left) / r.width) * 2 - 1, -((ey - r.top) / r.height) * 2 + 1);
    rc.setFromCamera(ndc, camera);
    let best: Hit | null = null;
    const consider = (h: Hit | null) => {
      if (h && (!best || h.t < best.t)) best = h;
    };
    if (U.uDetailVis.value > 0.6) {
      consider(pickBoxes(detailHotspots, detail));
    } else {
      if (U.uDieVis.value > 0.6) consider(pickBoxes(dieHotspots, die));
      if (U.uMatVis.value > 0.6 && mats.visible) {
        const m = pickMatrices();
        // the matrices float in front of the die: they win where they overlap it
        if (m) best = m;
      }
    }
    return best;
  }

  function show(h: Hit, x: number, y: number) {
    current = h;
    const dyn = h.dyn?.();
    tip.replaceChildren();
    const t = document.createElement("strong");
    t.textContent = h.title;
    const b = document.createElement("span");
    b.textContent = h.body;
    tip.append(t, b);
    if (dyn) {
      const s = document.createElement("em");
      s.textContent = dyn;
      tip.append(s);
    }
    tip.style.opacity = "1";
    const w = tip.offsetWidth;
    const hh = tip.offsetHeight;
    const nx = Math.min(innerWidth - w - 10, Math.max(10, x + 16));
    let ny = y + 18;
    if (ny + hh > innerHeight - 10) ny = Math.max(10, y - hh - 14);
    tip.style.transform = `translate(${Math.round(nx)}px, ${Math.round(ny)}px)`;
    // outline
    const r = stage.getBoundingClientRect();
    h.group.updateMatrixWorld();
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const v = new Vector3();
    for (const c of h.corners) {
      v.copy(c).applyMatrix4(h.group.matrixWorld).project(camera);
      const px = (v.x * 0.5 + 0.5) * r.width;
      const py = (-v.y * 0.5 + 0.5) * r.height;
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
    hl.style.cssText = `opacity:1;left:${x0 - 2}px;top:${y0 - 2}px;width:${x1 - x0 + 4}px;height:${y1 - y0 + 4}px`;
    document.documentElement.classList.add("scene-hover");
  }
  function hide() {
    current = null;
    tip.style.opacity = "0";
    hl.style.opacity = "0";
    document.documentElement.classList.remove("scene-hover");
  }

  const blocked = (e: Event) =>
    (e.target as Element | null)?.closest?.("a,button,summary,.col,header,nav,details") != null;

  function handle(e: PointerEvent | MouseEvent, sticky: boolean) {
    lastX = e.clientX;
    lastY = e.clientY;
    if (blocked(e)) return hide();
    const h = pick(e.clientX, e.clientY);
    clearTimeout(hideTimer);
    if (!h) return hide();
    show(h, e.clientX, e.clientY);
    if (sticky) hideTimer = window.setTimeout(hide, 5000);
  }
  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => handle(e, false));
    },
    { passive: true },
  );
  document.addEventListener("click", (e) => handle(e, true));
  addEventListener("scroll", () => current && hide(), { passive: true });
  document.addEventListener("keydown", (e) => e.key === "Escape" && hide());
  /** refresh live state text (ring stages, TMEM progress) while a tooltip is open */
  return {
    refresh() {
      if (!current?.dyn) return;
      const em = tip.querySelector("em");
      if (em) em.textContent = current.dyn();
    },
    lastPos: () => [lastX, lastY],
  };
}

export { S as _S };
