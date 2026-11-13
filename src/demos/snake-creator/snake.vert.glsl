// SPDX-License-Identifier: CC-BY-NC-SA-4.0
      __SNAKE_VERTEX_COMMON__
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vWorldForward;
      varying float vViewDepth;
      void main() {
        vec3 p, n;
        snakeDeform(position, p, n);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorldPosition = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * n);
        vWorldForward = normalize(mat3(modelMatrix) * gSnakeForward);
        vViewDepth = -(viewMatrix * world).z;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
