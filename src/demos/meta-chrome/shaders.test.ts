// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { describeShaderCompile } from '../../shaders/glsl-test-utils.js';
import { createMetaChromeMaterial } from './meta-chrome-material.js';

describeShaderCompile({
  'meta chrome': createMetaChromeMaterial,
});
