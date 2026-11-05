import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
} from "three";
import { CUBE } from "../layout";
import { withCommon } from "../materials";
import faceFrag from "../shaders/face.frag.glsl?raw";
import lineFrag from "../shaders/line.frag.glsl?raw";
import lineVert from "../shaders/line.vert.glsl?raw";
import planeVert from "../shaders/plane.vert.glsl?raw";
import { U } from "../state";

/** The matmul cube: A on the left face, B on top, C on the front face. */
export function createMatrices() {
  const group = new Group();
  const h = CUBE / 2;
  const geo = new PlaneGeometry(CUBE, CUBE);

  const face = (kind: number) =>
    new ShaderMaterial({
      uniforms: { ...U, uFace: { value: kind } } as never,
      vertexShader: planeVert,
      fragmentShader: withCommon(faceFrag),
    });

  // C: front (+z). uv.x = column, uv.y = row (top = 1)
  const c = new Mesh(geo, face(2));
  c.position.z = h;
  // A: left (-x). Plane's local x -> world z (k), local y -> world y (row)
  const a = new Mesh(geo, face(0));
  a.rotation.y = -Math.PI / 2;
  a.position.x = -h;
  // B: top (+y). local x -> world x (col), local y -> world z (k)
  const b = new Mesh(geo, face(1));
  b.rotation.x = -Math.PI / 2;
  b.position.y = h;
  for (const m of [a, b, c]) {
    m.renderOrder = 20;
    m.frustumCulled = false;
  }
  group.add(a, b, c);

  // Iteration-space edges (copper hairlines)
  const v = [-h, h];
  const pts: number[] = [];
  for (const x of v) for (const y of v) pts.push(x, y, -h, x, y, h);
  for (const x of v) for (const z of v) pts.push(x, -h, z, x, h, z);
  for (const y of v) for (const z of v) pts.push(-h, y, z, h, y, z);
  const lg = new BufferGeometry();
  lg.setAttribute("position", new Float32BufferAttribute(pts, 3));
  const lm = new ShaderMaterial({
    uniforms: {
      uColor: { value: [0.851, 0.541, 0.306] },
      uAlpha: U.uCubeVis,
      uTime: U.uTime,
    } as never,
    vertexShader: lineVert,
    fragmentShader: withCommon(lineFrag),
  });
  const edges = new LineSegments(lg, lm);
  edges.renderOrder = 21;
  edges.frustumCulled = false;
  group.add(edges);

  return { group, faces: { a, b, c } };
}
