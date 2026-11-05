import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  type Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import boxFrag from "./shaders/box.frag.glsl?raw";
import boxVert from "./shaders/box.vert.glsl?raw";
import common from "./shaders/common.glsl?raw";
import { U } from "./state";

export const withCommon = (frag: string) => `${common}\n${frag}`;

/** All opaque instanced boxes share one program (kind-switched in the fragment shader). */
export const boxMaterial = new ShaderMaterial({
  uniforms: U as never,
  vertexShader: boxVert,
  fragmentShader: withCommon(boxFrag),
});

export interface BoxSpec {
  pos: [number, number, number];
  size: [number, number, number];
  rotZ?: number;
  color: string | number;
  /** kind, idx, edge width (local units), reveal id */
  info: [number, number, number, number];
}

const unit = new BoxGeometry(1, 1, 1);
const _m = new Matrix4();
const _q = new Quaternion();
const _z = new Vector3(0, 0, 1);

export function makeBoxes(specs: BoxSpec[], parent: Group, renderOrder = 0): InstancedMesh {
  const mesh = new InstancedMesh(unit.clone(), boxMaterial, specs.length);
  const colors = new Float32Array(specs.length * 3);
  const infos = new Float32Array(specs.length * 4);
  const c = new Color();
  specs.forEach((s, i) => {
    _q.setFromAxisAngle(_z, s.rotZ ?? 0);
    _m.compose(new Vector3(...s.pos), _q, new Vector3(...s.size));
    mesh.setMatrixAt(i, _m);
    c.set(s.color).convertLinearToSRGB();
    colors.set([c.r, c.g, c.b], i * 3);
    infos.set(s.info, i * 4);
  });
  mesh.geometry.setAttribute("aColor", new InstancedBufferAttribute(colors, 3));
  mesh.geometry.setAttribute("aInfo", new InstancedBufferAttribute(infos, 4));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  parent.add(mesh);
  return mesh;
}

export function additiveMaterial(vert: string, frag: string, extra: Record<string, unknown> = {}) {
  return new ShaderMaterial({
    uniforms: { ...U, ...extra } as never,
    vertexShader: vert,
    fragmentShader: withCommon(frag),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}
