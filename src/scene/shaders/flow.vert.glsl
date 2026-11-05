attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aColor;
attribute vec4 aInfo; // type, group, size(local), phase/slot
attribute vec4 aExtra; // speed, operand, 0, 0
uniform float uFlowT;
uniform float uK;
uniform float uGroup[8];
uniform vec2 uStrip; // x range of strip (local), kept for TMA source
varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;

float slotU(float idx) { return mod(uK * 128.0 - idx + 6.0 * 64.0, 6.0); }

void main() {
  float type = aInfo.x;
  int g = int(aInfo.y + 0.5);
  float ga = 0.0;
  for (int i = 0; i < 8; i++) if (i == g) ga = uGroup[i];
  float p;
  float a = ga;
  vec3 start = aStart;
  if (type < 0.5) {
    p = fract(uFlowT * aExtra.x + aInfo.w);
    a *= smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.85, 1.0, p));
  } else if (type < 1.5) {
    // TMA load into ring slot: only while the slot is being refilled (u in [1,2))
    float u = slotU(aInfo.w);
    p = u - 1.0;
    float kbl = floor(uK * 128.0 - u + 0.001) + 6.0;
    start.x = mix(uStrip.x, uStrip.y, clamp(kbl / 128.0, 0.0, 1.0));
    a *= step(1.0, u) * step(u, 2.0) * smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.92, 1.0, p));
  } else {
    // slot -> tensor core, only while the slot is being read (u in [0,1))
    float u = slotU(aInfo.w);
    p = u;
    a *= step(u, 1.0) * smoothstep(0.0, 0.1, p) * (1.0 - smoothstep(0.9, 1.0, p));
  }
  vec3 local = mix(start, aEnd, p);
  vec4 wp = modelMatrix * vec4(local, 1.0);
  float sc = length(modelMatrix[0].xyz);
  vec4 mv = viewMatrix * wp;
  mv.xy += position.xy * aInfo.z * sc;
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = a;
  vUv = position.xy * 2.0;
}
