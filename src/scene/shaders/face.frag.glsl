// Cube faces: A (left, YZ), B (top, XZ), C (front, XY). uv.x -> column/k, uv.y -> row/k.
uniform float uFace; // 0 = A, 1 = B, 2 = C
uniform float uCubeVis, uStreak, uTileReveal, uFocus, uSelLift, uDone, uCalm, uTileVis;
uniform vec2 uSel; // (col, row)
varying vec2 vUv;

void main() {
  if (dropped(uCubeVis)) discard;
  vec3 col;
  if (uFace < 1.5) {
    // A: u = k (along z), v = row (top = 0). B: u = col, v = k.
    float row = uFace < 0.5 ? (1.0 - vUv.y) : vUv.x; // tile index axis in [0,1]
    float sel = uFace < 0.5 ? uSel.y : uSel.x;
    float tileIdx = floor(row * 32.0);
    float inStrip = step(abs(tileIdx - sel), 0.5);
    vec2 cell = floor(vUv * vec2(96.0, 96.0));
    float v = hash21(cell + (uFace + 1.0) * 17.0);
    vec3 base = uFace < 0.5 ? COL_A : COL_B;
    vec2 g = fract(vUv * 96.0);
    float dotm = (1.0 - smoothstep(0.35, 0.5, length(g - 0.5)));
    float dim = mix(1.0, mix(0.22, 1.0, inStrip), uFocus);
    float mip = smoothstep(0.35, 0.9, max(fwidth(vUv.x), fwidth(vUv.y)) * 96.0);
    col = base * (0.18 + 0.55 * mix(v, 0.5, mip)) * mix(0.4 + 0.6 * dotm, 0.7, mip) * dim;
    // strip outline
    float edge = inStrip * uFocus * (1.0 - smoothstep(0.0, 0.012, abs(fract(row * 32.0) - 0.5) - 0.48 + 0.0));
    col += base * 0.0;
    col = mix(col, base, inStrip * uFocus * 0.12);
  } else {
    vec2 tc = vec2(vUv.x * 32.0, (1.0 - vUv.y) * 32.0);
    vec2 t = floor(tc);
    vec2 f = fract(tc);
    float ord = rasterOrder(t);
    float sweep = uTileReveal * 1100.0;
    float passed = step(ord, sweep);
    float flash = exp(-max(sweep - ord, 0.0) / 28.0) * passed;
    float isSel = step(abs(t.x - uSel.x), 0.5) * step(abs(t.y - uSel.y), 0.5);
    float acc = 0.14 + 0.12 * (0.5 + 0.5 * sin(uTime * 0.7 + hash21(t) * 6.28)) * uStreak;
    float h = acc * (1.0 - uFocus);
    h = max(h, flash * 0.9);
    float settled = passed * (1.0 - uFocus);
    h = max(h, settled * 0.28);
    // focus: everything dims except the selected tile
    float selLit = isSel * uFocus * (1.0 - uSelLift) ;
    h = max(h * (1.0 - uFocus * 0.85), selLit);
    // finale: remaining tiles complete in waves, then settle calm
    float wv = uDone * 1.3 - ord / 1024.0 * 1.0;
    float done = smoothstep(0.0, 0.18, wv);
    float fin = done * mix(0.9, 0.38, uCalm);
    float wavefront = exp(-abs(wv - 0.05) * 12.0) * step(0.0, wv) * step(wv, 0.5) * (1.0 - uCalm);
    h = max(h, max(fin, wavefront));
    if (isSel > 0.5 && uDone > 0.0) h = max(h, 0.9);
    vec3 base = vec3(0.09, 0.10, 0.12);
    col = mix(base, heat(0.1 + 0.9 * h) * (0.3 + 0.7 * smoothstep(0.1, 0.8, h)), smoothstep(0.02, 0.2, h));
    // tile grid lines
    float gl = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
    float fw = max(fwidth(tc.x), fwidth(tc.y));
    float lw = max(0.07, fw * 0.9);
    float gridOn = 1.0 - smoothstep(0.25, 0.6, fw);
    col = mix(col, mix(vec3(0.03, 0.035, 0.045), col, smoothstep(0.0, lw, gl)), gridOn);
    if (isSel > 0.5) col = mix(col, vec3(1.0, 0.95, 0.8), (1.0 - smoothstep(0.0, 0.12, gl)) * uFocus * 0.8);
  }
  gl_FragColor = vec4(col, 1.0);
}
