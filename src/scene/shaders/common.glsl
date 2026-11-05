precision highp float;
uniform float uTime;

// Palette (inspired by the GEMM walkthrough): A blue, B magenta, accumulator amber, done green, peer purple.
const vec3 COL_A = vec3(0.416, 0.651, 1.000);
const vec3 COL_B = vec3(0.878, 0.384, 0.816);
const vec3 COL_ACC = vec3(0.941, 0.663, 0.227);
const vec3 COL_OK = vec3(0.306, 0.816, 0.541);
const vec3 COL_PEER = vec3(0.655, 0.545, 0.980);
const vec3 BG = vec3(0.063, 0.067, 0.075);

// Accumulator ramp: ember -> amber -> light
vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.20, 0.13, 0.07);
  vec3 c1 = vec3(0.70, 0.43, 0.12);
  vec3 c2 = vec3(0.941, 0.663, 0.227);
  vec3 c3 = vec3(1.0, 0.90, 0.62);
  t *= 3.0;
  return t < 1.0 ? mix(c0, c1, t) : (t < 2.0 ? mix(c1, c2, t - 1.0) : mix(c2, c3, t - 2.0));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
// Screen-door dither: keeps the pipeline opaque (depth-correct) while fading.
bool dropped(float alpha) {
  if (alpha >= 0.999) return false;
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  return n > alpha;
}
// Swizzled raster order of output tiles (matches kernel.ts rasterOrder).
float rasterOrder(vec2 t) {
  float g = floor(t.y / 8.0);
  return g * 8.0 * 32.0 + t.x * 8.0 + mod(t.y, 8.0);
}
