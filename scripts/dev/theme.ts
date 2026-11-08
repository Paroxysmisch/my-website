import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const scheme of ["dark", "light"]) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  await page.setViewport({ width: 1200, height: 800 });
  await page.goto("http://localhost:4322/", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
  const st = () => page.evaluate(() => `theme=${document.documentElement.dataset.theme} btn=${document.getElementById("theme-btn")!.dataset.mode} uLight=${(window as any).__scene.U.uLight.value}`);
  console.log(`system ${scheme}:`, await st());
  await page.click("#theme-btn"); await new Promise((r) => setTimeout(r, 300)); console.log("  click →", await st());
  // the system flips (e.g. sunset): the page follows, overriding the manual choice
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme === "dark" ? "light" : "dark" }]);
  await new Promise((r) => setTimeout(r, 400)); console.log("  system flips →", await st());
  await page.close();
}
await browser.close();
