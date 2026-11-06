// A (left), B (top) and C (bottom right) as dot-matrix slabs. uv.x -> column, uv.y -> row (top = 1).
// A: x = k, y = rows;  B: x = columns, y = k (top = 0);  C: x = columns, y = rows.
//
// Hero: *tiled* matrix multiplication on a coarse 8×8 tile grid (each tile 8×8 elements):
//   C(ci,cj) += A(ci,k) · B(k,cj) for k = 0..7. The active A and B tiles light up, the C tile accumulates,
//   and inside the tiles one row of A, one column of B and the C element they produce are highlighted.
uniform float uMat; // 0 = A, 1 = B, 2 = C, 3 = C thumbnail (in HBM, inside the SM-pair view)
uniform float uMatVis, uABVis, uBand, uGrid, uRefine, uSweep, uFocus, uSplit, uSlice, uSelLift, uDone, uCalm, uDetailVis, uStore;
uniform vec2 uSel; // (col, row)
varying vec2 vUv;

float rnd8(float n, float salt) { return floor(fract(sin(n * 12.9898 + salt * 78.233) * 43758.5453) * 8.0); }

void main() {
  float vis = uMat < 1.5 ? uMatVis * uABVis : (uMat < 2.5 ? uMatVis : uDetailVis);
  if (dropped(vis)) discard;

  float fw = max(fwidth(vUv.x), fwidth(vUv.y));
  vec3 col;
  float rowC = 1.0 - vUv.y;
  float colC = vUv.x;
  float kC = uMat < 0.5 ? vUv.x : (1.0 - vUv.y);

  // ── hero tile-level state (shared by A, B and C) ──
  float hp = uTime * 0.5;
  float kk = floor(mod(hp, 8.0));
  float fr = fract(hp);
  float cyc = floor(hp / 8.0);
  float ci = rnd8(cyc, 1.0);
  float cj = rnd8(cyc, 2.0);
  float er = floor(fract(uTime * 0.55) * 8.0);  // element row inside the tile
  float ec = floor(fract(uTime * 4.4) * 8.0);   // element column inside the tile (fast)
  float hero = uBand;

  float rowE = floor(rowC * 64.0);
  float colE = floor(colC * 64.0);
  float rt = floor(rowE / 8.0), ct = floor(colE / 8.0);
  float lr = mod(rowE, 8.0), lc = mod(colE, 8.0);
  vec2 g = fract(vec2(colC, rowC) * 64.0) - 0.5;
  float aa = 64.0 * fw;
  float mip = smoothstep(0.35, 0.8, aa);

  if (uMat < 1.5) {
    bool isA = uMat < 0.5;
    float part = isA ? rowC : colC;
    float sel = isA ? uSel.y : uSel.x;
    float tileIdx = floor(part * 32.0);
    float inStrip = step(abs(tileIdx - sel), 0.5);
    float v = hash21(vec2(colE, rowE) + (isA ? 3.0 : 11.0));
    vec3 base = isA ? COL_A : COL_B;

    // hero highlighting
    float kt = isA ? ct : rt;          // k tile index
    float pt = isA ? rt : ct;          // row tile (A) / column tile (B)
    float want = isA ? ci : cj;
    float strip = step(abs(pt - want), 0.5);
    float act = strip * step(abs(kt - kk), 0.5);
    float used = strip * step(kt, kk - 0.5);
    float elem = isA ? step(abs(lr - er), 0.5) : step(abs(lc - ec), 0.5);   // A: one row, B: one column
    float elemNow = isA ? step(abs(lr - er), 0.5) * step(abs(lc - ec), 0.5) : step(abs(lc - ec), 0.5) * step(abs(lr - er), 0.5);

    float dr = 0.30 + 0.08 * hero * act + 0.10 * hero * act * elem;
    dr += 0.14 * hero * act * elemNow;
    float dotm = 1.0 - smoothstep(dr, dr + max(0.10, aa), length(g));
    float lum = (0.10 + 0.30 * mix(v, 0.5, mip)) * mix(0.35 + 0.65 * dotm, 0.62, mip);
    lum += hero * (strip * 0.14 + used * 0.12) * dotm;
    lum += hero * act * (0.38 + 0.9 * elem) * dotm;
    lum += hero * act * elemNow * 1.4 * dotm;
    // focus (ch1): only the selected tile's strip stays lit
    float stripSel = inStrip * uFocus;
    lum *= mix(1.0, mix(0.22, 1.0, inStrip), uFocus);
    lum += stripSel * 0.18;
    col = base * lum;
    col = mix(col, vec3(1.0), clamp(hero * act * elemNow * dotm * 0.8, 0.0, 1.0));
    // split into the two CTAs of the pair
    float within = fract(part * 32.0);
    float half1 = step(0.5, within);
    vec3 peerTint = mix(base, COL_PEER, 0.65);
    col = mix(col, mix(base, peerTint, half1) * (0.55 + 0.45 * v) * 1.25, stripSel * uSplit * 0.85);
    float divider = (1.0 - smoothstep(0.0, 0.03 + fw * 32.0, abs(within - 0.5))) * stripSel * uSplit;
    col = mix(col, vec3(1.0), divider * 0.7);
    // k-blocks: 128 slices along K
    float ks = fract(kC * 128.0);
    float kline = (1.0 - smoothstep(0.0, 0.08 + fw * 128.0, min(ks, 1.0 - ks))) * stripSel * uSlice * (1.0 - smoothstep(0.2, 0.5, fw * 128.0));
    col = mix(col, vec3(1.0), kline * 0.55);
    // tile grids: coarse (hero) and fine (32×32)
    float cl = min(fract(part * 8.0), 1.0 - fract(part * 8.0));
    float cgrid = (1.0 - uRefine) * (1.0 - smoothstep(0.25, 0.6, fw * 8.0)) * (1.0 - smoothstep(0.0, max(0.03, fw * 8.0 * 0.9), cl));
    col = mix(col, vec3(0.9), cgrid * 0.22);
    float gl = min(fract(part * 32.0), 1.0 - fract(part * 32.0));
    float gridOn = uGrid * (1.0 - smoothstep(0.25, 0.6, fw * 32.0));
    float line = 1.0 - smoothstep(0.0, max(0.05, fw * 32.0 * 0.9), gl);
    col = mix(col, vec3(0.9), line * gridOn * 0.30);
  } else {
    vec2 tc = vec2(colC * 32.0, rowC * 32.0);
    vec2 t = floor(tc);
    vec2 f = fract(tc);
    float ord = rasterOrder(t);
    float isSel = step(abs(t.x - uSel.x), 0.5) * step(abs(t.y - uSel.y), 0.5);
    vec3 base = vec3(0.095, 0.10, 0.115);
    float fwt = max(fwidth(tc.x), fwidth(tc.y));
    if (uMat > 2.5) {
      float stored = isSel * smoothstep(0.55, 0.95, uStore);
      float half1 = step(0.5, f.y);
      col = base + 0.04 * hash21(t);
      col = mix(col, COL_OK * (0.85 + 0.15 * half1), stored);
      float gl = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      col = mix(vec3(0.05, 0.055, 0.065), col, smoothstep(0.0, max(0.06, fwt * 0.8), gl));
    } else {
      // ── hero: C as a dot field, one tile accumulating ──
      float isTgt = step(abs(rt - ci), 0.5) * step(abs(ct - cj), 0.5);
      float acc = (kk + fr) / 8.0;
      float v = hash21(vec2(colE, rowE) + 5.0);
      float elemC = step(abs(lr - er), 0.5) * step(abs(lc - ec), 0.5);
      float rC = 0.30 + hero * isTgt * (0.06 + 0.16 * elemC);
      float dotm = 1.0 - smoothstep(rC, rC + max(0.10, aa), length(g));
      float h = hero * isTgt * (0.12 + 0.62 * acc) + hero * isTgt * elemC * 0.9;
      // tiles finished in previous cycles stay lit and fade
      float prev = 0.0;
      for (int m = 1; m <= 3; m++) {
        float cm = cyc - float(m);
        float pri = rnd8(cm, 1.0), prj = rnd8(cm, 2.0);
        prev += step(abs(rt - pri), 0.5) * step(abs(ct - prj), 0.5) * (0.5 / float(m));
      }
      vec3 heroCol = base + 0.03 * v;
      heroCol = mix(heroCol, heat(0.10 + 0.86 * clamp(h, 0.0, 1.0)), smoothstep(0.03, 0.2, h) * dotm);
      heroCol = mix(heroCol, COL_OK * 0.8, prev * hero * dotm * (1.0 - isTgt));
      heroCol = mix(heroCol, vec3(1.0, 0.95, 0.8), hero * isTgt * elemC * dotm);
      heroCol = mix(heroCol * 0.8, heroCol, 0.55 + 0.45 * dotm);
      // coarse tile boundaries, active one outlined
      float cx = min(fract(colC * 8.0), 1.0 - fract(colC * 8.0));
      float cy = min(fract(rowC * 8.0), 1.0 - fract(rowC * 8.0));
      float cb = 1.0 - smoothstep(0.0, max(0.025, fw * 8.0 * 0.9), min(cx, cy));
      heroCol = mix(heroCol, vec3(0.8), cb * 0.20 * (1.0 - uRefine));
      heroCol = mix(heroCol, vec3(1.0, 0.92, 0.72), cb * isTgt * hero * 0.9);
      heroCol = mix(base, heroCol, mix(1.0, 0.0, 0.0));

      // ── fine tiling (32×32) ──
      float sweep = uSweep * 1100.0;
      float passed = step(ord, sweep);
      float flash = exp(-max(sweep - ord, 0.0) / 30.0) * passed;
      float hf = flash * 0.95;
      hf = max(hf, passed * 0.09 * (1.0 - uFocus));
      float selLit = isSel * uFocus * (1.0 - uSelLift);
      hf = max(hf * (1.0 - uFocus * 0.85), selLit);
      float wv = uDone * 1.3 - ord / 1024.0;
      float done = smoothstep(0.0, 0.18, wv);
      float fin = done * mix(0.85, 0.4, uCalm);
      float wavefront = exp(-abs(wv - 0.05) * 12.0) * step(0.0, wv) * step(wv, 0.5) * (1.0 - uCalm);
      vec3 doneCol = COL_OK * (0.55 + 0.35 * hash21(t));
      vec3 fine = mix(base + 0.03 * hash21(t * 1.7), heat(0.12 + 0.88 * hf), smoothstep(0.02, 0.2, hf));
      fine = mix(fine, doneCol, max(fin, wavefront));
      if (isSel > 0.5 && uDone > 0.0) fine = mix(fine, COL_OK, 0.85);
      float half1 = step(0.5, f.y);
      float spl = isSel * uSplit * uFocus * (1.0 - uSelLift);
      fine = mix(fine, mix(heat(0.8), mix(heat(0.8), COL_PEER, 0.7), half1), spl);
      float hdiv = (1.0 - smoothstep(0.0, 0.05 + fwt * 0.8, abs(f.y - 0.5))) * spl;
      fine = mix(fine, vec3(1.0), hdiv * 0.8);
      float gl = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      float gridOn = uGrid * (1.0 - smoothstep(0.25, 0.6, fwt));
      float lw = max(0.05, fwt * 0.9);
      fine = mix(fine, mix(vec3(0.04, 0.045, 0.055), fine, smoothstep(0.0, lw, gl)), gridOn);
      if (isSel > 0.5) fine = mix(fine, vec3(1.0, 0.93, 0.78), (1.0 - smoothstep(0.0, lw * 1.6, gl)) * uFocus * 0.9);
      col = mix(heroCol, fine, smoothstep(0.0, 1.0, uRefine));
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
