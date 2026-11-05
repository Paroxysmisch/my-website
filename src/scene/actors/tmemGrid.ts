import { type Group, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { SM_X, TMEM } from "../layout";
import { withCommon } from "../materials";
import planeVert from "../shaders/plane.vert.glsl?raw";
import tmemFrag from "../shaders/tmem.frag.glsl?raw";
import { U } from "../state";

/** TMEM as one plane: 128 lanes x 512 columns drawn procedurally (no per-cell instances). */
export function createTmem(parent: Group) {
  const geo = new PlaneGeometry(TMEM.w, TMEM.h);
  const mat = new ShaderMaterial({
    uniforms: U as never,
    vertexShader: planeVert,
    fragmentShader: withCommon(tmemFrag),
  });
  for (const X of SM_X) {
    const m = new Mesh(geo, mat);
    m.position.set(X + TMEM.cx, TMEM.cy, 0.05);
    m.frustumCulled = false;
    parent.add(m);
  }
}
