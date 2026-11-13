// The proxy is kept at the fixed internal radius while the raymarched scene retains its scale.
uniform float uBoundsRadius;
varying vec3 vObjPos;
varying vec3 vObjCam;
varying mat3 vWorldToObject;
varying mat3 vObjectToWorld;
varying vec3 vObjectOriginWorld;
varying vec4 vDepthProjection;
void main() {
  vec3 proxyPosition = position * (uBoundsRadius / 1.4);
  vObjPos = proxyPosition;
  vec3 eyeWorld = -transpose(mat3(viewMatrix)) * viewMatrix[3].xyz;
  vObjCam = (inverse(modelMatrix) * vec4(eyeWorld, 1.0)).xyz;
  vWorldToObject = mat3(inverse(modelMatrix));
  vObjectToWorld = mat3(modelMatrix);
  vObjectOriginWorld = modelMatrix[3].xyz;
  vDepthProjection = vec4(projectionMatrix[2][2], projectionMatrix[3][2], projectionMatrix[2][3], projectionMatrix[3][3]);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(proxyPosition, 1.0);
}
