import { type Group, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { LANES } from "../layout";
import { withCommon } from "../materials";
import lanesFrag from "../shaders/lanes.frag.glsl?raw";
import planeVert from "../shaders/plane.vert.glsl?raw";
import { U } from "../state";

/** Nsight-Systems style lanes: producer / MMA / epilogue, overlapping across two tiles. */
export function createLanes(parent: Group) {
  const m = new Mesh(
    new PlaneGeometry(LANES.w, LANES.h),
    new ShaderMaterial({
      uniforms: U as never,
      vertexShader: planeVert,
      fragmentShader: withCommon(lanesFrag),
    }),
  );
  m.position.set(0, LANES.cy, 0.05);
  m.frustumCulled = false;
  parent.add(m);
}
