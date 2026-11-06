import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
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
import { buildTimeline, CHAPTERS } from "./timeline";

export type StartResult = { ok: true } | { ok: false; reason: string };

export function start(canvas: HTMLCanvasElement): StartResult {
  const stage = document.getElementById("stage") as HTMLElement;
  const { tier: startTier, gl } = detectTier(canvas);
  if (startTier === "off" || !gl) return { ok: false, reason: "tier-off" };
  gsap.registerPlugin(ScrollTrigger);

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

  // ── Frame loop (render on demand; ambient animation only while the hero is on screen) ──
  let dirty = true;
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

  function frame(now: number) {
    running = false;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    const ambient = S.tau < 1.0;
    if (ambient) {
      U.uTime.value += dt;
      U.uFlowT.value += dt;
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    apply();
    renderer.render(scene, camera);
    dog.tick(now);
    if (first) {
      first = false;
      document.documentElement.classList.add("scene-on");
    }
    if (ambient) schedule();
  }
  function schedule() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }
  function requestRender() {
    dirty = true;
    schedule();
  }

  // ── Scroll → τ via ScrollTrigger scrub, mapped through section offsets ──
  const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-chapter]"));
  let anchors: number[] = [];
  function computeAnchors() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const stageBottom = phone ? stage.getBoundingClientRect().bottom : 0;
    const ref = phone ? stageBottom + 0.3 * (innerHeight - stageBottom) : innerHeight * 0.5;
    anchors = sections.map((s, i) =>
      i === 0 ? 0 : Math.max(0, s.getBoundingClientRect().top + scrollY - ref),
    );
    anchors.push(maxScroll);
    for (let i = 1; i < anchors.length; i++) {
      anchors[i] = Math.max(anchors[i] as number, (anchors[i - 1] as number) + 1);
    }
    anchors[anchors.length - 1] = Math.max(anchors[anchors.length - 1] as number, maxScroll);
  }
  function scrollToTau(y: number) {
    let i = anchors.length - 2;
    for (let k = 0; k < anchors.length - 1; k++) {
      if (y < (anchors[k + 1] as number)) {
        i = k;
        break;
      }
    }
    const a = anchors[i] as number;
    const b = anchors[i + 1] as number;
    return i + Math.min(1, Math.max(0, (y - a) / (b - a)));
  }
  function setTau(t: number) {
    S.tau = t;
    tl.time(t);
    requestRender();
  }

  const driver = { p: 0 };
  resize();
  computeAnchors();
  const fixed = new URLSearchParams(location.search).get("tau");
  if (fixed !== null) {
    setTau(Number(fixed));
  } else {
    gsap.to(driver, {
      p: 1,
      ease: "none",
      scrollTrigger: {
        start: 0,
        end: "max",
        scrub: 0.8,
        invalidateOnRefresh: true,
        onRefresh: computeAnchors,
      },
      onUpdate: () => {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        setTau(scrollToTau(driver.p * maxScroll));
      },
    });
    setTau(scrollToTau(scrollY));
  }

  let rt = 0;
  new ResizeObserver(() => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      resize();
      computeAnchors();
      ScrollTrigger.refresh();
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
