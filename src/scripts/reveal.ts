// Text pops + fades in whenever it enters the screen and pops + fades out whenever it leaves (every time,
// both directions). Exits remember which side they left through, so text re-enters from where it went.
const items = [...document.querySelectorAll<HTMLElement>(".rv")];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reduce || !("IntersectionObserver" in window)) {
  for (const el of items) el.classList.add("in");
} else {
  const phone = matchMedia("(max-width: 1024px)");
  let io: IntersectionObserver | undefined;
  const onEntries = (entries: IntersectionObserverEntry[]) => {
    let n = 0;
    for (const e of entries) {
      const el = e.target as HTMLElement;
      if (e.isIntersecting) {
        el.style.transitionDelay = `${Math.min(n++, 7) * 45}ms`;
        el.classList.add("in");
      } else {
        const above = e.rootBounds ? e.boundingClientRect.top < e.rootBounds.top : false;
        el.style.setProperty("--ty", above ? "-30px" : "34px");
        el.style.transitionDelay = "0ms";
        el.classList.remove("in");
      }
    }
  };
  const make = () => {
    io?.disconnect();
    // phones: text takes over the whole screen (under the header), so it only leaves at the very top
    const top = phone.matches ? "-64px" : "-4%";
    io = new IntersectionObserver(onEntries, { rootMargin: `${top} 0px -7% 0px` });
    for (const el of items) io.observe(el);
  };
  make();
  phone.addEventListener("change", make);
}

export {};
