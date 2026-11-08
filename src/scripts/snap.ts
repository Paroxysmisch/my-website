import { gap, isPhone, takeover } from "./phoneLayout";

// Section snapping. Fast flicks fly to the nearest section top; slow scrolling stays free but is magnetic
// near a section top. Nav jumps glide too, and the 3D scene is told the destination chapter (window.__jump).
const secs = [...document.querySelectorAll<HTMLElement>("section[data-chapter]")];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const win = window as unknown as { __jump?: number };
let startY = -1;
let lastY = scrollY;
let lastT = performance.now();
let peak = 0;
let idle = 0;
let anim = 0;
let animating = false;
const tops = () =>
  secs.map((el) => Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY)));
const sync = () => dispatchEvent(new Event("scroll"));
const endJump = () => {
  if (win.__jump !== undefined) {
    win.__jump = undefined;
    sync();
  }
};
const cancel = () => {
  if (!animating) return;
  cancelAnimationFrame(anim);
  animating = false;
  startY = -1;
  lastY = scrollY;
  endJump();
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 4;
function glide(to: number, chapter: number, snap: boolean) {
  win.__jump = chapter;
  sync();
  const from = scrollY;
  const dist = Math.abs(to - from);
  const dur = snap
    ? Math.min(620, Math.max(300, dist * 0.45))
    : Math.min(950, Math.max(520, dist * 0.45));
  const ease = snap ? easeOut : easeInOut;
  const t0 = performance.now();
  animating = true;
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    scrollTo(0, from + (to - from) * ease(p));
    if (p < 1) anim = requestAnimationFrame(step);
    else {
      animating = false;
      startY = -1;
      lastY = scrollY;
      endJump();
    }
  };
  anim = requestAnimationFrame(step);
}
for (const ev of ["wheel", "touchstart", "mousedown", "keydown"])
  addEventListener(ev, cancel, { passive: true });

// nav / anchor jumps
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
  if (!a) return;
  const id = a.getAttribute("href")?.slice(1);
  const i = secs.findIndex((el) => el.id === id);
  if (i < 0) return;
  e.preventDefault();
  a.closest("details")?.removeAttribute("open");
  cancel();
  const max = document.documentElement.scrollHeight - innerHeight;
  const to = Math.min(tops()[i] as number, max);
  history.replaceState(null, "", `#${id}`);
  if (reduce) scrollTo(0, to);
  else glide(to, i, false);
});

/**
 * Phone (Windows-Phone-style sticky sections): once settled on a section title you scroll freely through its text,
 * which takes over the screen. Snapping only happens between sections: when the next animation has (partly) revealed
 * itself we land on the next title, and when scrolling back up we land on a title once its animation shows again.
 */
function phoneSnap(dy: number, from: number) {
  const y = scrollY;
  const ts = tops();
  const max = document.documentElement.scrollHeight - innerHeight;
  const g = gap();
  const t = takeover();
  for (let k = 0; k < ts.length; k++) {
    const tk = ts[k] as number;
    const d = y - tk;
    if (Math.abs(d) < 20) return; // already settled
    let go = false;
    if (d < 0 && -d <= g) {
      // in the blank gap before this title: heading down, land on it; heading up, only if almost there
      go = dy >= 0 || -d < 0.35 * g;
    } else if (d > 0 && d <= t) {
      // just below the title: scrolling up from further down lands on it; scrolling down from it is free reading
      go = dy < 0 && from > tk + t * 0.5;
    }
    if (go) {
      const target = Math.min(tk, max);
      if (Math.abs(target - y) > 8) glide(target, k, true);
      return;
    }
  }
}

if (!reduce) {
  addEventListener(
    "scroll",
    () => {
      if (animating) return;
      const now = performance.now();
      if (startY < 0) {
        startY = lastY;
        peak = 0;
      }
      const dt = Math.max(1, now - lastT);
      peak = Math.max(peak, Math.abs(scrollY - lastY) / dt);
      lastY = scrollY;
      lastT = now;
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        const dy = scrollY - startY;
        const from = startY;
        startY = -1;
        if (isPhone()) {
          phoneSnap(dy, from);
          return;
        }
        const ts = tops();
        const max = document.documentElement.scrollHeight - innerHeight;
        let idx = 0;
        ts.forEach((y, k) => {
          if (Math.abs(y - scrollY) < Math.abs((ts[idx] as number) - scrollY)) idx = k;
        });
        const target = Math.min(ts[idx] as number, max);
        const d = Math.abs(target - scrollY);
        const fast = Math.abs(dy) > innerHeight * 0.2 && peak > 1.0; // a flick
        const magnet = d <= innerHeight * 0.24; // resting near a section top
        if (d < 8 || (!fast && !magnet) || (fast && d > innerHeight * 0.95)) return;
        glide(target, idx, true);
      }, 100);
    },
    { passive: true },
  );
}
