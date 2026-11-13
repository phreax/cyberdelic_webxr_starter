      uniform float uPhase;
      uniform float uGrowth;
      uniform float uComplexity;
      uniform float uTwist;
      uniform float uPulse;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      varying float vRidge;
      varying float vViewDepth;
      __FBM_GLSL__

      vec3 twist(vec3 p, float amount) {
        float a = p.y * amount;
        float c = cos(a), s = sin(a);
        return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
      }

      // Displacement along the unit direction n (radius 1 in object space before scaling).
      float field(vec3 n) {
        vec3 q = twist(n, uTwist) * uComplexity + vec3(0.0, uPhase, uPhase * 0.6);
        float f = fbm(q);
        return f + 0.35 * abs(fbm(q * 1.9 + 4.0)) ;
      }

      vec3 grow(vec3 n, float radius) {
        float d = field(n);
        return n * radius * (1.0 + uGrowth * 0.55 * d + uPulse * 0.06);
      }

      void main() {
        float radius = length(position);
        vec3 n = normalize(position);
        vec3 helper = abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 t = normalize(cross(helper, n));
        vec3 b = cross(n, t);
        const float e = 0.012;
        vec3 p0 = grow(n, radius);
        vec3 p1 = grow(normalize(n + t * e), radius);
        vec3 p2 = grow(normalize(n + b * e), radius);
        vec3 normalO = normalize(cross(p1 - p0, p2 - p0));
        if (dot(normalO, n) < 0.0) normalO = -normalO;

        vRidge = clamp((length(p0) / radius - 1.0) / max(uGrowth * 0.55, 1e-3) * 0.5 + 0.5, 0.0, 1.0);
        vec4 world = modelMatrix * vec4(p0, 1.0);
        vNormalW = normalize(mat3(modelMatrix) * normalO);
        vViewDir = normalize(cameraPosition - world.xyz);
        vViewDepth = -(viewMatrix * world).z;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
