attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aVia;
attribute vec3 aColor;
attribute vec4 aInfo;  // type, group, size (local units), w (slot / pair / phase)
attribute vec4 aExtra; // speed, arc height (local z), tail length (0..1 of the path), 0
uniform float uTime;
uniform float uFlowT;
uniform float uT;
uniform float uAssign;
uniform float uGroup[10];
varying vec3 vColor;
varying float vAlpha;
varying vec2 vUv; // x: 0 at the head .. 1 at the tail, y: -1..1 across

float slotC(float idx) { return mod(uT - idx + 6.0 * 40.0, 6.0); }
float rnd8(float n, float salt) { return floor(fract(sin(n * 12.9898 + salt * 78.233) * 43758.5453) * 8.0); }

float gType;
vec3 gS, gV, gE;
float gArc;

// position along the path at parameter p in [0,1]
vec3 path(float p) {
  p = clamp(p, 0.0, 1.0);
  vec3 l;
  if (gType > 0.5 && gType < 1.5) {
    // TMA: strip block -> TMA unit -> ring slot
    if (p < 0.62) {
      float q = p / 0.62;
      l = mix(gS, gV, q);
      l.z += gArc * sin(3.14159 * q);
    } else {
      l = mix(gV, gE, (p - 0.62) / 0.38);
    }
  } else {
    l = mix(gS, gE, p);
    l.z += gArc * sin(3.14159 * p);
  }
  return l;
}

void main() {
  gType = floor(aInfo.x + 0.5);
  int g = int(aInfo.y + 0.5);
  float ga = 0.0;
  for (int i = 0; i < 10; i++) if (i == g) ga = uGroup[i];
  float a = ga;
  gS = aStart;
  gE = aEnd;
  gV = aVia;
  gArc = aExtra.y;
  float tail = aExtra.z > 0.0 ? aExtra.z : (gType > 0.5 && gType < 2.5 ? 0.22 : 0.09);
  float p;
  if (gType < 0.5) {
    // endless stream start -> end
    p = fract(uFlowT * aExtra.x + aInfo.w);
    a *= smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.85, 1.0, p));
  } else if (gType < 1.5) {
    // TMA load, only while the ring slot is being (re)filled
    float idx = aInfo.w;
    float c = slotC(idx);
    float started = step(idx, uT);
    p = c;
    float b = floor(uT - c + 0.5);
    gS.x += (clamp(b / 128.0, 0.0, 1.0) - 0.5) * 18.0;
    a *= started * step(c, 1.0) * smoothstep(0.0, 0.06, p) * (1.0 - smoothstep(0.96, 1.0, p));
  } else if (gType < 2.5) {
    // MMA read: ring slot -> tensor core, only while the slot is being consumed
    float idx = aInfo.w;
    float c = slotC(idx);
    float started = step(idx, uT);
    p = c - 5.0;
    a *= started * step(5.0, c) * smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.92, 1.0, p));
  } else if (gType < 3.5) {
    // CTA assignment: GigaThread engine -> CTA pair (once, in scheduler order; both dies in the same order)
    float t = uAssign * 1.3 - aInfo.w / 37.0;
    p = clamp(t * 2.2, 0.0, 1.0);
    a *= step(0.0, t) * (1.0 - smoothstep(0.7, 1.0, p));
  } else {
    // hero: tiled matmul. A tile (ci,k) and B tile (k,cj) stream into the C tile (ci,cj)
    float hp = uTime * 0.5;
    float kk = floor(mod(hp, 8.0));
    float cyc = floor(hp / 8.0);
    float ci = rnd8(cyc, 1.0);
    float cj = rnd8(cyc, 2.0);
    float ts = 0.75;
    vec3 ct = vec3((cj + 0.5) * ts, -(ci + 0.5) * ts, 0.05);
    if (gType < 4.5) {
      gS = vec3(-6.5 + (kk + 0.5) * ts, -(ci + 0.5) * ts, 0.05) + vec3(aStart.xy, 0.0);
    } else {
      gS = vec3((cj + 0.5) * ts, 6.5 - (kk + 0.5) * ts, 0.05) + vec3(aStart.xy, 0.0);
    }
    gE = ct + vec3(aEnd.xy, 0.0);
    p = fract(uFlowT * aExtra.x + aInfo.w);
    a *= smoothstep(0.0, 0.1, p) * (1.0 - smoothstep(0.88, 1.0, p));
  }
  vec3 head = path(p);
  vec3 tl = path(p - tail);
  mat4 mvm = viewMatrix * modelMatrix;
  vec4 mh = mvm * vec4(head, 1.0);
  vec4 mt = mvm * vec4(tl, 1.0);
  float sc = length(modelMatrix[0].xyz);
  float w = aInfo.z * sc;
  vec2 d = mt.xy - mh.xy;
  float L = length(d);
  vec2 dir = L > 1e-7 ? d / L : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float len = max(L, w * 1.3);
  float u = position.x + 0.5;
  vec4 mv = mh;
  mv.xy += dir * (u * len - w * 0.35) + perp * position.y * w;
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = a;
  vUv = vec2(u, position.y * 2.0);
}
