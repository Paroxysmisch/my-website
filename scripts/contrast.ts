// WCAG 2.x contrast check for every colour pairing the design uses (spec §7.4).
import { readFileSync } from "node:fs";

const css = readFileSync("src/styles/tokens.css", "utf8");
const tok: Record<string, string> = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g))
  tok[m[1] as string] = m[2] as string;

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
  ["text", "bg", 7, "body text on page"],
  ["text", "panel", 7, "body text in panels"],
  ["text-muted", "bg", 7, "secondary text"],
  ["text-muted", "panel", 7, "secondary text in panels"],
  ["accent", "bg", 4.5, "links, stage captions"],
  ["accent", "panel", 4.5, "links in panels"],
  ["a", "panel", 4.5, "A label text"],
  ["b", "panel", 4.5, "B label text"],
  ["heat-2", "panel", 4.5, "stats readout numbers"],
  ["heat-1", "panel", 4.5, "ramp used as text"],
  ["heat-3", "panel", 4.5, "ramp used as text"],
  ["border", "bg", 3, "panel borders vs page"],
  ["border", "panel", 3, "borders vs panel"],
  ["heat-0", "panel", 3, "ramp start (graphics)"],
  ["a", "bg", 3, "matrix A graphics"],
  ["b", "bg", 3, "matrix B graphics"],
  ["text-muted", "bg", 4.5, "chart baseline bars"],
];
let fail = 0;
for (const [f, b, min, use] of pairs) {
  const r = ratio(tok[f] as string, tok[b] as string);
  const ok = r >= min;
  if (!ok) fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  --${f} on --${b}  ${use}`,
  );
}
// thermal ramp must be monotonic in luminance
const ramp = ["heat-0", "heat-1", "heat-2", "heat-3"].map((k) => lum(tok[k] as string));
const mono = ramp.every((v, i) => i === 0 || v > (ramp[i - 1] as number));
console.log(`${mono ? "PASS" : "FAIL"}  thermal ramp monotonic in luminance`);
if (!mono) fail++;
process.exit(fail ? 1 : 0);
