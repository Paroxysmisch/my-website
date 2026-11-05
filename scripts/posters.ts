// Renders each chapter from the live scene and encodes static AVIF posters (spec M4).
// Usage: bun run build && (bun run preview &) && bun scripts/posters.ts
import { mkdirSync, statSync } from "node:fs";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const TAUS = [0.3, 1.95, 2.9, 3.9, 4.6, 5.6, 6.7, 7.95];
const SIZES = [
  { suffix: "", w: 1280, h: 800, el: false },
  { suffix: "-m", w: 390, h: 844, el: true }, // phone: only the stage strip
];
const base = process.env.BASE ?? "http://localhost:4322/";
mkdirSync("public/posters", { recursive: true });

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
for (const size of SIZES) {
  const page = await browser.newPage();
  await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: size.el ? 2 : 1 });
  for (const [i, tau] of TAUS.entries()) {
    await page.goto(`${base}?tau=${tau}`, { waitUntil: "load" });
    await page.addStyleTag({
      content:
        "main,header,.site-footer,#hud,#beat,.scene-label,.skip-link{visibility:hidden!important}",
    });
    await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"), {
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 800));
    const png = size.el
      ? await (await page.$("#stage"))?.screenshot({ type: "png" })
      : await page.screenshot({ type: "png" });
    const out = `public/posters/chapter-${i}${size.suffix}.avif`;
    await sharp(png as Buffer)
      .avif({ quality: 32, effort: 7, chromaSubsampling: "4:2:0" })
      .toFile(out);
    console.log(out, `${(statSync(out).size / 1024).toFixed(1)} KB`);
  }
  await page.close();
}
await browser.close();
