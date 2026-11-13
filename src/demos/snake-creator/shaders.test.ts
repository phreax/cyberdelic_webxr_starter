// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describeShaderCompile } from '../../shaders/glsl-test-utils.js';
import type { ShaderMaterial } from '@iwsdk/core';
import { createSnakeRenderer } from './snake-renderer.js';

describeShaderCompile({
  'snake (tube)': () => createSnakeRenderer().mesh.material as ShaderMaterial,
  'snake (core halo)': () => createSnakeRenderer().halo.material as ShaderMaterial,
  'snake (spheres)': () => {
    const material = createSnakeRenderer().mesh.material as ShaderMaterial;
    material.defines = { ...material.defines, SNAKE_GEOMETRY: 1 };
    return material;
  },
});
