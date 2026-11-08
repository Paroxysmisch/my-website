import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto("http://localhost:4322/?theme=dark", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
const tops = await page.evaluate(() => [...document.querySelectorAll("section[data-chapter]")].map((e) => Math.round(e.getBoundingClientRect().top + scrollY)));
const st = () => page.evaluate(() => { const r = document.documentElement; return `y=${Math.round(scrollY)} anim=${r.style.getPropertyValue("--anim")} ready=${r.style.getPropertyValue("--ready")} ch=${r.dataset.phoneChapter} tau=${(window as any).__scene.S.tau.toFixed(2)} op=${getComputedStyle(document.getElementById("stage")!).opacity}`; });
const t1 = tops[1] as number;
for (const y of [t1 - 900, t1 - 700, t1 - 520, t1 - 380, t1 - 200, t1 - 80]) {
  await page.evaluate((yy) => scrollTo(0, yy), y);
  for (const w of [150, 700]) { await new Promise((r) => setTimeout(r, w)); console.log(String(y).padStart(5), await st()); }
}
await page.evaluate((yy) => scrollTo(0, yy), tops[0]! + 360); await new Promise((r) => setTimeout(r, 900)); await page.screenshot({ path: "/tmp/pb.png" });
await browser.close();
