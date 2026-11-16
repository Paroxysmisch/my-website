uniform float uFlowT;
varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;    // x: distance from the head in particle widths (negative = ahead), y: -3.2..3.2 across
varying float vTail; // 0 at the head .. 1 at the end of the tail
varying float vSeed;

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// A particle is one little square: a bit of a tensor. It flickers on and off as it flies, and sheds a few
// smaller, fainter squares behind it.
void main() {
  vec2 q = vec2(vUv.x, vUv.y * 0.5); // in units of the particle width
  float tick = floor(uFlowT * 8.0 + vSeed * 3.0);
  float a = 0.0;
  float bright = 0.0;
  // head
  float s = 0.6;
  if (abs(q.x) <= s * 0.5 && abs(q.y) <= s * 0.5) {
    float on = step(0.4, hash2(vec2(vSeed, tick)));
    a = 0.35 + 0.65 * on;
    bright = on;
  } else {
    // trail squares, each one flickering independently
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float sz = s * (0.72 - 0.17 * fk);
      float cx = 0.95 * (fk + 1.0);
      if (abs(q.x - cx) <= sz * 0.5 && abs(q.y) <= sz * 0.5) {
        float on = step(0.5, hash2(vec2(vSeed + fk * 3.7, tick)));
        a = (0.55 - 0.16 * fk) * (0.3 + 0.7 * on) * (1.0 - 0.5 * vTail);
        bright = 0.0;
      }
    }
  }
  float al = vAlpha * a;
  if (al < 0.01) discard;
  vec3 dark = mix(vColor * 0.95, mix(vColor, vec3(1.0), 0.5), bright);
  vec3 light = vColor * mix(0.66, 0.82, bright);
  gl_FragColor = vec4(mix(dark, light, uLight), min(1.0, al));
}
