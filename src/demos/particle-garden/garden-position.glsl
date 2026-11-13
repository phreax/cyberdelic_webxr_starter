uniform float uDt;
uniform sampler2D uHome;
uniform vec3 uCenter;
uniform vec3 uRadius;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 p = texture2D(texturePosition, uv);
  vec4 v = texture2D(textureVelocity, uv);
  vec4 home = texture2D(uHome, uv); // w = lifetime (s)
  p.xyz += v.xyz * uDt;
  p.w += uDt;
  vec3 e = (p.xyz - uCenter) / (uRadius * 1.6);
  if (p.w > home.w || dot(e, e) > 1.0) p = vec4(home.xyz, 0.0);
  gl_FragColor = p;
}
