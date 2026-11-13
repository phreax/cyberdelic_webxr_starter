// World-locked projection onto detected room surfaces.
uniform float uAlpha;
varying vec3 vWorldPosition;
__PATTERNED_VISION_GLSL__

void main() {
  vec3 normal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
  vec3 axis = abs(normal);
  vec2 uv = axis.x > axis.y && axis.x > axis.z ? vWorldPosition.yz :
            axis.y > axis.z ? vWorldPosition.xz : vWorldPosition.xy;
  vec3 color = patternedVisionColor(uv);
  gl_FragColor = vec4(color, uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
