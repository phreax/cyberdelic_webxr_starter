// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Patterned Vision on the tracked hand geometry.
uniform float uAlpha;
varying vec2 vPatternUv;
varying float vWristDist;
__PATTERNED_VISION_GLSL__

void main() {
  vec3 color = patternedVisionColor(vPatternUv - .5);
  float wristFade = smoothstep(.03, .08, vWristDist);
  gl_FragColor = vec4(color, uAlpha * wristFade);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
