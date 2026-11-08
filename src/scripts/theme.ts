// Theme: light or dark. The page starts with the system preference (time of day as a fallback) and
// follows it live; the button flips it until the next automatic change (system switch / sunrise / sunset).
const root = document.documentElement;
const btn = document.getElementById("theme-btn");
const auto = (): "light" | "dark" => {
  if (matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  if (matchMedia("(prefers-color-scheme: light)").matches) return "light";
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? "light" : "dark";
};
const current = () => (root.dataset.theme === "light" ? "light" : "dark");
const apply = (t: "light" | "dark") => {
  root.dataset.theme = t;
  root.dataset.resolved = t;
  if (btn) {
    btn.dataset.mode = t;
    const next = t === "light" ? "dark" : "light";
    btn.setAttribute("aria-label", `Switch to ${next} theme`);
    btn.title = `${t} theme (click for ${next})`;
  }
  dispatchEvent(new Event("themechange"));
};
let lastAuto = auto();
const follow = () => {
  const a = auto();
  if (a !== lastAuto) {
    lastAuto = a;
    apply(a);
  }
};
btn?.addEventListener("click", () => apply(current() === "light" ? "dark" : "light"));
for (const q of ["(prefers-color-scheme: dark)", "(prefers-color-scheme: light)"]) {
  matchMedia(q).addEventListener("change", follow);
}
setInterval(follow, 30_000); // crossing sunrise/sunset while the page is open
document.addEventListener("visibilitychange", follow);
apply(current());

export {};
