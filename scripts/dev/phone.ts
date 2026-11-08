import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto("http://localhost:4322/?theme=dark", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
const tops = await page.evaluate(() => [...document.querySelectorAll("section[data-chapter]")].map((e) => Math.round(e.getBoundingClientRect().top + scrollY)));
console.log("tops", tops.join(" "));
const st = () => page.evaluate(() => `y=${Math.round(scrollY)} anim=${document.documentElement.style.getPropertyValue("--anim")} ch=${document.documentElement.dataset.phoneChapter} tau=${(window as any).__scene.S.tau.toFixed(2)}`);
const t1 = tops[1] as number;
for (const y of [0, 120, 300, 520, t1 - 700, t1 - 450, t1 - 300, t1 - 150, t1]) {
  await page.evaluate((yy) => scrollTo(0, yy), y); await new Promise((r) => setTimeout(r, 700));
  console.log(String(y).padStart(5), await st());
}
await page.screenshot({ path: "/tmp/ph1.png" });
await page.evaluate((yy) => scrollTo(0, yy), t1 + 330); await new Promise((r) => setTimeout(r, 900)); await page.screenshot({ path: "/tmp/ph2.png" });
await page.evaluate((yy) => scrollTo(0, yy), t1 - 250); await new Promise((r) => setTimeout(r, 1500)); await page.screenshot({ path: "/tmp/ph3.png" });
await browser.close();
