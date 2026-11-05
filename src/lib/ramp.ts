/** Thermal ramp (spec §5.2 / §7.4), monotonic in luminance. */
export const RAMP = ["#a8502f", "#f08a3c", "#ffc46b", "#fff1c9"] as const;

const hex = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));

export function ramp(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex(RAMP[i] as string);
  const b = hex(RAMP[i + 1] as string);
  return `#${a
    .map((v, k) =>
      Math.round(v + ((b[k] as number) - v) * f)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
