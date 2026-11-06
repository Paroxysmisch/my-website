// One Tensor Memory slice: 32 lanes x 512 columns (a quarter of an SM's 128 x 512), one per sub-partition.
uniform float uDetailVis, uAcc, uDrain, uShrink, uNext, uFocusMask, uFocusAmt;
uniform float uQuad; // sub-partition index 0..3
varying vec2 vUv;

void main() {
  if (dropped(uDetailVis)) discard;
  vec2 cells = vec2(512.0, 32.0);
  vec2 cc = vUv * cells;
  vec2 id = floor(cc);
  vec2 f = fract(cc) - 0.5;
  float px = max(fwidth(cc.x), fwidth(cc.y));
  float hf = step(256.0, id.x); // 0: accumulator buffer of this tile, 1: buffer for the next tile
  float r = hash21(id + uQuad * 17.0);
  float acc = uAcc;
  float a = acc * (0.55 + 0.45 * r);
  float nx = clamp(uNext * (0.5 + 0.5 * r), 0.0, 0.6);
  float v = hf < 0.5 ? a : nx;
  // epilogue: tcgen05.ld sweeps the accumulator columns; drained cells shrink (BF16) and go quiet
  float front = uDrain * 256.0;
  float drained = hf < 0.5 ? step(id.x, front) : 0.0;
  float rad = 0.42 * mix(1.0, 0.55, uShrink * drained);
  v = mix(v, v * 0.10, drained * smoothstep(0.0, 0.25, uDrain));
  float dotm = 1.0 - smoothstep(rad - 0.10, rad, length(f));
  float zoom = 1.0 - smoothstep(0.12, 0.38, px);
  float body = mix(0.9, dotm, zoom);
  vec3 base = vec3(0.105, 0.105, 0.115) + 0.02 * dotm * (1.0 - hf);
  vec3 col = mix(base, heat(0.06 + 0.94 * v), smoothstep(0.02, 0.25, v) * body);
  col = mix(col, COL_OK * 0.8, drained * smoothstep(0.0, 0.2, uDrain) * 0.5 * body * step(0.02, v));
  // boundary between the two accumulator buffers (columns 0-255 | 256-511)
  float bx = 1.0 - smoothstep(0.0, 1.5 * px + 0.5, abs(cc.x - 256.0));
  col = mix(col, vec3(0.85), bx * 0.5);
  // outline so the slice reads as a distinct memory even when empty
  vec2 e2 = min(vUv, 1.0 - vUv) * vec2(512.0, 32.0);
  float bd = 1.0 - smoothstep(0.0, max(1.2 * px, 0.6), min(e2.x, e2.y));
  col = mix(col, COL_ACC * 0.75, bd * 0.7);
  float bright = (4 & int(uFocusMask)) != 0 ? 1.0 : 0.0;
  col = mix(BG * 1.15, col, mix(1.0, mix(0.22, 1.0, bright), uFocusAmt));
  gl_FragColor = vec4(col, 1.0);
}
