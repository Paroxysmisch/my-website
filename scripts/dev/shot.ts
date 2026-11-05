// Usage: bun scripts/shot.ts <out.png> <width> <height> <tau | scroll:N> [base url]
import puppeteer from "puppeteer-core";

const [out = "/tmp/shot.png", w = "1440", h = "900", tau = "0", base = "http://localhost:4321/"] =
  process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage();
await page.setViewport({
  width: +w,
  height: +h,
  deviceScaleFactor: 1,
  isMobile: +w < 640,
  hasTouch: +w < 640,
});
const seen = new Set<string>();
page.on("console", (m) => {
  const t = m.text().slice(0, 1500);
  if (t.includes("useProgram") || seen.has(t)) return;
  seen.add(t);
  console.log("[console]", t);
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
const scroll = tau.startsWith("scroll:");
await page.goto(scroll ? base : `${base}?tau=${tau}`, { waitUntil: "load" });
if (scroll) await page.evaluate((y) => window.scrollTo(0, y), +tau.slice(7));
await page
  .waitForFunction(() => document.documentElement.classList.contains("scene-on"), {
    timeout: 20000,
  })
  .catch(() => console.log("scene never turned on"));
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: out });
await browser.close();
