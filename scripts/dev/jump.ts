import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:4322/", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
const st = () => page.evaluate(() => `y=${Math.round(scrollY)} tau=${(window as any).__scene.S.tau.toFixed(2)}`);
for (const id of ["publications", "news", "about", "contact", "hero", "projects"]) {
  await page.click(`.nav-desktop a[href="#${id}"]`);
  await new Promise((r) => setTimeout(r, 4500));
  const top = await page.evaluate((i) => Math.round(document.getElementById(i)!.getBoundingClientRect().top), id);
  console.log(id.padEnd(13), await st(), "sectionTop", top);
}
await browser.close();
