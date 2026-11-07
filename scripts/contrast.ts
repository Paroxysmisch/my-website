// WCAG 2.x contrast check for the colour pairings the site uses (src/styles/tokens.css).
// Text must reach AA (4.5:1); graphics 3:1. Body text is deliberately softer than pure white-on-black.
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles/tokens.css", "utf8");
const grab = (block: string) => {
  const t: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g))
    t[m[1] as string] = m[2] as string;
  return t;
};
const darkTok = grab(css.slice(0, css.indexOf("@media")));
const lightBlock = css.slice(css.indexOf(':root[data-theme="light"]'));
const lightTok = grab(lightBlock.slice(0, lightBlock.indexOf("}")));

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(Number.parseInt(hex.slice(i, i + 2), 16))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, minimum, use]
const pairs: [string, string, number, string][] = [
  ["text", "bg", 7, "body text"],
  ["muted", "bg", 4.5, "secondary text, captions, meta"],
  ["muted", "bg-2", 4.5, "secondary text on raised surfaces"],
  ["accent", "bg", 4.5, "kickers, hover state, scene labels"],
  ["a", "bg", 4.5, "A scene labels"],
  ["b", "bg", 4.5, "B scene labels"],
  ["ok", "bg", 4.5, "epilogue scene labels"],
  ["faint", "bg", 3, "bars / punctuation (graphics only)"],
  ["line", "bg", 1.2, "hairline separators (decorative)"],
];
let fail = 0;
for (const [name, tok] of [
  ["dark", { ...darkTok }],
  ["light", { ...darkTok, ...lightTok }],
] as const) {
  console.log(`— ${name} theme`);
  for (const [f, b, min, use] of pairs) {
    const r = ratio(tok[f] as string, tok[b] as string);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  --${f} on --${b}  ${use}`,
    );
  }
}
process.exit(fail ? 1 : 0);
