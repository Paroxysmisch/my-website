attribute vec3 aColor;
attribute vec4 aInfo; // kind, idx, edgeWidth (local units), reveal id
varying vec3 vColor;
varying vec4 vInfo;
varying vec3 vNormal;
varying vec3 vP;
varying vec3 vS;
varying vec3 vWorld;

void main() {
  vColor = aColor;
  vInfo = aInfo;
  vP = position;
  mat3 im = mat3(instanceMatrix);
  vS = vec3(length(im[0]), length(im[1]), length(im[2]));
  vNormal = normalize(mat3(modelMatrix) * (im * normal / vS));
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
