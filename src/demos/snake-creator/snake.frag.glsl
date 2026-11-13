// SPDX-License-Identifier: CC-BY-NC-SA-4.0
      __SNAKE_FRAGMENT_COMMON__
      __SNAKE_SPECTRAL_GLSL__
      uniform vec3 uKeyDirection;
      uniform vec3 uKeyColor;
      uniform vec3 uFillDirection;
      uniform vec3 uFillColor;
      uniform vec3 uSkyColor;
      uniform vec3 uGroundColor;
      uniform float uRoughness;
      uniform float uMetallic;
      uniform float uEnvironmentAmount;
      uniform float uIridescence;
      uniform float uGratingSpacing;
      uniform samplerCube uEnvironment;
      uniform float uEnvironmentWarmth;
      uniform float uGlow;
      uniform vec3 uGlowColor;
      uniform float uCoreGlowOnly;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldForward;
      varying float vViewDepth;
      __DEPTH_OCCLUSION_GLSL__

      vec3 snakeLight(vec3 albedo, vec3 n, vec3 v, vec3 t, vec3 l, vec3 lightColor, float shininess) {
        float diffuse = max(dot(n, l), 0.0);
        vec3 h = normalize(l + v);
        // Normalised Blinn: rough = broad and dim, smooth = small and bright.
        float specular = pow(max(dot(n, h), 0.0), shininess) * (shininess + 8.0) / 25.0 * step(0.0, dot(n, l));
        vec3 specularColor = mix(vec3(0.04), albedo, uMetallic);
        return lightColor * (albedo * (1.0 - uMetallic) * diffuse + specularColor * specular);
      }

      void main() {
        float visibility = depthOcclusionFactor(vViewDepth);
        if (visibility < 0.01) discard;
        if (uCoreGlowOnly > 0.5) {
          // A glowing core is a single emissive hue; pattern and palette belong to
          // the plug-in body around it and must not stripe the glow tube.
          gl_FragColor = vec4(uGlowColor * (0.35 + 0.85 * uGlow), visibility);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        vec4 body = snakeBodyColor(vSnakeBody);
        if (body.a < 0.5) discard;
        vec3 albedo = body.rgb;
        vec3 n = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 v = normalize(cameraPosition - vWorldPosition);
        vec3 t = normalize(vWorldForward);
        float shininess = exp2(mix(10.0, 1.5, uRoughness));
        vec3 ambient = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5) * albedo * (1.0 - 0.6 * uMetallic) * 2.0;
        vec3 color = ambient
          + snakeLight(albedo, n, v, t, uKeyDirection, uKeyColor, shininess)
          + snakeLight(albedo, n, v, t, uFillDirection, uFillColor, shininess);
        // Same palette-angle iridescence as Meta Chrome; no bright MatCap lobes.
        float iriMask = 0.3 + 0.7 * (1.0 - smoothstep(0.2, 0.8, abs(dot(n, v))));
        vec3 iri = texture(uSnakeGradient, vec2(fract(atan(n.y, n.x) / 6.2831853), 0.5)).rgb
          * iriMask * 1.4 * uIridescence;
        float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 reflection = texture(uEnvironment, reflect(-v, n)).rgb;
        float warmth = 2.0 * uEnvironmentWarmth - 1.0;
        float luminance = dot(reflection, vec3(0.2126, 0.7152, 0.0722));
        reflection = mix(vec3(luminance), reflection, 1.0 + 0.45 * warmth);
        reflection *= vec3(1.0 + 0.16 * max(warmth, 0.0), 1.0 - 0.05 * abs(warmth), 1.0 + 0.16 * max(-warmth, 0.0));
        color = mix(color, reflection * mix(vec3(1.0), albedo, 0.25) * 1.35,
          uEnvironmentAmount * (1.0 - uRoughness * 0.55));
        color += iri;
        color += uGlowColor * uGlow * (0.4 + 0.6 * fresnel);
        gl_FragColor = vec4(color, visibility);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
