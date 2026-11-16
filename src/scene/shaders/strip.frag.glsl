// A or B operand strip in HBM: K = 8192 sliced into 128 k-blocks of 64 (blocks are the unit TMA moves).
uniform float uOperand; // 0 = A, 1 = B
uniform float uDetailVis, uSliceD, uT, uFocusMask, uFocusAmt;
varying vec2 vUv;
void main() {
  if (dropped(uDetailVis)) discard;
  float kb = vUv.x * 128.0;
  float b = floor(kb);
  float f = fract(kb);
  float gap = uSliceD * 0.26;
  // analytic anti-aliasing: block coverage from the pixel footprint; once blocks are only ~1-2 px wide the
  // pattern is replaced by its average so it can't alias / moire
  float fw = max(fwidth(kb), 1e-4);
  float edge = min(f - gap, (1.0 - gap) - f);
  float inBlock = clamp(edge / fw + 0.5, 0.0, 1.0);
  inBlock = mix(inBlock, 1.0 - 2.0 * gap, smoothstep(0.3, 0.85, fw));
  float loadedUpTo = floor(uT);
  float done = step(b + 1.0, uT);
  float cur = step(b, uT) * (1.0 - done);
  vec3 base = uOperand < 0.5 ? COL_A : COL_B;
  vec3 col = base * mix(0.85, 0.30, done);
  col = mix(col, vec3(1.0), cur * 0.55);
  float yEdge = smoothstep(0.0, 0.14, vUv.y) * (1.0 - smoothstep(0.86, 1.0, vUv.y));
  col *= mix(0.6, 1.0, yEdge);
  col = mix(vec3(0.05, 0.055, 0.065), col, inBlock);
  float bright = (128 & int(uFocusMask)) != 0 ? 1.0 : 0.0;
  col = mix(BG * 1.15, col, mix(1.0, mix(0.22, 1.0, bright), uFocusAmt));
  gl_FragColor = vec4(themed(col), 1.0);
}
