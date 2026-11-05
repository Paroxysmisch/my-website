// A or B operand strip in HBM: K = 8192 sliced into 128 k-blocks of 64.
uniform float uOperand; // 0 = A, 1 = B
uniform float uDetailVis, uSlice, uK;
varying vec2 vUv;
void main() {
  if (dropped(uDetailVis)) discard;
  float kb = vUv.x * 128.0;
  float b = floor(kb);
  float f = fract(kb);
  float gap = uSlice * 0.28;
  float inBlock = step(gap, f) * step(f, 1.0 - gap);
  float kf = uK * 128.0;
  float done = step(b + 1.0, kf);
  float cur = step(b, kf) * (1.0 - done);
  vec3 base = uOperand < 0.5 ? COL_A : COL_B;
  float br = mix(0.75, 0.28, done);
  vec3 col = base * br;
  col = mix(col, vec3(1.0), cur * 0.6);
  float yEdge = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
  col *= mix(0.55, 1.0, yEdge);
  col = mix(vec3(0.05, 0.06, 0.07), col, inBlock);
  gl_FragColor = vec4(col, 1.0);
}
