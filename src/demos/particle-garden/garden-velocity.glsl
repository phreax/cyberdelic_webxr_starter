precision highp sampler3D;
uniform float uTime;
uniform float uDt;
uniform float uTurbulence;
uniform float uStir;
uniform float uBurst;
uniform float uHandRadius;
uniform vec4 uHands[2];
uniform vec3 uCenter;
uniform sampler3D uField;
uniform vec3 uFieldMin;
uniform vec3 uFieldSize;
uniform sampler2D uHome;
__SIMPLEX_3D_GLSL__
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 p = texture2D(texturePosition, uv);
  vec4 v = texture2D(textureVelocity, uv);
  vec3 home = texture2D(uHome, uv).xyz;
  vec3 q = p.xyz * 1.3 + vec3(0.0, uTime * 0.15, uTime * 0.05);
  vec3 flow = vec3(snoise(q), snoise(q + 17.3), snoise(q + 41.1));
  vec3 field = texture(uField, (p.xyz - uFieldMin) / uFieldSize).xyz;
  vec3 acc = flow * uTurbulence * 2.0;
  // Drag toward the stirred field velocity: particles ride the currents your hands make.
  acc += (field - v.xyz) * uStir * length(field) * 4.0;
  acc += (home - p.xyz) * 0.25;
  for (int i = 0; i < 2; i++) {
    vec4 hand = uHands[i];
    if (hand.w <= 0.0) continue; // only pinching hands attract; open hands act through the field
    vec3 toHand = hand.xyz - p.xyz;
    float d = length(toHand);
    float f = 1.0 - smoothstep(0.0, uHandRadius * 2.0, d);
    acc += toHand / max(d, 0.02) * f * 3.0;
  }
  acc += normalize(p.xyz - uCenter + 1e-4) * uBurst * 4.0;
  v.xyz += acc * uDt;
  v.xyz *= exp(-1.8 * uDt);
  gl_FragColor = v;
}
