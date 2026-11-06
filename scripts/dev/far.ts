import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:4322/", { waitUntil: "load" });
await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
const log = async (l: string) => console.log(l.padEnd(18), await page.evaluate(() => `tau=${(window as any).__scene.S.tau.toFixed(2)} fade=${document.getElementById("stage")!.classList.contains("fade")} op=${getComputedStyle(document.getElementById("scene")!).opacity}`));
await page.click('.nav-desktop a[href="#news"]');
for (const t of [100, 250, 400, 900, 2500]) { await new Promise((r) => setTimeout(r, t === 100 ? 100 : 150)); await log("→news t+" + t); }
await new Promise((r) => setTimeout(r, 3000));
await page.click('.nav-desktop a[href="#about"]');
for (const t of [100, 250, 400, 900]) { await new Promise((r) => setTimeout(r, 150)); await log("→about t+" + t); }
await browser.close();
