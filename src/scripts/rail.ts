// Section rail + progress: highlights the active section, fills the track with overall progress, and drives the
// phone progress strip. The same "active section" rule as the 3D scene is used.
const secs = [...document.querySelectorAll<HTMLElement>("section[data-chapter]")];
const rail = document.getElementById("rail");
const dots = [...document.querySelectorAll<HTMLElement>("#rail a")];
const strip = document.getElementById("progress-strip");
const count = document.getElementById("rail-count");
const n = secs.length;
let raf = 0;

function update() {
  const vh = innerHeight;
  const phone = innerWidth <= 1024;
  const animBottom = 54 + Math.min(460, Math.max(300, 0.48 * vh));
  const ref = phone ? animBottom + 0.3 * (vh - animBottom) : vh * 0.5;
  let active = 0;
  secs.forEach((s, i) => {
    if (s.getBoundingClientRect().top <= ref) active = i;
  });
  const max = document.documentElement.scrollHeight - vh;
  if (scrollY >= max - 4) active = n - 1;
  const r = (secs[active] as HTMLElement).getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (ref - r.top) / Math.max(1, r.height)));
  const fill = (active + frac) / (n - 1);
  const f = Math.min(1, Math.max(0, fill));
  document.documentElement.style.setProperty("--fill", f.toFixed(4));
  dots.forEach((d, i) => {
    d.classList.toggle("on", i === active);
    d.classList.toggle("done", i < active);
    if (i === active) d.setAttribute("aria-current", "location");
    else d.removeAttribute("aria-current");
  });
  if (count)
    count.textContent = `${String(active + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;
  strip?.setAttribute("aria-valuenow", String(Math.round(f * 100)));
}
const onScroll = () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(update);
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
update();
void rail;

export {};
