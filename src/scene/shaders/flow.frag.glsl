uniform float uFlowT;
varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;    // x: distance from the head in particle widths (negative = ahead), y: -3.2..3.2 across
varying float vTail; // 0 at the head .. 1 at the end of the tail
varying float vSeed;

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

// A particle is a little packet of a tensor: a 4x4 patch of "values" whose bits keep flickering, with a
// few pixels shedding off behind it as it flies. (Tensor-tile colours: A blue, B magenta, accumulator amber, done green.)
void main() {
  vec2 q = vec2(vUv.x, vUv.y * 0.5); // in units of the particle width
  float tick = floor(uFlowT * 7.0 + vSeed * 3.0);
  float a = 0.0;
  float bright = 0.0;
  if (abs(q.x) <= 0.5 && abs(q.y) <= 0.5) {
    vec2 g = (q + 0.5) * 4.0;
    vec2 c = floor(g);
    vec2 f = fract(g);
    float bit = step(0.45, hash3(vec3(c, vSeed + tick * 0.37)));
    float pix = step(0.14, f.x) * step(f.x, 0.86) * step(0.14, f.y) * step(f.y, 0.86);
    a = pix * (0.30 + 0.70 * bit);
    bright = bit;
    float ring = step(0.40, max(abs(q.x), abs(q.y)));
    if (ring > 0.5) {
      a = 0.95;
      bright = 0.6;
    }
  } else if (q.x > 0.5 && abs(q.y) <= 0.5) {
    // pixels shedding off the tail
    float colI = floor((q.x - 0.5) / 0.25);
    float rowI = floor((q.y + 0.5) * 4.0);
    vec2 f = vec2(fract((q.x - 0.5) / 0.25), fract((q.y + 0.5) * 4.0));
    float pix = step(0.18, f.x) * step(f.x, 0.82) * step(0.18, f.y) * step(f.y, 0.82);
    float dens = pow(1.0 - vTail, 1.4) * 0.75;
    float on = step(hash3(vec3(colI, rowI, vSeed + tick * 0.53)), dens);
    a = on * pix * 0.8 * (1.0 - vTail);
    bright = 0.0;
  }
  float al = vAlpha * a;
  if (al < 0.01) discard;
  vec3 dark = mix(vColor * 0.95, mix(vColor, vec3(1.0), 0.55), bright);
  vec3 light = vColor * mix(0.62, 0.80, bright);
  gl_FragColor = vec4(mix(dark, light, uLight), min(1.0, al));
}
