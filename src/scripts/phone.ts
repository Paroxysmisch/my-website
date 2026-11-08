// Phone only: scroll position drives the animation opacity and which chapter the 3D scene shows.
import { isPhone, phoneState } from "./phoneLayout";

const secs = [...document.querySelectorAll<HTMLElement>("section[data-chapter]")];
const root = document.documentElement;
let raf = 0;

export const sectionTops = () =>
  secs.map((el) => Math.round(el.getBoundingClientRect().top + scrollY));

function update() {
  if (!isPhone()) {
    root.style.removeProperty("--anim");
    delete root.dataset.phoneChapter;
    return;
  }
  const st = phoneState(sectionTops(), scrollY);
  root.style.setProperty("--anim", st.anim.toFixed(3));
  root.dataset.phoneChapter = String(st.chapter);
}
const onScroll = () => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(update);
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
update();
