varying vec3 vObjPos;
varying vec3 vObjCam;
varying mat3 vWorldToObject;
varying mat3 vObjectToWorld;
varying vec3 vObjectOriginWorld;
varying vec4 vDepthProjection;
__DEPTH_OCCLUSION_GLSL__
uniform float uBoundsRadius;
// Object-space ray for this eye, clipped to the mesh radius. False when the ray misses it.
bool boundedSphereRay(out vec3 ro, out vec3 rd, out float tNear, out float tFar) {
  ro = vObjCam;
  rd = normalize(vObjPos - vObjCam);
  ro.xz = -ro.xz;
  rd.xz = -rd.xz;
  float b = dot(ro, rd);
  float c = dot(ro, ro) - uBoundsRadius * uBoundsRadius;
  float h = b * b - c;
  if (h < 0.0) return false;
  h = sqrt(h);
  tNear = max(-b - h, 0.0);
  tFar = -b + h;
  return true;
}
// The raymarched SDF uses a 180-degree Y flip. Convert fixed world light directions
// into that SDF space so grabbing and rotating the sphere never rotates its lights.
vec3 boundedLightDirection(vec3 worldDirection) {
  vec3 localDirection = normalize(vWorldToObject * worldDirection);
  localDirection.xz = -localDirection.xz;
  return localDirection;
}
vec3 boundedWorldDirection(vec3 sdfDirection) {
  sdfDirection.xz = -sdfDirection.xz;
  return normalize(vObjectToWorld * sdfDirection);
}
// Compare the real depth to the raymarched hit, not the proxy sphere surface.
float boundedOcclusion(vec3 sdfPoint, float sdfScale) {
  vec3 objectPoint = sdfPoint / sdfScale;
  objectPoint.xz = -objectPoint.xz;
  vec3 worldPoint = vObjectOriginWorld + vObjectToWorld * objectPoint;
  float virtualDepth = -(viewMatrix * vec4(worldPoint, 1.0)).z;
  return depthOcclusionFactor(virtualDepth);
}
// Depth-buffer value of an SDF-space point. Written to gl_FragDepth so other geometry (snakes,
// hands, panels) sorts against the raymarched surface instead of the proxy sphere's back face.
// three only declares projectionMatrix in the vertex stage, so its depth row comes in as a varying.
float boundedFragDepth(vec3 sdfPoint, float sdfScale) {
  vec3 objectPoint = sdfPoint / sdfScale;
  objectPoint.xz = -objectPoint.xz;
  vec3 worldPoint = vObjectOriginWorld + vObjectToWorld * objectPoint;
  float viewZ = (viewMatrix * vec4(worldPoint, 1.0)).z;
  float ndcZ = (vDepthProjection.x * viewZ + vDepthProjection.y) / (vDepthProjection.z * viewZ + vDepthProjection.w);
#ifdef USE_REVERSED_DEPTH_BUFFER
  return clamp(ndcZ, 0.0, 1.0);
#else
  return clamp(ndcZ * 0.5 + 0.5, 0.0, 1.0);
#endif
}
