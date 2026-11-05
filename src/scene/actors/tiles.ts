import { Group, type InstancedMesh, MathUtils, Matrix4, Vector3 } from "three";
import { DIE_SM_H, PAIR_POS, SEL_TILE_LOCAL, TILE_SIZE } from "../layout";
import { makeBoxes } from "../materials";
import { S } from "../state";

/** The selected output tile: lifts off C, flies to its CTA pair on the die, locks in. */
export function createSelectedTile(mats: Group) {
  const group = new Group();
  const mesh: InstancedMesh = makeBoxes(
    [{ pos: [0, 0, 0], size: [1, 1, 1], color: "#ffe6a8", info: [7, 0, 0.05, 0] }],
    group,
    30,
  );
  const start = new Vector3();
  const end = PAIR_POS.clone().setZ(0.26);
  const tmp = new Vector3();
  const m = new Matrix4();

  function update() {
    const p = MathUtils.clamp(S.tileFly, 0, 1);
    mats.updateMatrixWorld();
    start.copy(SEL_TILE_LOCAL).setZ(0.03).applyMatrix4(mats.matrixWorld);
    tmp.lerpVectors(start, end, MathUtils.smootherstep(p, 0, 1));
    tmp.z += Math.sin(Math.PI * p) * 2.6;
    const sx = MathUtils.lerp(TILE_SIZE * S.matScale, 0.95, p);
    const sy = MathUtils.lerp(TILE_SIZE * S.matScale, DIE_SM_H, p);
    const sz = MathUtils.lerp(0.1 * S.matScale, 0.08, p);
    m.makeScale(sx, sy, sz).setPosition(tmp);
    mesh.setMatrixAt(0, m);
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { group, update };
}
