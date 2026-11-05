export type Tier = "high" | "medium" | "low" | "off";

export interface Quality {
  tier: Tier;
  dprCap: number;
}

const DPR: Record<Tier, number> = { high: 2, medium: 1.5, low: 1.1, off: 1 };

type NavigatorExtras = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/** Decide the starting tier from capabilities (spec §6.4). `off` means: use posters. */
export function detectTier(canvas: HTMLCanvasElement): { tier: Tier; gl: WebGL2RenderingContext | null } {
  const nav = navigator as NavigatorExtras;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData) {
    return { tier: "off", gl: null };
  }
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", { antialias: false, powerPreference: "high-performance" });
  } catch {
    gl = null;
  }
  if (!gl) return { tier: "off", gl: null };
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const cores = nav.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  const small = Math.min(innerWidth, innerHeight) < 640;
  let tier: Tier = "high";
  if (maxTex < 4096 || cores <= 2 || mem <= 2) tier = "low";
  else if (small || cores <= 4 || mem <= 4) tier = "medium";
  if (small && tier === "high") tier = "medium";
  return { tier, gl };
}

export const makeQuality = (tier: Tier): Quality => ({ tier, dprCap: DPR[tier] });

/** Rolling frame-time watchdog: steps down (never up) when over budget for ~2 s. */
export class Watchdog {
  private samples: number[] = [];
  private sum = 0;
  private last = 0;
  private over = 0;
  constructor(
    private budgetMs: number,
    private onDegrade: () => void,
  ) {}
  /** Call once per rendered frame. Gaps (idle periods) are ignored. */
  tick(now: number) {
    const dt = now - this.last;
    this.last = now;
    if (dt > 100 || dt <= 0) {
      this.samples = [];
      this.sum = 0;
      this.over = 0;
      return;
    }
    this.samples.push(dt);
    this.sum += dt;
    if (this.samples.length > 60) this.sum -= this.samples.shift() as number;
    if (this.samples.length >= 30 && this.sum / this.samples.length > this.budgetMs) {
      this.over += dt;
      if (this.over > 2000) {
        this.over = 0;
        this.samples = [];
        this.sum = 0;
        this.onDegrade();
      }
    } else {
      this.over = 0;
    }
  }
}

export function stepDown(tier: Tier): Tier {
  return tier === "high" ? "medium" : tier === "medium" ? "low" : "low";
}
