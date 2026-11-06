import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
for (const [tau, x, y, name] of [[0.3, 1180, 600, "c"], [2.6, 1250, 560, "die"], [3.6, 1120, 600, "sm"], [3.6, 905, 575, "sm2"], [4.6, 760, 330, "slot"]] as const) {
  await page.goto(`http://localhost:4322/?tau=${tau}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.classList.contains("scene-on"));
  await new Promise((r) => setTimeout(r, 800));
  await page.mouse.move(x - 5, y - 5);
  await page.mouse.move(x, y, { steps: 3 });
  await new Promise((r) => setTimeout(r, 400));
  console.log(name, await page.evaluate(() => document.getElementById("tip")?.innerText.replace(/\n/g, " | ")));
  await page.screenshot({ path: `/tmp/h_${name}.png` });
}
await browser.close();
