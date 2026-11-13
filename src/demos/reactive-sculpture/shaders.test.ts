import { describeShaderCompile } from '../../shaders/glsl-test-utils.js';
import { createSculptureMaterial } from './sculpture-material.js';

describeShaderCompile({
  'reactive sculpture': createSculptureMaterial,
});
