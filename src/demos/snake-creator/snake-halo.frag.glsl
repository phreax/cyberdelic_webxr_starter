// Cheap additive shell around the emissive center tube; no full-screen bloom pass.
uniform float uGlow;
uniform vec3 uGlowColor;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vViewDepth;
__DEPTH_OCCLUSION_GLSL__

void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float rim = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 1.5);
  float alpha = uGlow * (0.05 + 0.28 * rim) * depthOcclusionFactor(vViewDepth);
  if (alpha < 0.001) discard;
  gl_FragColor = vec4(uGlowColor * (0.6 + 0.8 * rim), alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
