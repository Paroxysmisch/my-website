import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const scheme of ["dark", "light"]) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto("http://localhost:4322/", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
  const st = () => page.evaluate(() => `resolved=${document.documentElement.dataset.resolved} forced=${document.documentElement.dataset.theme ?? "-"} bg=${getComputedStyle(document.body).backgroundColor || getComputedStyle(document.documentElement).backgroundColor} uLight=${(window as any).__scene.U.uLight.value} stored=${localStorage.getItem("theme")}`);
  console.log(`system ${scheme}:`, await st());
  for (let i = 0; i < 3; i++) { await page.click("#theme-btn"); await new Promise((r) => setTimeout(r, 300)); console.log("  click →", await st()); }
  await page.close();
}
await browser.close();
