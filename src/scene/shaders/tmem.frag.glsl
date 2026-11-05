// Tensor Memory: 128 lanes (rows) x 512 columns (32-bit cells), drawn as a single plane.
uniform float uDetailVis, uRevTmem, uK, uDrain, uShrink, uNext;
varying vec2 vUv;
varying vec3 vWorld;

void main() {
  if (dropped(uDetailVis * uRevTmem)) discard;
  vec2 cells = vec2(512.0, 128.0);
  vec2 cc = vUv * cells;
  vec2 id = floor(cc);
  vec2 f = fract(cc) - 0.5;
  float px = max(fwidth(cc.x), fwidth(cc.y)); // cell size in "cells per pixel"
  float hf = step(256.0, id.x); // 0: accumulator tile n, 1: next tile (double buffer)
  float r = hash21(id);
  float rowGrad = 0.75 + 0.25 * sin(id.y * 0.21 + id.x * 0.013);
  float acc = clamp(uK * (0.55 + 0.45 * r) * rowGrad + 0.0, 0.0, 1.0);
  float nxt = clamp(uNext * (0.5 + 0.5 * r) * (1.0 - smoothstep(0.0, 1.0, id.x / 512.0) * 0.4), 0.0, 0.55);
  float v = hf < 0.5 ? acc : nxt;
  // epilogue drains the left half front to back
  float front = uDrain * 256.0;
  float drained = hf < 0.5 ? step(id.x, front) : 0.0;
  float rad = 0.42 * mix(1.0, 0.55, uShrink * drained);
  v = mix(v, v * 0.12, drained * smoothstep(0.0, 0.3, uDrain));
  float dotm = 1.0 - smoothstep(rad - 0.08, rad, length(f));
  // far away, cells are sub-pixel: show the aggregate heat
  float zoom = (1.0 - smoothstep(0.12, 0.35, px)); // 1 when each cell is >~3px
  float body = mix(0.85, dotm, zoom);
  vec3 base = vec3(0.07, 0.08, 0.10);
  vec3 hc = heat(0.1 + 0.9 * v);
  vec3 col = mix(base, hc, smoothstep(0.02, 0.3, v) * body);
  col = mix(col, base * 1.5, (1.0 - body) * 0.5 * zoom);
  // quadrant guides every 32 lanes (4 epilogue warps) and the half boundary
  float guide = step(abs(fract(id.y / 32.0 + 0.0001) - 0.0), 0.0) ;
  float bx = 1.0 - smoothstep(0.0, 1.5 * px + 0.5, abs(cc.x - 256.0));
  col = mix(col, vec3(0.851, 0.541, 0.306), bx * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
