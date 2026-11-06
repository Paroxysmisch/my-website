import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [w, h, name] of [[1440, 900, "d"], [390, 844, "m"]] as const) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, hasTouch: w < 500, isMobile: w < 500 });
  await page.goto("http://localhost:4322/?tau=4.7", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
  await new Promise((r) => setTimeout(r, 800));
  await page.click("#info-btn");
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `/tmp/i_${name}.png` });
  await page.close();
}
await browser.close();
