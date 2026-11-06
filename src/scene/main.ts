import gsap from "gsap";
import { Color, PerspectiveCamera, Scene, type Vector3, WebGLRenderer } from "three";
import { createDie } from "./actors/die";
import { createAssignFlows, createMatrixFlows } from "./actors/flows";
import { createMatrices } from "./actors/matrices";
import { createSmPair } from "./actors/smPair";
import { createSelectedTile } from "./actors/tiles";
import { beatAt } from "./beats";
import { createCameraRig } from "./camera";
import { createHud } from "./hud";
import { createLabels } from "./labels";
import { createPicker } from "./picking";
import { detectTier, makeQuality, stepDown, type Tier, Watchdog } from "./quality";
import { GROUP, S, U } from "./state";
import { buildTimeline, CHAPTERS, DWELL } from "./timeline";

export type StartResult = { ok: true } | { ok: false; reason: string };

export function start(canvas: HTMLCanvasElement): StartResult {
  const stage = document.getElementById("stage") as HTMLElement;
  const { tier: startTier, gl } = detectTier(canvas);
  if (startTier === "off" || !gl) return { ok: false, reason: "tier-off" };

  let tier: Tier = startTier;
  let quality = makeQuality(tier);
  const renderer = new WebGLRenderer({ canvas, context: gl, antialias: false, alpha: false });
  renderer.setClearColor(new Color("#0f1012"), 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const rig = createCameraRig(camera);

  // ── Actors ──
  const mats = createMatrices();
  createMatrixFlows(mats.group);
  const die = createDie();
  createAssignFlows(die.group);
  const detail = createSmPair();
  const tile = createSelectedTile(mats.group);
  scene.add(die.group, detail.group, mats.group, tile.group);

  const labelHost = stage.querySelector<HTMLElement>(".labels") as HTMLElement;
  const labels = createLabels(labelHost, camera, (v: Vector3) => mats.group.localToWorld(v));
  const setHud = createHud(document.getElementById("hud") as HTMLElement);
  const picker = createPicker({
    stage,
    camera,
    mats: mats.group,
    die: die.group,
    detail: detail.group,
    getTau: () => S.tau,
  });
  const beatEl = document.getElementById("beat") as HTMLElement;
  let lastBeat = "";
  const tl = buildTimeline();

  // ── Sizing (the stage is the full viewport on desktop, a strip above the text on phones) ──
  let W = stage.clientWidth;
  let H = stage.clientHeight;
  let phone = innerWidth <= 1024;
  function resize() {
    W = Math.max(1, stage.clientWidth);
    H = Math.max(1, stage.clientHeight);
    phone = innerWidth <= 1024;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dprCap));
    renderer.setSize(W, H, false);
    rig.layout(W, H, phone);
    requestRender();
  }

  // ── Frame loop (continuous while visible: every chapter loops its data movement) ──
  let running = false;
  let visible = true;
  let first = true;
  let lastT = performance.now();
  const dog = new Watchdog(tier === "high" ? 20 : 24, () => {
    tier = stepDown(tier);
    const next = makeQuality(tier);
    quality = { ...next, dprCap: Math.max(1, Math.min(quality.dprCap, next.dprCap) - 0.25) };
    resize();
  });

  function apply() {
    mats.update();
    const band = U.uBand.value * U.uMatVis.value * U.uABVis.value;
    S.groups[GROUP.matA] = band;
    S.groups[GROUP.matB] = band;
    rig.update(S.camT);
    camera.updateMatrixWorld();
    tile.update();
    labels(S.tau, W, H);
    setHud(Math.min(CHAPTERS - 1, Math.max(0, Math.floor(S.tau + 1e-6))));
    picker.refresh();
    const b = beatAt(S.tau);
    if (b !== lastBeat) {
      beatEl.textContent = b;
      lastBeat = b;
    }
  }

  // ── Player: scroll only selects the chapter; τ then travels there (camera pan) and loops the data movement ──
  const labelsHost = labelHost;
  let target = 0;
  let current = 0;
  let travel: gsap.core.Tween | null = null;
  let dir = 1;
  let lastDt = 0;
  const wasPlaying = { v: false };

  function setTau(t: number) {
    S.tau = t;
    tl.time(t);
  }
  function goTo(k: number) {
    if (k === target && (travel || current === k)) return;
    target = k;
    const dw = DWELL[k] as (typeof DWELL)[number];
    travel?.kill();
    const dist = Math.abs(dw.arrive - S.tau);
    if (dist < 1e-3) {
      current = k;
      travel = null;
      return;
    }
    labelsHost.classList.add("moving");
    const o = { t: S.tau };
    travel = gsap.to(o, {
      t: dw.arrive,
      duration: Math.min(3.2, 0.6 + 0.8 * dist),
      ease: "power2.inOut",
      onUpdate: () => setTau(o.t),
      onComplete: () => {
        travel = null;
        current = k;
        dir = 1;
        labelsHost.classList.remove("moving");
      },
    });
  }
  function advance(dt: number) {
    if (travel) return;
    const dw = DWELL[current] as (typeof DWELL)[number];
    if (dw.mode === "static") return;
    const rate = (dw.l1 - dw.l0) / dw.secs;
    let t = S.tau + dir * rate * dt;
    if (dw.mode === "pingpong") {
      if (t > dw.l1) {
        t = 2 * dw.l1 - t;
        dir = -1;
      } else if (t < dw.l0) {
        t = 2 * dw.l0 - t;
        dir = 1;
      }
    } else if (dw.mode === "wrap") {
      if (t >= dw.l1) t = dw.l0 + (t - dw.l1);
    } else if (t > dw.l1) t = dw.l1;
    if (t !== S.tau) setTau(t);
  }

  function frame(now: number) {
    running = false;
    if (!visible || document.hidden) {
      wasPlaying.v = false;
      return;
    }
    lastDt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!wasPlaying.v) {
      wasPlaying.v = true;
      lastDt = 0;
    }
    if (!fixedMode) {
      U.uTime.value += lastDt;
      U.uFlowT.value += lastDt;
      advance(lastDt);
    }
    apply();
    renderer.render(scene, camera);
    dog.tick(now);
    if (first) {
      first = false;
      document.documentElement.classList.add("scene-on");
    }
    schedule();
  }
  function schedule() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function requestRender() {
    schedule();
  }

  // ── Scroll → active chapter (cheap: no scrubbing) ──
  const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-chapter]"));
  function activeChapter() {
    const stageBottom = phone ? stage.getBoundingClientRect().bottom : 0;
    const ref = phone ? stageBottom + 0.3 * (innerHeight - stageBottom) : innerHeight * 0.5;
    let k = 0;
    sections.forEach((sec, i) => {
      if (sec.getBoundingClientRect().top <= ref) k = i;
    });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) k = sections.length - 1;
    return k;
  }
  let sraf = 0;
  const onScroll = () => {
    cancelAnimationFrame(sraf);
    sraf = requestAnimationFrame(() => goTo(activeChapter()));
  };

  resize();
  const fixed = new URLSearchParams(location.search).get("tau");
  const fixedMode = fixed !== null;
  if (fixedMode) {
    setTau(Number(fixed));
  } else {
    setTau((DWELL[0] as (typeof DWELL)[number]).arrive);
    addEventListener("scroll", onScroll, { passive: true });
    goTo(activeChapter());
  }

  let rt = 0;
  new ResizeObserver(() => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      resize();
      onScroll();
    }, 100);
  }).observe(stage);
  addEventListener("orientationchange", () => requestRender());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) requestRender();
  });
  const footer = document.querySelector(".site-footer");
  if (footer) {
    new IntersectionObserver(([e]) => {
      visible = !(e?.isIntersecting && e.intersectionRatio > 0.99 && S.tau > 7.99);
      if (visible) requestRender();
    }).observe(footer);
  }
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    document.documentElement.classList.remove("scene-on");
    document.documentElement.dispatchEvent(new CustomEvent("scene:fallback"));
  });

  (window as unknown as { __scene?: unknown }).__scene = { setTau, tl, renderer, camera, S, U };
  renderer.compile(scene, camera);
  return { ok: true };
}
