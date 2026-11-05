uniform float uPkgVis, uDetailVis, uCubeVis;
uniform float uAssign, uLock, uWave, uCalm, uTileVis;
uniform float uRevTma, uRevSmem, uRevTmem, uRevTensor, uRevWarps;
uniform float uK, uMma, uDrain, uStage, uStore, uTmaOn, uNext;
varying vec3 vColor;
varying vec4 vInfo;
varying vec3 vNormal;
varying vec3 vP;
varying vec3 vS;
varying vec3 vWorld;

float revealOf(float id) {
  if (id < 0.5) return 1.0;
  if (id < 1.5) return uRevTma;
  if (id < 2.5) return uRevSmem;
  if (id < 3.5) return uRevTmem;
  if (id < 4.5) return uRevTensor;
  return uRevWarps;
}

// Ring slot cycle: u in [0,1) read by MMA, [1,2) loaded by TMA, [2,6) full.
float slotU(float idx) { return mod(uK * 128.0 - idx + 6.0 * 64.0, 6.0); }
float slotFill(float idx) {
  float u = slotU(idx);
  return u < 1.0 ? 1.0 - u : (u < 2.0 ? u - 1.0 : 1.0);
}

void main() {
  float kind = floor(vInfo.x + 0.5);
  float idx = floor(vInfo.y + 0.5);
  float edgeW = vInfo.z;
  vec3 col = vColor;
  float alpha = 1.0;

  vec3 n = normalize(vNormal);
  float shade = 0.62 + 0.38 * clamp(dot(n, normalize(vec3(0.35, 0.55, 0.75))), 0.0, 1.0);

  vec3 d = (0.5 - abs(vP)) * vS;
  float e = 0.0;
  if (edgeW > 0.0) {
    float nearX = step(d.x, edgeW), nearY = step(d.y, edgeW), nearZ = step(d.z, edgeW);
    e = step(1.5, nearX + nearY + nearZ);
  }
  vec3 edgeCol = COPPER * 0.9;
  float glow = 0.0;

  if (kind < 0.5) { // 0: static structure
  } else if (kind < 1.5) { // 1: package structure
    alpha = uPkgVis;
  } else if (kind < 2.5) { // 2: SM on the die
    alpha = uPkgVis;
    float pn = idx / 74.0;
    float a = uAssign * 1.2 - pn;
    float flash = a > 0.0 ? exp(-a * 9.0) : 0.0;
    float assigned = a > 0.0 ? 0.22 : 0.0;
    float sel = step(abs(idx - 20.0), 0.5) * uLock;
    float w = uWave * 1.25 - hash21(vec2(idx, 3.0)) * 0.55 - pn * 0.1;
    float busy = clamp(w * 5.0, 0.0, 1.0) * (1.0 - 0.7 * uCalm);
    float h = max(max(flash, assigned), max(busy * 0.85, sel));
    col = mix(col, heat(0.25 + 0.75 * h), clamp(h, 0.0, 1.0));
    glow = h * 0.25;
    edgeCol = mix(edgeCol, vec3(1.0, 0.94, 0.78), sel);
  } else if (kind < 3.5) { // 3: HBM
    alpha = uPkgVis;
    float stripes = step(0.5, fract(vWorld.y * 14.0));
    col *= 0.85 + 0.15 * stripes;
  } else if (kind < 4.5) { // 4: detail structure
    alpha = uDetailVis * revealOf(floor(vInfo.w + 0.5));
  } else if (kind < 5.5) { // 5: SMEM ring slot (A or B half), idx = slot
    alpha = uDetailVis * uRevSmem;
    float f = slotFill(idx);
    float u = slotU(idx);
    float loading = step(1.0, u) * step(u, 2.0);
    col = col * mix(0.14, 1.0, f);
    glow = loading * 0.25 * uTmaOn;
    // hollow when (nearly) empty so state is not colour-only
    if (f < 0.5 && e < 0.5) alpha = 0.0;
    edgeCol = vColor;
  } else if (kind < 6.5) { // 6: warp / thread box, idx = role
    alpha = uDetailVis * uRevWarps;
    float act2 = 0.0;
    if (idx < 0.5) act2 = uTmaOn;
    else if (idx < 1.5) act2 = uMma;
    else act2 = smoothstep(0.0, 0.2, uDrain) * (1.0 - smoothstep(0.9, 1.0, uDrain));
    col = mix(col * 0.45, col, act2);
    glow = act2 * 0.3;
  } else if (kind < 7.5) { // 7: selected tile
    alpha = uTileVis;
    col = heat(0.85);
    glow = 0.15;
  } else if (kind < 8.5) { // 8: tensor core
    alpha = uDetailVis * uRevTensor;
    float act = uMma * (0.6 + 0.4 * sin(uK * 128.0 * 6.2831));
    col = mix(col, heat(0.55 + 0.4 * act), uMma * 0.8);
    glow = uMma * 0.2;
  } else if (kind < 9.5) { // 9: barrier indicator, idx = slot: filled = full, hollow = empty
    alpha = uDetailVis * uRevSmem;
    float u = slotU(idx);
    float full = (u < 1.0 || u >= 2.0) ? 1.0 : 0.0;
    if (full < 0.5 && e < 0.5) alpha = 0.0;
    col = COPPER;
  } else if (kind < 10.5) { // 10: registers + staging (epilogue)
    alpha = uDetailVis * revealOf(floor(vInfo.w + 0.5));
    float act = idx < 0.5 ? smoothstep(0.0, 0.3, uDrain) * (1.0 - smoothstep(0.6, 0.95, uStage)) : smoothstep(0.35, 0.6, uStage) * (1.0 - smoothstep(0.7, 0.9, uStore));
    col = mix(col, heat(0.6), act * 0.7);
    glow = act * 0.2;
  } else if (kind < 11.5) { // 11: HBM slab in detail: lit where C tile was stored
    alpha = uDetailVis;
    float seg = step(abs(vP.x * vS.x - (idx)), 1.6);
    float lit = seg * smoothstep(0.55, 0.9, uStore);
    col = mix(col, heat(0.9), lit);
    glow = lit * 0.15;
  }

  if (dropped(alpha)) discard;
  vec3 c = col * shade + glow;
  c = mix(c, edgeCol, e * 0.9);
  gl_FragColor = vec4(c, 1.0);
}
