      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uTurbulence;
      uniform float uSize;
      uniform float uSparkle;
      uniform float uBurst;
      uniform float uHandRadius;
      uniform vec4 uHands[2];
      uniform vec3 uCenter;
      uniform float uHeight;
      uniform float uViewportHalfHeight;
      varying float vMix;
      varying float vGlow;
      varying float vViewDepth;
      __SIMPLEX_3D_GLSL__

      vec3 handOffset(vec3 p, vec4 hand) {
        if (hand.w == 0.0) return vec3(0.0);
        vec3 toHand = hand.xyz - p;
        float d = length(toHand);
        float f = 1.0 - smoothstep(0.0, uHandRadius, d); // mirrors garden-math.ts handForce()
        vec3 dir = toHand / max(d, 1e-4);
        // attract: pull most of the way in (not past the hand); repel: push out to the radius edge
        return hand.w > 0.0 ? dir * f * d * 0.85 : -dir * f * (uHandRadius - d) * 0.9;
      }

      void main() {
        if (aSeed.x < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        vec3 p = position;
        float t = uTime * (0.4 + aSeed.x * 0.6);
        // slow upward drift, wrapped inside the garden height
        p.y = uCenter.y - uHeight * 0.5 + mod(p.y - (uCenter.y - uHeight * 0.5) + t * 0.05 * (0.3 + aSeed.y), uHeight);
        // organic flow
        vec3 q = p * 1.4 + vec3(0.0, uTime * 0.12, 0.0);
        vec3 flow = vec3(snoise(q), snoise(q + 17.3), snoise(q + 41.1));
        p += flow * uTurbulence;
        // beat burst: radial push from the garden centre
        p += normalize(p - uCenter + 1e-4) * uBurst * 0.12 * aSeed.z;
        // hands
        float near = 0.0;
        for (int i = 0; i < 2; i++) {
          vec3 o = handOffset(p, uHands[i]);
          near = max(near, length(o));
          p += o;
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vViewDepth = -mv.z;
        vMix = fract(aSeed.w + uTime * 0.02);
        float twinkle = step(0.92 - uSparkle * 0.3, fract(aSeed.y * 13.7 + uTime * (1.0 + aSeed.x * 3.0)));
        vGlow = 0.55 + twinkle * uSparkle * 1.6 + near * 4.0;
        // world size in metres (6..14 mm) → pixels at this depth
        float worldSize = uSize * (0.006 + aSeed.z * 0.008) * (1.0 + twinkle * uSparkle);
        gl_PointSize = min(worldSize * projectionMatrix[1][1] * uViewportHalfHeight / max(-mv.z, 0.05), 64.0);
        gl_Position = projectionMatrix * mv;
      }
