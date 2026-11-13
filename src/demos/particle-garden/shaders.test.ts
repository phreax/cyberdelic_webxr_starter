import { describeShaderCompile } from '../../shaders/glsl-test-utils.js';
import { createGardenMaterial } from './particle-material.js';

describeShaderCompile({
  'particle garden': createGardenMaterial,
});
