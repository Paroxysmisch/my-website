import { hud, kBlocks, totalTiles } from "./kernel";
import { U } from "./state";

/** Fixed readout (aria-hidden). All numbers come from kernel.ts. */
export function createHud(el: HTMLElement) {
  let last = "";
  return (chapter: number) => {
    let text = "";
    const t = U.uT.value;
    switch (chapter) {
      case 0:
        text = hud.gemm;
        break;
      case 1:
        text = hud.tile;
        break;
      case 2:
        text = hud.map;
        break;
      case 3:
        text = hud.sm;
        break;
      case 4:
        text = hud.kloop(Math.min(kBlocks, Math.floor(t) + 1));
        break;
      case 5:
        text = hud.mma(Math.min(kBlocks, Math.max(0, Math.floor(U.uAcc.value * kBlocks))));
        break;
      case 6:
        text = hud.epilogue;
        break;
      default: {
        const n = Math.min(
          totalTiles,
          Math.max(1, Math.floor((1.3 * U.uDone.value - 0.09) * totalTiles)),
        );
        text = hud.done(n);
      }
    }
    if (text !== last) {
      el.textContent = text;
      last = text;
    }
  };
}
