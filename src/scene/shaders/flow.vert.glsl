attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aVia;
attribute vec3 aColor;
attribute vec4 aInfo;  // type, group, size (local units), w (slot / pair / phase)
attribute vec4 aExtra; // speed, arc height (local z), 0, 0
uniform float uTime;
uniform float uFlowT;
uniform float uT;
uniform float uAssign;
uniform float uGroup[10];
varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv;

float slotC(float idx) { return mod(uT - idx + 6.0 * 40.0, 6.0); }

void main() {
  float type = floor(aInfo.x + 0.5);
  int g = int(aInfo.y + 0.5);
  float ga = 0.0;
  for (int i = 0; i < 10; i++) if (i == g) ga = uGroup[i];
  vec3 local;
  float a = ga;
  float arc = aExtra.y;
  if (type < 0.5) {
    // endless stream start -> end
    float p = fract(uFlowT * aExtra.x + aInfo.w);
    a *= smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.85, 1.0, p));
    local = mix(aStart, aEnd, p);
    local.z += arc * sin(3.14159 * p);
  } else if (type < 1.5) {
    // TMA load: strip block -> TMA unit -> ring slot, only while the slot is being (re)filled
    float idx = aInfo.w;
    float c = slotC(idx);
    float started = step(idx, uT);
    float p = c;
    float b = floor(uT - c + 0.5);
    vec3 s = aStart;
    s.x += (clamp(b / 128.0, 0.0, 1.0) - 0.5) * 18.0;
    vec3 v = aVia;
    if (p < 0.62) {
      float q = p / 0.62;
      local = mix(s, v, q);
      local.z += arc * sin(3.14159 * q);
    } else {
      local = mix(v, aEnd, (p - 0.62) / 0.38);
    }
    a *= started * step(c, 1.0) * smoothstep(0.0, 0.06, p) * (1.0 - smoothstep(0.96, 1.0, p));
  } else if (type < 2.5) {
    // MMA read: ring slot -> tensor core, only while the slot is being consumed
    float idx = aInfo.w;
    float c = slotC(idx);
    float started = step(idx, uT);
    float p = c - 5.0;
    local = mix(aStart, aEnd, clamp(p, 0.0, 1.0));
    local.z += arc * sin(3.14159 * clamp(p, 0.0, 1.0));
    a *= started * step(5.0, c) * smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.92, 1.0, p));
  } else if (type > 3.5) {
    // dot-product streams in the matrices: A along the active row, B down the active column
    float rp = fract(uTime * 0.045 + 0.1);
    float cp = fract(uTime * 0.071 + 0.55);
    float p = fract(uFlowT * aExtra.x + aInfo.w);
    float y = -rp * 6.0;
    float x = cp * 6.0;
    vec3 s = type < 4.5 ? vec3(aStart.x, y, aStart.z) : vec3(x, aStart.y, aStart.z);
    vec3 en = type < 4.5 ? vec3(x, y, aEnd.z) : vec3(x, y, aEnd.z);
    local = mix(s, en, p);
    local.z += arc * sin(3.14159 * p);
    a *= smoothstep(0.0, 0.1, p) * (1.0 - smoothstep(0.9, 1.0, p));
  } else {
    // CTA assignment: GigaThread engine -> CTA pair (once, in scheduler order)
    float pn = aInfo.w / 74.0;
    float t = uAssign * 1.25 - pn;
    float p = clamp(t * 2.5, 0.0, 1.0);
    local = mix(aStart, aEnd, p);
    local.z += arc * sin(3.14159 * p);
    a *= step(0.0, t) * (1.0 - smoothstep(0.75, 1.0, p));
  }
  vec4 wp = modelMatrix * vec4(local, 1.0);
  float sc = length(modelMatrix[0].xyz);
  vec4 mv = viewMatrix * wp;
  mv.xy += position.xy * aInfo.z * sc;
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = a;
  vUv = position.xy * 2.0;
}
