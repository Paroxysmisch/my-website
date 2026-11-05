import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: +(process.argv[2] ?? 1440), height: +(process.argv[3] ?? 900) });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:4322/", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"), {
  timeout: 30000,
});
const ids = [
  "hero",
  "about",
  "research",
  "projects",
  "publications",
  "experience",
  "news",
  "contact",
];
for (const id of ids) {
  const y = await page.evaluate(
    (i) =>
      Math.round(
        (document.getElementById(i) as HTMLElement).getBoundingClientRect().top +
          scrollY -
          0.3 * innerHeight,
      ),
    id,
  );
  await page.evaluate((yy) => scrollTo(0, yy), y);
  await new Promise((r) => setTimeout(r, 1800));
  const tau = await page.evaluate(() => ((window as any).__scene.S.tau as number).toFixed(2));
  console.log(id.padEnd(13), "scrollY", String(y).padStart(6), "tau", tau);
}
await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await new Promise((r) => setTimeout(r, 1800));
console.log(
  "bottom tau",
  await page.evaluate(() => (window as any).__scene.S.tau.toFixed(2)),
  "scrollH",
  await page.evaluate(() => document.documentElement.scrollHeight),
);
await browser.close();
