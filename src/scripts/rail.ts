// Railway-line nav + progress: highlights the active station, fills the line (and moves the train) with overall
// progress, and fills the phone strip's grey segments one by one as each section is read.
import { animBottom, isPhone } from "./phoneLayout";

const secs = [...document.querySelectorAll<HTMLElement>("section[data-chapter]")];
const dots = [...document.querySelectorAll<HTMLElement>("#rail a")];
const strip = document.getElementById("progress-strip");
const segs = strip ? [...strip.querySelectorAll<HTMLElement>("span")] : [];
const n = secs.length;
const prev = document.getElementById("pager-prev") as HTMLAnchorElement | null;
const next = document.getElementById("pager-next") as HTMLAnchorElement | null;
const pcount = document.getElementById("pager-count");
let raf = 0;

const rail = document.getElementById("rail");
const train = rail?.querySelector<HTMLElement>(".train") ?? null;
const lis = rail ? [...rail.querySelectorAll<HTMLElement>("li")] : [];
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function update() {
  const vh = innerHeight;
  const phone = isPhone();
  const ref = phone ? animBottom() + 0.3 * (vh - animBottom()) : vh * 0.5;
  const max = document.documentElement.scrollHeight - vh;
  const atEnd = scrollY >= max - 4;
  // which section is active (same rule as the 3D scene)
  let active = 0;
  secs.forEach((s, i) => {
    if (s.getBoundingClientRect().top <= ref) active = i;
  });
  if (atEnd) active = n - 1;
  // progress p in "stations": exactly i when scrolled to section i's top (the locked position)
  const tops = secs.map((s) => Math.min(max, Math.round(s.getBoundingClientRect().top + scrollY)));
  let i = 0;
  tops.forEach((t, k) => {
    if (t <= scrollY + 1) i = k;
  });
  const span = i < n - 1 ? Math.max(1, (tops[i + 1] as number) - (tops[i] as number)) : 1;
  let p = i + (i < n - 1 ? Math.min(1, Math.max(0, (scrollY - (tops[i] as number)) / span)) : 0);
  if (atEnd) p = n - 1;
  const f = Math.min(1, Math.max(0, p / (n - 1)));
  document.documentElement.style.setProperty("--fill", f.toFixed(4));
  dots.forEach((d, k) => {
    d.classList.toggle("on", k === active);
    d.classList.toggle("done", k < active);
    if (k === active) d.setAttribute("aria-current", "location");
    else d.removeAttribute("aria-current");
  });
  // railway head: morphs into the station marker when it gets near, and out of it again when it leaves
  if (rail && train && !phone) {
    const w = rail.getBoundingClientRect().width;
    const usable = Math.max(1, w - 12);
    const x = 6 + usable * f;
    const k = Math.min(n - 1, Math.max(0, Math.round(p)));
    const dpx = Math.abs(p - k) * (usable / (n - 1));
    const m = 1 - smoothstep(0, 26, dpx);
    const xk = 6 + (usable * k) / (n - 1);
    const xh = x + (xk - x) * m * 0.55;
    train.style.setProperty("--tx", `${xh.toFixed(2)}px`);
    train.style.setProperty("--ts", `${(8 + 8 * m).toFixed(2)}px`);
    train.style.setProperty("--tc", `${(m * 100).toFixed(1)}%`);
    train.style.setProperty("--sc", lis[k]?.style.getPropertyValue("--c") || "var(--accent)");
  }
  // phone pager: previous / next section buttons
  const setPager = (a: HTMLAnchorElement | null, idx: number) => {
    if (!a) return;
    const off = idx < 0 || idx >= n;
    const target = secs[off ? active : idx] as HTMLElement;
    a.setAttribute("href", `#${target.id}`);
    a.setAttribute("aria-disabled", String(off));
    a.tabIndex = off ? -1 : 0;
  };
  setPager(prev, active - 1);
  setPager(next, active + 1);
  if (pcount)
    pcount.textContent = `${String(active + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
  // phone strip: segment j fills while section j is being read
  segs.forEach((sg, j) => {
    sg.style.setProperty("--p", Math.min(1, Math.max(0, p - j)).toFixed(3));
  });
  strip?.setAttribute(
    "aria-valuenow",
    String(Math.round((Math.min(n, p + 0.0001) / (n - 1)) * 100)),
  );
}
const onScroll = () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(update);
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
update();

// The name lives in the header only while the big name in the intro is off-screen (never in both places at once).
const heroName = document.getElementById("name");
if (heroName && "IntersectionObserver" in window) {
  new IntersectionObserver(
    ([e]) => document.documentElement.classList.toggle("hero-name", !!e?.isIntersecting),
    { rootMargin: "-70px 0px 0px 0px" },
  ).observe(heroName);
}
