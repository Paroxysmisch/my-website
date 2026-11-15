import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:4322/?theme=dark", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
const tops = await page.evaluate(() => [...document.querySelectorAll("section[data-chapter]")].map((e) => Math.round(e.getBoundingClientRect().top + scrollY)));
const t = tops[3] as number, t4 = tops[4] as number;
let i = 0;
for (const y of [t, t + 150, t + 400, Math.round((t + t4) / 2), t4 - 250, t4 - 60, t4]) {
  await page.evaluate((yy) => { document.documentElement.style.scrollBehavior = "auto"; scrollTo(0, yy); }, y);
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `/tmp/r${i++}.png`, clip: { x: 250, y, width: 1000, height: 90 } });
}
await browser.close();
