precision highp float;
uniform float uTime;

vec3 heat(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  vec3 c0 = vec3(0.659, 0.314, 0.184);
  vec3 c1 = vec3(0.941, 0.541, 0.235);
  vec3 c2 = vec3(1.000, 0.769, 0.420);
  vec3 c3 = vec3(1.000, 0.945, 0.788);
  return t < 1.0 ? mix(c0, c1, t) : (t < 2.0 ? mix(c1, c2, t - 1.0) : mix(c2, c3, t - 2.0));
}
const vec3 COL_A = vec3(0.310, 0.820, 0.878);
const vec3 COL_B = vec3(0.894, 0.435, 0.816);
const vec3 COPPER = vec3(0.851, 0.541, 0.306);
const vec3 GRAPHITE = vec3(0.115, 0.130, 0.155);

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
