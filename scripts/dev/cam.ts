import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:4322/?tau=0", { waitUntil: "load" });
await page.waitForFunction(() => (window as any).__scene);
for (const [a, b] of [[3.95, 4.3], [4.9, 5.3], [5.8, 6.15], [6.9, 7.45]]) {
  const rows: string[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = a + ((b - a) * i) / 6;
    await page.evaluate((tt) => (window as any).__scene.setTau(tt), t); await new Promise((r) => setTimeout(r, 120));
    rows.push(await page.evaluate((tt) => { const s = (window as any).__scene; const dir = new (s.camera.position.constructor)(); s.camera.getWorldDirection(dir); const p = s.camera.position; return `${tt.toFixed(2)}: pos(${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)})`; }, t));
  }
  console.log(rows.join("\n"), "\n");
}
await browser.close();
