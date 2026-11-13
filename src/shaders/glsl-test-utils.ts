import { spawnSync } from 'node:child_process';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import type { ShaderMaterial } from '@iwsdk/core';

/**
 * Compiles our custom ShaderMaterials with glslangValidator the way three.js (WebGL2) wraps them:
 * GLSL ES 3.00 with three's built-in uniform / attribute prefix. Catches "renders nothing" compile
 * errors without a browser. Skipped when glslangValidator is not installed.
 */
const HAS_GLSLANG = spawnSync('glslangValidator', ['--version']).status === 0;

const VERTEX_PREFIX = `#version 300 es
precision highp float;
precision highp int;
#define attribute in
#define varying out
#define texture2D texture
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
in vec3 position;
in vec3 normal;
in vec2 uv;
`;

const FRAGMENT_PREFIX = `#version 300 es
precision highp float;
precision highp int;
#define varying in
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
#define texture2D texture
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
vec4 linearToOutputTexel(vec4 value) { return value; }
vec3 toneMapping(vec3 color) { return color; }
`;

const expand = (source: string) =>
  source
    .replace(/#include <colorspace_fragment>/g, 'gl_FragColor = linearToOutputTexel( gl_FragColor );')
    .replace(/#include <tonemapping_fragment>/g, 'gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );');

const defines = (material: ShaderMaterial) =>
  Object.entries(material.defines ?? {})
    .map(([k, v]) => `#define ${k} ${v}\n`)
    .join('');

const compile = (stage: 'vert' | 'frag', source: string) => {
  const result = spawnSync('glslangValidator', ['--stdin', '-S', stage], { input: source, encoding: 'utf8' });
  return result.status === 0 ? 'ok' : (result.stdout + result.stderr).split('\n').filter((l) => l.includes('ERROR')).slice(0, 5).join('\n');
};

export const checkShaderCompiles = (material: ShaderMaterial) => ({
  vertex: compile('vert', VERTEX_PREFIX + defines(material) + expand(material.vertexShader)),
  fragment: compile('frag', FRAGMENT_PREFIX + defines(material) + expand(material.fragmentShader)),
});

/**
 * Use in a demo's `shaders.test.ts`: `describeShaderCompile({ 'my demo': createMyMaterial })`.
 */
export const describeShaderCompile = (materials: Record<string, () => ShaderMaterial>) => {
  describe.skipIf(!HAS_GLSLANG)('custom shaders compile (GLSL ES 3.00, three.js prefix)', () => {
    for (const [name, create] of Object.entries(materials)) {
      test(name, () => {
        assert({
          given: `the ${name} material`,
          should: 'compile both stages',
          actual: checkShaderCompiles(create()),
          expected: { vertex: 'ok', fragment: 'ok' },
        });
      });
    }
  });
};
