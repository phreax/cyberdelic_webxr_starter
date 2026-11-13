uniform bool occlusionEnabled;
uniform highp sampler2DArray uXRDepthTextureArray;
uniform float uRawValueToMeters;
uniform bool uIsGPUDepth;
uniform float uDepthNear;
uniform vec2 uViewportSize;
uniform float uOcclusionBlurRadius;
uniform bool uOcclusionHardMode;
uniform bool uOcclusionMinMaxMode;
uniform sampler2D uMinMaxTexture0;
uniform sampler2D uMinMaxTexture1;
#ifndef VIEW_ID
#define VIEW_ID 0
#endif
float realDepthMeters(vec2 uv) {
  float value = texture(uXRDepthTextureArray, vec3(uv, float(VIEW_ID))).r;
  return uIsGPUDepth ? uRawValueToMeters * uDepthNear / max(1.0 - value, 0.00001)
                     : value * uRawValueToMeters;
}
float depthOcclusionFactor(float virtualDepth) {
  if (!occlusionEnabled) return 1.0;
  vec2 screenUV = gl_FragCoord.xy / uViewportSize;
  vec2 depthUV = uIsGPUDepth ? screenUV : vec2(screenUV.x, 1.0 - screenUV.y);
  if (uOcclusionMinMaxMode) {
    vec4 mm = uint(VIEW_ID) == 0u ? texture(uMinMaxTexture0, depthUV) : texture(uMinMaxTexture1, depthUV);
    float fadeRange = max(virtualDepth * 0.04, 0.001);
    vec3 depths = vec3(mm.r, mm.g, mm.r + mm.b);
    vec3 alphas = clamp((depths - virtualDepth) / fadeRange, 0.0, 1.0);
    float result = alphas.z;
    if (alphas.y - alphas.x > 0.03) {
      float mixValue = mm.a > 0.001 ? mm.b / mm.a : 0.5;
      result = mix(alphas.x, alphas.y, smoothstep(0.2, 0.8, mixValue));
    }
    return result;
  }
  float center = smoothstep(0.0, 0.05, realDepthMeters(depthUV) - virtualDepth);
  if (uOcclusionHardMode) return center;
  vec2 stepUV = uOcclusionBlurRadius / uViewportSize;
  float neighbors = smoothstep(0.0, 0.05, realDepthMeters(depthUV + vec2(stepUV.x, 0.0)) - virtualDepth)
                  + smoothstep(0.0, 0.05, realDepthMeters(depthUV - vec2(stepUV.x, 0.0)) - virtualDepth)
                  + smoothstep(0.0, 0.05, realDepthMeters(depthUV + vec2(0.0, stepUV.y)) - virtualDepth)
                  + smoothstep(0.0, 0.05, realDepthMeters(depthUV - vec2(0.0, stepUV.y)) - virtualDepth);
  return (center + neighbors) * 0.2;
}
