// Pipeline lanes (producer / MMA / epilogue) over the span of two tiles' k-loops.
uniform float uDetailVis, uLanes, uK, uDrain;
varying vec2 vUv;
void main() {
  if (dropped(uDetailVis * uLanes)) discard;
  const float T = 160.0; // time window in k-block units
  float t = vUv.x * T;
  float lane = floor((1.0 - vUv.y) * 3.0);
  float ly = fract((1.0 - vUv.y) * 3.0);
  float bar = smoothstep(0.0, 0.1, ly) * (1.0 - smoothstep(0.9, 1.0, ly));
  float on = 0.0;
  vec3 col = vec3(0.0);
  float now = uK * 128.0 + 2.0;
  float lag = lane < 0.5 ? 0.0 : 2.0;
  if (lane < 1.5) {
    float b = floor(t - lag);
    float f = fract(t - lag);
    on = step(0.0, t - lag) * step(f, 0.82) * step(0.5, bar);
    float tile = step(128.0, b);
    col = lane < 0.5 ? mix(COL_A * 0.9 + COL_B * 0.25, vec3(0.75, 0.55, 0.85), tile) : mix(heat(0.55), heat(0.8), tile);
    on *= step(t - lag, now - lag + 0.0);
    on *= step(b, now);
  } else {
    float s = 130.0, e2 = 146.0;
    on = step(s, t) * step(t, e2) * step(0.5, bar) * smoothstep(0.0, 0.05, uDrain) * step(t, s + 16.0 * clamp(uDrain * 1.4, 0.0, 1.0));
    col = heat(0.95);
  }
  vec3 bg = vec3(0.07, 0.08, 0.10) * (0.6 + 0.4 * step(0.5, bar));
  bg = mix(bg, vec3(0.1, 0.11, 0.14), step(0.5, mod(floor(t / 16.0), 2.0)) * 0.6);
  vec3 c = mix(bg, col, on);
  // playhead
  c = mix(c, vec3(1.0), (1.0 - smoothstep(0.0, 0.5, abs(t - now))) * 0.9);
  gl_FragColor = vec4(c, 1.0);
}
