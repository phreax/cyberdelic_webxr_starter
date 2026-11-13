      uniform float uGlow;
      uniform float uPulse;
      uniform float uAlpha;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      uniform vec3 uDeep;
      uniform vec3 uLightDir;
      uniform float uMaterial;
      uniform float uMatcapBrightness;
      uniform float uReflectionWarmth;
      uniform float uIridescence;
      uniform float uEnvironmentRotation;
      uniform float uEnvironmentIntensity;
      uniform samplerCube uEnvironment;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vRidge;
      varying float vViewDepth;
      __DEPTH_OCCLUSION_GLSL__
      __PALETTE_GLSL__

      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(vViewDir);
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 iridescent = palette(fresnel * 0.8 + vRidge * 0.4,
          vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 1.0), vec3(0.0, 0.33, 0.67));
          vec3 reflected = reflect(-V, N);
          float ec = cos(uEnvironmentRotation), es = sin(uEnvironmentRotation);
          reflected.xz = mat2(ec, -es, es, ec) * reflected.xz;
          vec3 chrome = texture(uEnvironment, reflected).rgb;
          float warmth = 2.0 * uReflectionWarmth - 1.0;
          float luminance = dot(chrome, vec3(0.2126, 0.7152, 0.0722));
          chrome = mix(vec3(luminance), chrome, 1.0 + 0.45 * warmth);
          chrome *= vec3(1.0 + 0.16 * max(warmth, 0.0), 1.0 - 0.05 * abs(warmth), 1.0 + 0.16 * max(-warmth, 0.0));
          chrome *= uEnvironmentIntensity;
          vec3 tangent = normalize(cross(abs(N.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), N));
          vec3 stretchedHalf = normalize(uLightDir + V + tangent * dot(tangent, V) * 0.35);
          float anisotropic = pow(max(dot(N, stretchedHalf), 0.0), 90.0) * 0.5;
          float grooves = 0.985 + 0.015 * sin(vRidge * 180.0 + dot(N, tangent) * 40.0);
          chrome = chrome * grooves * 1.45 + vec3(anisotropic) + vec3(fresnel * 0.22);
          if (uMaterial > 0.5) {
            // A view-space MatCap response keeps the colored lobes on the surface as it turns.
            vec3 viewN = normalize(mat3(viewMatrix) * N);
            vec2 capUV = viewN.xy * 0.5 + 0.5;
            float capA = exp(-26.0 * dot(capUV - vec2(0.25, 0.78), capUV - vec2(0.25, 0.78)));
            float capB = exp(-65.0 * dot(capUV - vec2(0.76, 0.35), capUV - vec2(0.76, 0.35)));
            vec3 capColor = iridescent * uIridescence * (0.35 + 0.25 * fresnel) + vec3(capA * 0.65 + capB * 0.3);
            vec3 matcap = mix(chrome, capColor, 0.5);
            chrome = uMatcapBrightness * matcap / (vec3(1.0) + matcap);
          }
          vec3 color = chrome;
        float alpha = clamp(uAlpha + fresnel * (1.0 - uAlpha) * 0.7, 0.0, 1.0);
        alpha *= depthOcclusionFactor(vViewDepth);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
