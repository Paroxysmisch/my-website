// Usage: bun scripts/shot.ts <out.png> [width] [height] [scrollY] [url]
import puppeteer from "puppeteer-core";

const [out = "/tmp/shot.png", w = "1440", h = "900", y = "0", url = "http://localhost:4321/"] =
  process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("[console]", m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(url, { waitUntil: "networkidle0" });
await page.evaluate((yy) => window.scrollTo(0, yy), +y);
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: out });
await browser.close();
