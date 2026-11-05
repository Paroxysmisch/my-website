uniform vec3 uColor;
uniform float uAlpha;
void main() {
  if (dropped(uAlpha)) discard;
  gl_FragColor = vec4(uColor, 1.0);
}
