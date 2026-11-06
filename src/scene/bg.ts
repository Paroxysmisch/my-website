/**
 * Subtle background: soft orbs rendered as ASCII characters that drift slowly and glow around the pointer.
 * Raw WebGL2 (separate from the main scene), glyphs come from a small canvas-drawn atlas. Kept very faint on purpose.
 */
import { bgMask } from "./bgmask";

const GLYPHS = " .:-=+*#%@";

const VERT = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;   // device px, origin bottom-left
uniform float uMouseAmt;
uniform float uCell;   // device px
uniform vec3 uInk;
uniform sampler2D uAtlas;
uniform vec2 uP[40];   // scene footprint polygons (device px, y up), 8 points each
uniform int uN[5];
uniform float uA[5];
uniform float uMargin;
out vec4 o;

// 1 inside the polygon, fading to 0 over uMargin outside it (convex, counter-clockwise)
float clearOf(int k, vec2 q) {
  int n = uN[k];
  if (n < 3) return 0.0;
  float d = -1e6;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    vec2 a = uP[k * 8 + i];
    vec2 b = uP[k * 8 + (i + 1 >= n ? 0 : i + 1)];
    vec2 e = b - a;
    float l = length(e);
    if (l < 0.5) continue;
    d = max(d, dot(q - a, vec2(e.y, -e.x)) / l);
  }
  float t = max(d, 0.0) / uMargin;
  return exp(-t * t * 1.6) * uA[k]; // long, soft tail instead of a hard edge
}

float orb(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  return exp(-dot(d, d) / (r * r));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 cell = floor(frag / uCell);
  vec2 cuv = fract(frag / uCell);
  float asp = uRes.x / uRes.y;
  vec2 p = (cell + 0.5) * uCell / uRes.y;
  float t = uTime;
  float f = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(asp * (0.5 + 0.46 * sin(t * (0.045 + 0.011 * fi) + fi * 1.9)),
                  0.5 + 0.42 * cos(t * (0.037 + 0.009 * fi) + fi * 2.6));
    f += orb(p, c, 0.20 + 0.04 * fi) * (0.75 - 0.08 * fi);
  }
  // the pointer carries a brighter orb and ripples the field around it
  vec2 m = uMouse / uRes.y;
  float md = length(p - m);
  f += uMouseAmt * (1.15 * exp(-md * md / 0.018) + 0.22 * sin(md * 46.0 - t * 2.6) * exp(-md * md / 0.05));
  f = clamp(f * 0.62, 0.0, 1.0);
  // make room for the animation: the field dissolves (glyphs thin out, then vanish) under and around the 3D scene
  float clear = max(max(clearOf(0, frag), clearOf(1, frag)), max(max(clearOf(2, frag), clearOf(3, frag)), clearOf(4, frag)));
  f *= 1.0 - 0.92 * clear;
  float idx = floor(f * 9.0 + 0.5);
  vec2 auv = vec2((idx + cuv.x) / 10.0, 1.0 - cuv.y);
  float g = texture(uAtlas, auv).r;
  float a = g * (0.07 + 0.26 * f) * step(0.5, idx);
  a *= 1.0 - 0.96 * clear;
  o = vec4(uInk * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type) as WebGLShader;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? "shader");
  return s;
}

export function startBackground(canvas: HTMLCanvasElement, opts: { animate: boolean }) {
  const ctx = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
  });
  if (!ctx) return false;
  const gl: WebGL2RenderingContext = ctx;
  const prog = gl.createProgram() as WebGLProgram;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
  gl.useProgram(prog);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = U("uRes");
  const uTime = U("uTime");
  const uMouse = U("uMouse");
  const uAmt = U("uMouseAmt");
  const uCell = U("uCell");
  const uP = U("uP");
  const uN = U("uN");
  const uA = U("uA");
  const uMargin = U("uMargin");

  // glyph atlas: 10 glyphs, 64 px cells, white on transparent
  const make = () => {
    const c = document.createElement("canvas");
    c.width = 64 * GLYPHS.length;
    c.height = 64;
    const x = c.getContext("2d") as CanvasRenderingContext2D;
    x.fillStyle = "#fff";
    x.font = '400 54px "DM Mono", ui-monospace, monospace';
    x.textAlign = "center";
    x.textBaseline = "middle";
    [...GLYPHS].forEach((ch, i) => x.fillText(ch, i * 64 + 32, 34));
    return c;
  };
  const tex = gl.createTexture();
  const upload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, make());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  };
  upload();
  document.fonts?.ready.then(() => {
    upload();
    draw(last);
  });
  gl.uniform1i(U("uAtlas"), 0);
  // faint, slightly cool ink (matches --muted)
  gl.uniform3f(U("uInk"), 0.62, 0.65, 0.72);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let W = 1;
  let H = 1;
  const size = () => {
    W = Math.max(1, Math.round(innerWidth * dpr));
    H = Math.max(1, Math.round(innerHeight * dpr));
    canvas.width = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);
  };
  size();
  addEventListener("resize", () => {
    size();
    draw(last);
  });

  let mx = -1e4;
  let my = -1e4;
  let sx = mx;
  let sy = my;
  let amt = 0;
  let want = 0;
  addEventListener(
    "pointermove",
    (e) => {
      mx = e.clientX * dpr;
      my = (innerHeight - e.clientY) * dpr;
      if (sx < -1e3) {
        sx = mx;
        sy = my;
      }
      want = 1;
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => {
    want = 0;
  });

  let last = 0;
  function draw(now: number) {
    last = now;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uRes, W, H);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform2f(uMouse, sx, sy);
    gl.uniform1f(uAmt, amt);
    gl.uniform1f(uCell, Math.round(16 * dpr));
    // scene footprint (CSS px, y down) -> device px, y up
    const pp = new Float32Array(80);
    for (let i = 0; i < 40; i++) {
      pp[i * 2] = (bgMask.pts[i * 2] as number) * dpr;
      pp[i * 2 + 1] = H - (bgMask.pts[i * 2 + 1] as number) * dpr;
    }
    gl.uniform2fv(uP, pp);
    gl.uniform1iv(uN, bgMask.n);
    gl.uniform1fv(uA, bgMask.a);
    gl.uniform1f(uMargin, 260 * dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  draw(0);
  document.documentElement.classList.add("bg-on");
  if (!opts.animate) return true;

  let prev = 0;
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (document.hidden || now - prev < 33) return; // ~30 fps is plenty for a slow background
    prev = now;
    sx += (mx - sx) * 0.12;
    sy += (my - sy) * 0.12;
    amt += (want - amt) * 0.06;
    draw(now);
  };
  requestAnimationFrame(loop);
  return true;
}
