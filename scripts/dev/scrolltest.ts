import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: +(process.argv[2] ?? 1440), height: +(process.argv[3] ?? 900) });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:4322/", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"), { timeout: 30000 });
const ids = ["hero", "about", "research", "projects", "publications", "experience", "news", "contact"];
const tau = () => page.evaluate(() => ((window as any).__scene.S.tau as number).toFixed(2));
for (const id of ids) {
  const y = await page.evaluate((i) => Math.round((document.getElementById(i) as HTMLElement).getBoundingClientRect().top + scrollY), id);
  await page.evaluate((yy) => scrollTo(0, yy), y);
  const samples: string[] = [];
  for (let k = 0; k < 6; k++) { await new Promise((r) => setTimeout(r, 900)); samples.push(await tau()); }
  console.log(id.padEnd(13), samples.join(" "));
}
await browser.close();
