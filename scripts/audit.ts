// Computed-style audit on the built site: min font size, headings, overflow, touch targets, aria.
import puppeteer from "puppeteer-core";

const base = process.env.BASE ?? "http://localhost:4322/";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
let fail = 0;
for (const [w, h] of [
  [320, 640],
  [390, 800],
  [768, 1024],
  [1440, 900],
] as const) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto(base, { waitUntil: "load" });
  await page
    .waitForFunction(() => document.documentElement.classList.contains("scene-on"), {
      timeout: 30000,
    })
    .catch(() => {});
  const r = await page.evaluate(() => {
    const out: Record<string, unknown> = {};
    const small: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement as HTMLElement;
      if (["SCRIPT", "STYLE"].includes(el.tagName)) continue;
      const fs = Number.parseFloat(getComputedStyle(el).fontSize);
      if (fs < 14)
        small.push(`${el.tagName}.${el.className} ${fs}px "${n.textContent.trim().slice(0, 30)}"`);
    }
    out.small = small;
    out.h1 = document.querySelectorAll("h1").length;
    const lv = [...document.querySelectorAll("h1,h2,h3")].map((e) => Number(e.tagName[1]));
    out.headingJumps = lv.filter((l, i) => i > 0 && l - (lv[i - 1] as number) > 1).length;
    out.overflowX = document.documentElement.scrollWidth - innerWidth;
    const tiny: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      ".btn,.links-row a,.menu-mobile summary,.menu-mobile nav a",
    )) {
      const b = el.getBoundingClientRect();
      if (
        b.width &&
        (b.width < 44 || b.height < 44) &&
        getComputedStyle(el).visibility !== "hidden" &&
        !el.hidden
      )
        tiny.push(`${el.textContent?.trim()} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
    out.smallTargets = tiny;
    out.hiddenAria = ["#stage"].map(
      (s) =>
        document.querySelector(s)?.getAttribute("aria-hidden") ??
        (document.querySelector(s) ? "MISSING" : "absent"),
    );
    out.landmarks = ["header", "nav", "main", "footer"].map(
      (s) => document.querySelectorAll(s).length,
    );
    out.imgsNoAlt = [...document.querySelectorAll("img:not([alt])")].length;
    return out;
  });
  const bad =
    (r.small as string[]).length ||
    r.h1 !== 1 ||
    r.headingJumps ||
    (r.overflowX as number) > 0 ||
    (r.smallTargets as string[]).length;
  if (bad) fail++;
  console.log(`${bad ? "FAIL" : "PASS"} ${w}px`, JSON.stringify(r));
  await page.close();
}
await browser.close();
process.exit(fail ? 1 : 0);
