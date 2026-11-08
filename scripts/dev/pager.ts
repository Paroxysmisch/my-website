import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto("http://localhost:4322/?theme=dark", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
const st = () => page.evaluate(() => `y=${Math.round(scrollY)} prev=${document.getElementById("pager-prev")!.getAttribute("href")}(${document.getElementById("pager-prev")!.getAttribute("aria-disabled")}) next=${document.getElementById("pager-next")!.getAttribute("href")} count=${document.getElementById("pager-count")!.textContent}`);
console.log("start", await st());
for (const [sel, name] of [["#pager-next", "next"], ["#pager-next", "next"], ["#pager-next", "next"], ["#pager-prev", "prev"]] as const) {
  await page.tap(sel); await new Promise((r) => setTimeout(r, 1800)); console.log(name.padEnd(5), await st());
}
await page.screenshot({ path: "/tmp/pager.png" });
await browser.close();
