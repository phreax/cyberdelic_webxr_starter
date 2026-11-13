      attribute vec2 aRef;
      attribute vec4 aSeed;
      uniform sampler2D uPositions;
      uniform sampler2D uVelocities;
      uniform float uTime;
      uniform float uSize;
      uniform float uSparkle;
      uniform float uViewportHalfHeight;
      varying float vMix;
      varying float vGlow;
      void main() {
        vec4 p = texture2D(uPositions, aRef);
        vec3 v = texture2D(uVelocities, aRef).xyz;
        vec4 mv = modelViewMatrix * vec4(p.xyz, 1.0);
        vMix = fract(aSeed.w + uTime * 0.02);
        float twinkle = step(0.92 - uSparkle * 0.3, fract(aSeed.y * 13.7 + uTime * (1.0 + aSeed.x * 3.0)));
        float fadeIn = smoothstep(0.0, 0.6, p.w);
        vGlow = (0.55 + twinkle * uSparkle * 1.6 + min(length(v) * 1.5, 2.0)) * fadeIn;
        float worldSize = uSize * (0.006 + aSeed.z * 0.008) * (1.0 + twinkle * uSparkle);
        gl_PointSize = min(worldSize * projectionMatrix[1][1] * uViewportHalfHeight / max(-mv.z, 0.05), 64.0);
        gl_Position = projectionMatrix * mv;
      }
