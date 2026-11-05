// A (left), B (top) and C (bottom right) as dot-matrix slabs. uv.x -> column, uv.y -> row (top = 1).
// A: x = k, y = rows;  B: x = columns, y = k (top = 0);  C: x = columns, y = rows.
uniform float uMat; // 0 = A, 1 = B, 2 = C, 3 = C thumbnail (in HBM, inside the SM-pair view)
uniform float uMatVis, uABVis, uBand, uGrid, uSweep, uFocus, uSplit, uSlice, uSelLift, uDone, uCalm, uDetailVis, uStore;
uniform vec2 uSel; // (col, row)
varying vec2 vUv;

float trail(float d, float k) { return exp(-d * k); }

void main() {
  float vis = uMat < 1.5 ? uMatVis * uABVis : (uMat < 2.5 ? uMatVis : uDetailVis);
  if (dropped(vis)) discard;

  float fw = max(fwidth(vUv.x), fwidth(vUv.y));
  vec3 col;
  // axis in [0,1]: position along the rows/cols dimension this matrix is partitioned on
  float rowC = 1.0 - vUv.y;                // row coordinate (A, C)
  float colC = vUv.x;                      // column coordinate (B, C)
  float kC = uMat < 0.5 ? vUv.x : (1.0 - vUv.y); // k coordinate (A: x, B: y)

  // Band positions sweeping through A rows / B columns (the dot product being formed)
  float rp = fract(uTime * 0.045 + 0.1);
  float cp = fract(uTime * 0.071 + 0.55);

  if (uMat < 1.5) {
    bool isA = uMat < 0.5;
    float part = isA ? rowC : colC;      // partitioned coordinate
    float sel = isA ? uSel.y : uSel.x;
    float tileIdx = floor(part * 32.0);
    float inStrip = step(abs(tileIdx - sel), 0.5);
    // dots
    vec2 cell = floor(vUv * 72.0);
    float v = hash21(cell + (isA ? 3.0 : 11.0));
    vec2 g = fract(vUv * 72.0) - 0.5;
    float aa = 72.0 * fw;
    float dotm = 1.0 - smoothstep(0.30, 0.30 + max(0.12, aa), length(g));
    float mip = smoothstep(0.35, 0.8, aa);
    vec3 base = isA ? COL_A : COL_B;
    float lum = (0.10 + 0.34 * mix(v, 0.5, mip)) * mix(0.35 + 0.65 * dotm, 0.62, mip);
    // scanning band (hero)
    float bp = isA ? rp : cp;
    float d = abs(part - bp);
    d = min(d, 1.0 - d);
    float band = exp(-d * d * 9000.0) * uBand;
    lum += band * 0.9;
    // focus: only the selected tile's strip stays lit
    float strip = inStrip * uFocus;
    lum *= mix(1.0, mix(0.22, 1.0, inStrip), uFocus);
    lum += strip * 0.18;
    col = base * lum;
    col = mix(col, base, band * 0.5);
    // split into the two CTAs of the pair: A rows (top half / bottom half), B columns (left half / right half)
    float within = fract(part * 32.0);
    float half1 = step(0.5, within); // second half = rank 1
    vec3 peerTint = mix(base, COL_PEER, 0.65);
    col = mix(col, mix(base, peerTint, half1) * (0.55 + 0.45 * v) * 1.25, strip * uSplit * 0.85);
    float divider = (1.0 - smoothstep(0.0, 0.03 + fw * 32.0, abs(within - 0.5))) * strip * uSplit;
    col = mix(col, vec3(1.0), divider * 0.7);
    // k-blocks: 128 slices along K
    float ks = fract(kC * 128.0);
    float kline = (1.0 - smoothstep(0.0, 0.08 + fw * 128.0, min(ks, 1.0 - ks) * 1.0)) * strip * uSlice * (1.0 - smoothstep(0.2, 0.5, fw * 128.0));
    col = mix(col, vec3(1.0), kline * 0.55);
    // tile grid
    float gl = min(fract(part * 32.0), 1.0 - fract(part * 32.0));
    float gridOn = uGrid * (1.0 - smoothstep(0.25, 0.6, fw * 32.0));
    float line = 1.0 - smoothstep(0.0, max(0.05, fw * 32.0 * 0.9), gl);
    col = mix(col, vec3(0.9), line * gridOn * 0.30);
  } else {
    // C (and its thumbnail): output tiles
    vec2 tc = vec2(colC * 32.0, rowC * 32.0);
    vec2 t = floor(tc);
    vec2 f = fract(tc);
    float ord = rasterOrder(t);
    float isSel = step(abs(t.x - uSel.x), 0.5) * step(abs(t.y - uSel.y), 0.5);
    vec3 base = vec3(0.095, 0.10, 0.115);
    float fwt = max(fwidth(tc.x), fwidth(tc.y));
    if (uMat > 2.5) {
      // thumbnail: only the stored tile lights up (each CTA writes its 128 rows)
      float stored = isSel * smoothstep(0.55, 0.95, uStore);
      float half1 = step(0.5, f.y);
      col = base + 0.04 * hash21(t);
      col = mix(col, COL_OK * (0.85 + 0.15 * half1), stored);
      float gl = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      col = mix(vec3(0.05, 0.055, 0.065), col, smoothstep(0.0, max(0.06, fwt * 0.8), gl));
      col = mix(col, vec3(0.9, 0.92, 0.95), isSel * 0.0);
    } else {
      // scanning product: lit where a row band and a column band have both recently passed
      float dr = mod(rp - rowC, 1.0);
      float dc = mod(cp - colC, 1.0);
      float cross = exp(-(dr * dr + dc * dc) * 2600.0);
      float lines = (exp(-dr * 60.0) * exp(-dc * 2.0) + exp(-dc * 60.0) * exp(-dr * 2.0)) * 0.10;
      float prod = trail(dr, 16.0) * trail(dc, 16.0) * 0.7 + cross * 1.2 + lines;
      float h = min(prod, 1.0) * uBand * 0.9;
      // tiling sweep in swizzled raster order
      float sweep = uSweep * 1100.0;
      float passed = step(ord, sweep);
      float flash = exp(-max(sweep - ord, 0.0) / 30.0) * passed;
      h = max(h * (1.0 - uGrid * 0.6), flash * 0.95);
      h = max(h, passed * 0.09 * (1.0 - uFocus));
      // focus: the selected tile alone stays lit
      float selLit = isSel * uFocus * (1.0 - uSelLift);
      h = max(h * (1.0 - uFocus * 0.85), selLit);
      // finale: tiles complete in waves, then settle
      float wv = uDone * 1.3 - ord / 1024.0;
      float done = smoothstep(0.0, 0.18, wv);
      float fin = done * mix(0.85, 0.4, uCalm);
      float wavefront = exp(-abs(wv - 0.05) * 12.0) * step(0.0, wv) * step(wv, 0.5) * (1.0 - uCalm);
      vec3 doneCol = COL_OK * (0.55 + 0.35 * hash21(t));
      col = mix(base + 0.03 * hash21(t * 1.7), heat(0.12 + 0.88 * h), smoothstep(0.02, 0.2, h));
      col = mix(col, doneCol, max(fin, wavefront));
      if (isSel > 0.5 && uDone > 0.0) col = mix(col, COL_OK, 0.85);
      // split: the tile is two 128-row halves, one per CTA
      float half1 = step(0.5, f.y);
      col = mix(col, mix(heat(0.8), mix(heat(0.8), COL_PEER, 0.7), half1), isSel * uSplit * uFocus * (1.0 - uSelLift));
      float hdiv = (1.0 - smoothstep(0.0, 0.05 + fwt * 0.8, abs(f.y - 0.5))) * isSel * uSplit * uFocus * (1.0 - uSelLift);
      col = mix(col, vec3(1.0), hdiv * 0.8);
      // tile grid
      float gl = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      float gridOn = uGrid * (1.0 - smoothstep(0.25, 0.6, fwt));
      float lw = max(0.05, fwt * 0.9);
      col = mix(col, mix(vec3(0.04, 0.045, 0.055), col, smoothstep(0.0, lw, gl)), gridOn);
      if (isSel > 0.5) col = mix(col, vec3(1.0, 0.93, 0.78), (1.0 - smoothstep(0.0, lw * 1.6, gl)) * uFocus * 0.9);
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
