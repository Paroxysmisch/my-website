import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [w, h] of [[1440, 900], [390, 844]] as const) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: w < 500, hasTouch: w < 500 });
  await page.goto("http://localhost:4322/?theme=dark", { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 900));
  const st = () => page.evaluate(() => `y=${Math.round(scrollY)} heroName=${document.documentElement.classList.contains("hero-name")} brandVisible=${getComputedStyle(document.querySelector(".brand")!).visibility}`);
  console.log(w, "top  ", await st());
  await page.evaluate(() => scrollTo(0, 700)); await new Promise((r) => setTimeout(r, 700)); console.log(w, "y700 ", await st());
  await page.evaluate(() => scrollTo(0, 0)); await new Promise((r) => setTimeout(r, 700)); console.log(w, "back ", await st());
  await page.close();
}
await browser.close();
