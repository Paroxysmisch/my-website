uniform float uDieVis, uDetailVis, uDieFocus;
uniform float uAssign, uLock, uWave, uCalm, uTileVis;
uniform float uFocusMask, uFocusAmt;
uniform float uT, uTma, uMma, uDrain, uStage, uStore, uNext;
varying vec3 vColor;
varying vec4 vInfo;
varying vec3 vNormal;
varying vec3 vP;
varying vec3 vS;
varying vec3 vWorld;

// Ring slot cycle for k-block time t: block b is loaded during [b, b+1), full until it is
// consumed by the MMA during [b+5, b+6); the slot is then reloaded with block b+6.
float slotC(float idx) { return mod(uT - idx + 6.0 * 40.0, 6.0); }
float slotStarted(float idx) { return step(idx, uT); }
float slotFill(float idx) {
  float c = slotC(idx);
  float f = c < 1.0 ? c : (c < 5.0 ? 1.0 : 6.0 - c);
  return f * slotStarted(idx);
}

void main() {
  float kind = floor(vInfo.x + 0.5);
  float idx = floor(vInfo.y + 0.5);
  float edgeW = vInfo.z;
  int grp = int(floor(vInfo.w + 0.5));
  vec3 col = vColor;
  float alpha = 1.0;
  float glow = 0.0;
  bool useFocus = false;

  vec3 n = normalize(vNormal);
  float shade = 0.70 + 0.30 * clamp(dot(n, normalize(vec3(0.30, 0.55, 0.78))), 0.0, 1.0);

  vec3 d = (0.5 - abs(vP)) * vS;
  float e = 0.0;
  if (edgeW > 0.0) {
    vec3 fwd = max(fwidth(d), vec3(1e-5));
    float nx = 1.0 - smoothstep(edgeW - fwd.x, edgeW + fwd.x, d.x);
    float ny = 1.0 - smoothstep(edgeW - fwd.y, edgeW + fwd.y, d.y);
    float nz = 1.0 - smoothstep(edgeW - fwd.z, edgeW + fwd.z, d.z);
    e = clamp(nx * ny + ny * nz + nx * nz, 0.0, 1.0);
  }
  vec3 edgeCol = min(col * 1.55 + 0.06, vec3(1.0));
  float edgeAmt = 0.8;

  if (kind < 0.5) { // 0: static hardware in the SM-pair view
    alpha = uDetailVis;
    useFocus = true;
  } else if (kind < 1.5) { // 1: die structure
    alpha = uDieVis;
    float dm = 1.0 - 0.55 * uDieFocus;
    col *= dm;
  } else if (kind < 2.5) { // 2: SM tile on the die, idx = CTA pair id (-1 = fused off)
    alpha = uDieVis;
    if (idx >= 0.0) {
      // both dies are mirror images and run the same schedule: order by the index within the die
      float loc = idx >= 37.0 ? idx - 37.0 : idx;
      float pn = loc / 37.0;
      float a = uAssign * 1.3 - pn;
      float flash = a > 0.0 ? exp(-a * 8.0) : 0.0;
      float assigned = a > 0.0 ? 0.30 : 0.0;
      float sel = step(abs(idx - 20.0), 0.5);
      float lock = sel * uLock;
      float w = uWave * 1.25 - hash21(vec2(loc, 3.0)) * 0.55 - pn * 0.1;
      float busy = clamp(w * 5.0, 0.0, 1.0);
      float calm = busy * uCalm;
      float h = max(max(flash, assigned * (1.0 - calm)), busy * 0.9 * (1.0 - calm));
      float dm = mix(1.0, 0.35 + 0.65 * sel, uDieFocus * (1.0 - step(0.001, uWave)));
      col = mix(col, heat(0.30 + 0.70 * h), clamp(h, 0.0, 1.0)) * dm;
      col = mix(col, COL_OK * 0.75, calm);
      col = mix(col, vec3(1.0, 0.92, 0.7), lock);
      glow = h * 0.12 + lock * 0.25;
    } else {
      col *= 0.55;
      edgeAmt = 0.25;
    }
  } else if (kind < 3.5) { // 3: SMEM ring slot (A or B half), idx = slot
    alpha = uDetailVis;
    useFocus = true;
    float f = slotFill(idx);
    float c = slotC(idx);
    float st = slotStarted(idx);
    float loading = st * step(c, 1.0);
    float reading = st * step(5.0, c);
    vec3 base = vColor;
    col = base * (0.18 + 0.82 * f);
    col = mix(col, mix(col, COL_ACC, 0.6), reading);
    glow = (loading * 0.30 + reading * 0.20) * uTma;
    if (f < 0.12 && e < 0.5) alpha *= 0.0;
    edgeCol = mix(base, COL_ACC, reading);
    edgeAmt = 0.95;
  } else if (kind < 4.5) { // 4: full-barrier indicator, filled = slot full
    alpha = uDetailVis;
    useFocus = true;
    float c = slotC(idx);
    float full = slotStarted(idx) * step(1.0, c);
    if (full < 0.5 && e < 0.5) alpha = 0.0;
    col = COL_ACC;
  } else if (kind < 5.5) { // 5: warp chip, idx = warp id
    alpha = uDetailVis;
    useFocus = true;
    float act = 0.0;
    if (idx < 0.5) act = uTma;
    else if (idx < 1.5) act = uMma;
    else if (idx > 3.5) act = smoothstep(0.0, 0.2, uDrain) * (1.0 - smoothstep(0.92, 1.0, uDrain));
    col = mix(col * 0.55, col, act);
    glow = act * 0.30;
  } else if (kind < 6.5) { // 6: tensor core
    alpha = uDetailVis;
    useFocus = true;
    float pulse = 0.65 + 0.35 * sin(uT * 6.2831 * 2.0);
    float act = uMma * pulse;
    col = mix(col, heat(0.30 + 0.30 * act), uMma * 0.7);
    glow = uMma * 0.06;
  } else if (kind < 7.5) { // 7: the selected tile (floating)
    alpha = uTileVis;
    col = vec3(1.0, 0.90, 0.62);
    glow = 0.12;
  } else if (kind < 8.5) { // 8: register file (idx 0) / C staging buffer in SMEM (idx 1)
    alpha = uDetailVis;
    useFocus = true;
    float act = idx < 0.5 ? smoothstep(0.0, 0.3, uDrain) * (1.0 - smoothstep(0.6, 0.95, uStage))
                          : smoothstep(0.35, 0.6, uStage) * (1.0 - smoothstep(0.7, 0.92, uStore));
    col = mix(col, COL_OK, act * 0.75);
    glow = act * 0.16;
  }

  if (useFocus) {
    float bright = (grp & int(uFocusMask)) != 0 ? 1.0 : 0.0;
    float dm = mix(1.0, mix(0.22, 1.0, bright), uFocusAmt);
    col = mix(BG * 1.15, col, dm);
    edgeCol = mix(BG * 1.15, edgeCol, dm);
    glow *= mix(1.0, bright, uFocusAmt);
  }

  if (dropped(alpha)) discard;
  vec3 c = col * shade + glow;
  c = mix(c, edgeCol, e * edgeAmt);
  gl_FragColor = vec4(themed(c), 1.0);
}
