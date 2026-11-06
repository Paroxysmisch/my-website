varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;
varying float vTail;
void main() {
  float a = vUv.x; // along the path in particle widths (head at 0)
  float v = vUv.y; // across, in units where |v| = 1 is the half-width of the tail
  // fade to exactly zero well inside the quad so no straight edge is ever visible
  float edge = (1.0 - smoothstep(0.7, 1.6, abs(v))) * (1.0 - smoothstep(0.0, 1.0, clamp(-a / 1.6, 0.0, 1.0)));
  float rr = a * a * 1.4 + v * v * 0.9;
  float core = exp(-rr * 3.0);
  float halo = exp(-rr * 0.7) * 0.22;
  float tailI = a > 0.0 ? pow(1.0 - vTail, 2.0) * exp(-v * v * 2.2) * smoothstep(0.0, 0.6, a + 0.6) : 0.0;
  float i = clamp(tailI * 0.8 + core + halo, 0.0, 1.0) * edge;
  float al = vAlpha * i;
  if (al < 0.006) discard;
  vec3 rgb = mix(vColor * 1.15, vec3(1.0), clamp(core * 0.6, 0.0, 1.0));
  gl_FragColor = vec4(rgb, al);
}
