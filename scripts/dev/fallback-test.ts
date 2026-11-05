// Verifies the poster fallback paths: reduced motion, Save-Data, no WebGL2.
import puppeteer from "puppeteer-core";

const base = "http://localhost:4321/";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
async function run(name: string, setup: (p: import("puppeteer-core").Page) => Promise<void>) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await setup(page);
  await page.goto(base, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 2500));
  const r = await page.evaluate(() => ({
    classes: document.documentElement.className,
    canvas: !!document.getElementById("scene"),
    hud: !!document.getElementById("hud"),
    poster: (document.querySelector(".scene-poster") as HTMLImageElement | null)?.currentSrc
      .split("/")
      .pop(),
    posterLoaded: (document.querySelector(".scene-poster") as HTMLImageElement | null)
      ?.naturalWidth,
  }));
  console.log(name, JSON.stringify(r));
  await page.close();
}
await run("reduced-motion", (p) =>
  p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]),
);
await run("save-data", (p) =>
  p.evaluateOnNewDocument(() =>
    Object.defineProperty(navigator, "connection", { value: { saveData: true } }),
  ),
);
await run("no-webgl2", (p) =>
  p.evaluateOnNewDocument(() => {
    const o = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t: string, ...a: unknown[]) {
      return t === "webgl2" ? null : (o as Function).call(this, t, ...a);
    } as never;
  }),
);
await run("normal", async () => {});
await browser.close();
