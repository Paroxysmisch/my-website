import { Group, Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { MAT, MAT_POS } from "../layout";
import { withCommon } from "../materials";
import matrixFrag from "../shaders/matrix.frag.glsl?raw";
import planeVert from "../shaders/plane.vert.glsl?raw";
import { S, U } from "../state";

export const matrixMaterial = (kind: number) =>
  new ShaderMaterial({
    uniforms: { ...U, uMat: { value: kind } } as never,
    vertexShader: planeVert,
    fragmentShader: withCommon(matrixFrag),
  });

/** C = A · B as three dot-matrix slabs: A left, B top, C bottom-right (same convention as the walkthrough). */
export function createMatrices() {
  const group = new Group();
  const { S: size, gap } = MAT;
  const geo = new PlaneGeometry(size, size);
  const a = new Mesh(geo, matrixMaterial(0));
  a.position.set(-gap - size / 2, -size / 2, 0);
  const b = new Mesh(geo, matrixMaterial(1));
  b.position.set(size / 2, gap + size / 2, 0);
  const c = new Mesh(geo, matrixMaterial(2));
  c.position.set(size / 2, -size / 2, 0);
  for (const m of [a, b, c]) {
    m.frustumCulled = false;
    m.renderOrder = 20;
    group.add(m);
  }
  group.position.copy(MAT_POS);

  function update() {
    group.position.set(MAT_POS.x + S.matX, MAT_POS.y + S.matY, MAT_POS.z);
    group.scale.setScalar(S.matScale);
    group.visible = U.uMatVis.value > 0.001;
    a.visible = b.visible = U.uABVis.value > 0.001;
  }
  return { group, update, c };
}
