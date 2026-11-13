// SPDX-License-Identifier: CC-BY-NC-SA-4.0
#include <skinning_pars_vertex>
attribute float wristDist;
uniform float uFingerLength;
varying vec2 vPatternUv;
varying float vWristDist;

void main() {
  #include <skinbase_vertex>
  vec3 transformed = vec3(position);
  float fingerMask = smoothstep(.08, .16, wristDist);
  transformed *= 1. + (uFingerLength - 1.) * fingerMask;
  #include <skinning_vertex>
  vPatternUv = uv;
  vWristDist = wristDist;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.);
}
