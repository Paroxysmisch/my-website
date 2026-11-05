import { Group, type InstancedMesh, MathUtils, Matrix4, Vector3 } from "three";
import { PAIR_POS, SEL_TILE_LOCAL, TILE_SIZE } from "../layout";
import { makeBoxes } from "../materials";
import { S } from "../state";

/** The one selected output tile: lifts off C, flies to its CTA pair, locks in. */
export function createSelectedTile(cube: Group) {
  const group = new Group();
  const mesh: InstancedMesh = makeBoxes(
    [{ pos: [0, 0, 0], size: [1, 1, 1], color: "#fff1c9", info: [7, 0, 0.06, 0] }],
    group,
    30,
  );
  const start = new Vector3();
  const end = PAIR_POS.clone().setZ(0.24);
  const tmp = new Vector3();
  const m = new Matrix4();

  function update() {
    const p = MathUtils.clamp(S.tileFly, 0, 1);
    // Start tracks the (possibly moving / scaled) cube until the tile departs.
    cube.updateMatrixWorld();
    start
      .copy(SEL_TILE_LOCAL)
      .setZ(SEL_TILE_LOCAL.z + 0.04)
      .applyMatrix4(cube.matrixWorld);
    tmp.lerpVectors(start, end, p);
    tmp.z += Math.sin(Math.PI * p) * 3.2;
    const sx = MathUtils.lerp(TILE_SIZE * S.cubeScale, 1.52, p);
    const sy = MathUtils.lerp(TILE_SIZE * S.cubeScale, 0.72, p);
    const sz = MathUtils.lerp(0.12 * S.cubeScale, 0.12, p);
    m.makeScale(sx, sy, sz).setPosition(tmp);
    mesh.setMatrixAt(0, m);
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { group, update };
}
