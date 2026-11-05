varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;
void main() {
  float d = length(vUv);
  float g = 1.0 - smoothstep(0.0, 1.0, d);
  float a = vAlpha * g * g;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * (0.55 + 0.9 * g) * a, a);
}
