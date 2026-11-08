import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:4322/", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 1200));
const probe = () => page.evaluate(() => { const el = document.querySelector("#about h2") as HTMLElement; const r = el.getBoundingClientRect(); return `h2#about in=${el.classList.contains("in")} top=${Math.round(r.top)} ty=${el.style.getPropertyValue("--ty")}`; });
const hero = () => page.evaluate(() => `hero h1 in=${document.querySelector("#hero h1")!.classList.contains("in")}`);
console.log(await hero(), "|", await probe());
for (const [y, label] of [[1000, "scroll into about"], [3000, "scroll far past"], [1000, "back up"], [0, "top"]] as const) {
  await page.evaluate((yy) => scrollTo(0, yy), y); await new Promise((r) => setTimeout(r, 900));
  console.log(label.padEnd(18), await hero(), "|", await probe());
}
await page.mouse.move(36, 485); await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: "/tmp/rail.png", clip: { x: 0, y: 150, width: 420, height: 650 } });
await browser.close();
