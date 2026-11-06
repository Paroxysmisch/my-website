import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:4322/", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
console.log("tops", (await page.evaluate(() => [...document.querySelectorAll("section[data-chapter]")].map((e) => Math.round(e.getBoundingClientRect().top + scrollY)))).join(" "));
await page.mouse.move(700, 400);
for (const [label, steps, delta, gap] of [["slow", 6, 40, 120], ["fast x3", 3, 900, 16], ["fast x12 (far)", 12, 900, 16], ["fast up x4", 4, -900, 16]] as const) {
  const y0 = await page.evaluate(() => Math.round(scrollY));
  for (let i = 0; i < steps; i++) { await page.mouse.wheel({ deltaY: delta }); await new Promise((r) => setTimeout(r, gap)); }
  await new Promise((r) => setTimeout(r, 2500));
  console.log(label, y0, "->", await page.evaluate(() => Math.round(scrollY)));
}
await browser.close();
