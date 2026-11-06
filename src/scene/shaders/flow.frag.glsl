varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;
void main() {
  float u = vUv.x;
  float v = vUv.y;
  // comet: bright hot head, tapering tail
  float tailI = pow(1.0 - u, 2.2) * exp(-v * v * 5.5);
  float core = exp(-(u * u * 26.0 + v * v * 9.0));
  float halo = exp(-(u * u * 5.0 + v * v * 3.0)) * 0.35;
  float i = clamp(tailI * 0.75 + core + halo, 0.0, 1.0);
  float a = vAlpha * i;
  if (a < 0.01) discard;
  vec3 rgb = mix(vColor * 1.15, vec3(1.0), clamp(core * 0.85, 0.0, 1.0));
  gl_FragColor = vec4(rgb, a);
}
