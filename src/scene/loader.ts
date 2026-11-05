/**
 * Tiny progressive-enhancement loader (spec §6.2): decides whether to enable 3D and, if so,
 * imports the scene on idle — never on the critical path. Otherwise: per-chapter posters.
 */
const root = document.documentElement;
const poster = document.querySelector<HTMLImageElement>(".scene-poster");
const canvas = document.getElementById("scene") as HTMLCanvasElement | null;
const hud = document.getElementById("hud");

const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = !!nav.connection?.saveData;

const posterFor = (n: number) => `/posters/chapter-${n}${innerWidth <= 1024 ? "-m" : ""}.avif`;
let posterOk = true;

function showPoster(n: number) {
  if (!poster || !posterOk) return;
  const src = posterFor(n);
  if (!poster.src.endsWith(src)) poster.src = src;
}

function enablePosters() {
  if (!poster) return;
  poster.hidden = false;
  poster.addEventListener("error", () => {
    posterOk = false;
    poster.hidden = true;
    root.classList.remove("has-poster");
  });
  poster.addEventListener("load", () => root.classList.add("has-poster"));
  showPoster(0);
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) showPoster(Number((e.target as HTMLElement).dataset.chapter ?? 0));
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  for (const s of document.querySelectorAll("section[data-chapter]")) io.observe(s);
}

function fallback() {
  root.classList.remove("scene-on");
  canvas?.remove();
  hud?.remove();
  enablePosters();
}

if (reduced || saveData) {
  fallback();
} else if (canvas) {
  const idle = (cb: () => void) =>
    "requestIdleCallback" in window
      ? (window as Window).requestIdleCallback(cb, { timeout: 1500 })
      : setTimeout(cb, 400);
  const go = () =>
    idle(async () => {
      try {
        const { start } = await import("./main");
        const res = start(canvas);
        if (!res.ok) fallback();
      } catch (err) {
        console.warn("[scene] disabled:", err);
        fallback();
      }
    });
  if (document.readyState === "complete") go();
  else addEventListener("load", go, { once: true });
  root.addEventListener("scene:fallback", fallback, { once: true });
}
