/** Phone layout constants shared by the scroll behaviours (mirrors the CSS in global.css). */
export const isPhone = () => innerWidth <= 1024;
export const headerH = 54;
export const animH = () => Math.min(460, Math.max(300, 0.48 * innerHeight));
/** viewport y where the settled section title sits (just below the animation) */
export const animBottom = () => headerH + animH();
/** scroll distance over which text takes over the screen from the settled position */
export const takeover = () => Math.min(0.62 * innerHeight, animBottom());
/** scroll distance (blank gap after a section's text) in which the next animation reveals itself */
export const gap = () => 0.55 * innerHeight;
export const LOW = 0.07; // animation opacity while text owns the screen

export const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export interface PhoneState {
  /** chapter the scene should show */
  chapter: number;
  /** animation opacity 0..1 */
  anim: number;
}

/** Windows-Phone-style: text takes over, then the next animation reveals before we land on its title. */
export function phoneState(tops: number[], y: number): PhoneState {
  let i = 0;
  tops.forEach((t, k) => {
    if (t <= y + 1) i = k;
  });
  const dPrev = y - (tops[i] as number);
  const next = tops[i + 1];
  let anim = 1 - (1 - LOW) * smooth(dPrev / takeover());
  let chapter = i;
  if (next !== undefined) {
    const toNext = next - y;
    if (toNext <= gap()) {
      chapter = i + 1;
      const reveal = LOW + (1 - LOW) * smooth(1 - toNext / gap());
      anim = Math.min(anim, reveal);
    }
  }
  return { chapter, anim };
}
