precision highp float;
uniform float uTime;
uniform float uLight; // 0 = dark theme, 1 = light theme

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

// Light theme: all shaders work in "dark space"; the final colour is mapped here.
// Muted hardware tones flip their lightness (hue and saturation kept); strongly saturated data colours
// (A, B, accumulator, done) stay vivid but slightly darker so they read on a light page.
vec3 flipL(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float L = 0.5 * (mx + mn);
  float C = mx - mn;
  float L2 = clamp(0.965 - 0.95 * L, 0.0, 1.0);
  float S = C / max(1e-4, 1.0 - abs(2.0 * L - 1.0));
  float C2 = min(S * 1.35, 1.0) * (1.0 - abs(2.0 * L2 - 1.0));
  vec3 d = (c - vec3(L)) * (C2 / max(C, 1e-4));
  return vec3(L2) + d;
}
// Warm accumulator tones (ember → amber → hot) keep their hue in light mode: pale peach → orange → red-orange.
vec3 warmLight(float l) {
  float t = smoothstep(0.12, 0.95, l);
  vec3 peach = vec3(0.99, 0.86, 0.66);
  vec3 orange = vec3(0.96, 0.55, 0.06);
  vec3 hot = vec3(0.80, 0.24, 0.05);
  return t < 0.5 ? mix(peach, orange, t * 2.0) : mix(orange, hot, (t - 0.5) * 2.0);
}
vec3 themed(vec3 c) {
  if (uLight < 0.001) return c;
  float C = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  float dataness = smoothstep(0.40, 0.58, C);
  // data colours: more saturated and a touch darker so they stay vivid on a light page
  vec3 data = (vec3(lum) + (c - vec3(lum)) * 1.25) * mix(0.92, 0.72, smoothstep(0.6, 0.95, lum));
  data = clamp(data, 0.0, 1.0);
  float warm = smoothstep(0.2, 0.36, C) * step(c.b + 0.08, c.g) * step(c.g + 0.04, c.r);
  vec3 lightC = mix(flipL(c), data, dataness);
  lightC = mix(lightC, warmLight(lum), warm);
  return mix(c, lightC, uLight);
}
