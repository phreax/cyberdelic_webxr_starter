// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describeShaderCompile } from '../../shaders/glsl-test-utils.js';
import { createCubesMaterial } from './cubes-material.js';

describeShaderCompile({
  'magic cubes': createCubesMaterial,
});
