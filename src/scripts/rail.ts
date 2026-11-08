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

function update() {
  const vh = innerHeight;
  const phone = isPhone();
  const ref = phone ? animBottom() + 0.3 * (vh - animBottom()) : vh * 0.5;
  let active = 0;
  secs.forEach((s, i) => {
    if (s.getBoundingClientRect().top <= ref) active = i;
  });
  const max = document.documentElement.scrollHeight - vh;
  const atEnd = scrollY >= max - 4;
  if (atEnd) active = n - 1;
  const r = (secs[active] as HTMLElement).getBoundingClientRect();
  let frac = Math.min(1, Math.max(0, (ref - r.top) / Math.max(1, r.height)));
  if (atEnd) frac = 1;
  const f = Math.min(1, (active + frac) / (n - 1));
  document.documentElement.style.setProperty("--fill", f.toFixed(4));
  dots.forEach((d, i) => {
    d.classList.toggle("on", i === active);
    d.classList.toggle("done", i < active);
    if (i === active) d.setAttribute("aria-current", "location");
    else d.removeAttribute("aria-current");
  });
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
  const p = active + frac;
  segs.forEach((sg, j) => sg.style.setProperty("--p", Math.min(1, Math.max(0, p - j)).toFixed(3)));
  strip?.setAttribute("aria-valuenow", String(Math.round((Math.min(n, p) / n) * 100)));
}
const onScroll = () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(update);
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
update();
