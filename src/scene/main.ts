import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Color, PerspectiveCamera, Scene, type Vector3, WebGLRenderer } from "three";
import { createDie } from "./actors/die";
import { createCubeFlows } from "./actors/flows";
import { createMatrices } from "./actors/matrices";
import { createSmPair } from "./actors/smPair";
import { createSelectedTile } from "./actors/tiles";
import { createCameraRig } from "./camera";
import { createHud } from "./hud";
import { createLabels } from "./labels";
import { detectTier, makeQuality, stepDown, type Tier, Watchdog } from "./quality";
import { S, U } from "./state";
import { buildTimeline, CHAPTERS } from "./timeline";

export type StartResult = { ok: true } | { ok: false; reason: string };

export function start(canvas: HTMLCanvasElement): StartResult {
  const { tier: startTier, gl } = detectTier(canvas);
  if (startTier === "off" || !gl) return { ok: false, reason: "tier-off" };
  gsap.registerPlugin(ScrollTrigger);

  let tier: Tier = startTier;
  let quality = makeQuality(tier);
  const renderer = new WebGLRenderer({ canvas, context: gl, antialias: false, alpha: false });
  renderer.setClearColor(new Color("#0f1115"), 1);
  renderer.autoClear = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const rig = createCameraRig(camera);

  // ── Actors ────────────────────────────────────────────────────────────────
  const cube = createMatrices();
  const cubeFlows = createCubeFlows(cube.group);
  const die = createDie();
  const detail = createSmPair();
  const tile = createSelectedTile(cube.group);
  scene.add(die.group, detail.group, cube.group, tile.group);
  void cubeFlows;

  const labelHost = document.createElement("div");
  labelHost.setAttribute("aria-hidden", "true");
  document.body.appendChild(labelHost);
  const labels = createLabels(labelHost, camera, () => ({
    toWorld: (v: Vector3) => cube.group.localToWorld(v.clone()),
  }));
  const hudEl = document.getElementById("hud") as HTMLElement;
  const setHud = createHud(hudEl);

  const tl = buildTimeline();

  // ── Sizing ────────────────────────────────────────────────────────────────
  let W = innerWidth;
  let H = innerHeight;
  function resize() {
    W = innerWidth;
    H = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality.dprCap));
    renderer.setSize(W, H, false);
    rig.layout(W, H);
    dirty = true;
  }

  // ── Frame ─────────────────────────────────────────────────────────────────
  let dirty = true;
  let running = false;
  let visible = true;
  let first = true;
  let lastT = performance.now();
  const dog = new Watchdog(tier === "high" ? 20 : 24, () => {
    tier = stepDown(tier);
    const next = makeQuality(tier);
    // DPR first; only the tier label changes otherwise
    quality = { ...next, dprCap: Math.max(1, Math.min(quality.dprCap, next.dprCap) - 0.25) };
    resize();
  });

  function apply() {
    const tau = S.tau;
    cube.group.position.y = S.cubeY;
    cube.group.scale.setScalar(S.cubeScale);
    const cubeFlow = U.uStreak.value * U.uCubeVis.value;
    S.groups[0] = cubeFlow;
    S.groups[1] = cubeFlow;
    S.groups[2] = cubeFlow;
    U.uBridge.value = U.uTmaOn.value * U.uDetailVis.value;
    rig.update(S.camT);
    camera.updateMatrixWorld();
    tile.update();
    labels(tau, W, H);
    setHud(Math.min(CHAPTERS - 1, Math.max(0, Math.floor(tau + 1e-6))));
  }

  function frame(now: number) {
    running = false;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    // Idle animation only in the hero (data streaks); everywhere else render on demand.
    const ambient = S.tau < 0.9;
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
  const requestRender = () => {
    dirty = true;
    schedule();
  };

  // ── Scroll → τ (chapter units) via ScrollTrigger scrub, mapped through section offsets ─
  const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-chapter]"));
  let anchors: number[] = [];
  function computeAnchors() {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    anchors = sections.map((s, i) =>
      i === 0 ? 0 : Math.max(0, s.getBoundingClientRect().top + scrollY - innerHeight * 0.55),
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
  computeAnchors();
  const params = new URLSearchParams(location.search);
  const fixed = params.get("tau");

  resize();
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

  // Debounced resize
  let rt = 0;
  addEventListener("resize", () => {
    clearTimeout(rt);
    rt = window.setTimeout(() => {
      resize();
      computeAnchors();
      ScrollTrigger.refresh();
      requestRender();
    }, 120);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) requestRender();
  });
  // Pause when the canvas is effectively out of view (footer)
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
  requestRender();
  // Pre-compile shaders during idle so chapter transitions don't hitch.
  renderer.compile(scene, camera);
  return { ok: true };
}
