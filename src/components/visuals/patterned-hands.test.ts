// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { ShaderChunk } from '@iwsdk/core';
import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';

const vertex = readFileSync(new URL('./patterned-hand.vert.glsl', import.meta.url), 'utf8');
const pattern = readFileSync(new URL('./patterned-vision-pattern.glsl', import.meta.url), 'utf8');
const fragment = readFileSync(new URL('./patterned-hand.frag.glsl', import.meta.url), 'utf8').replace('__PATTERNED_VISION_GLSL__', pattern);
const roomVertex = readFileSync(new URL('./patterned-room.vert.glsl', import.meta.url), 'utf8');
const roomFragment = readFileSync(new URL('./patterned-room.frag.glsl', import.meta.url), 'utf8').replace('__PATTERNED_VISION_GLSL__', pattern);

describe('Patterned Vision hands', () => {
  test('uses only the procedural pattern and hand skinning', () => {
    assert({
      given: 'the ported hand shader',
      should: 'avoid media, masks and audio inputs while skinning the hand',
      actual: [/#include <skinning_vertex>/.test(vertex), /uFingerLength/.test(vertex), /syn_|media|mask/i.test(fragment)],
      expected: [true, true, false],
    });
  });
  test.skipIf(spawnSync('glslangValidator', ['--version']).status !== 0)('compiles for skinned WebGL2 hands', () => {
    const expand = (source: string): string => source.replace(/#include <([a-zA-Z0-9_]+)>/g, (_, name: keyof typeof ShaderChunk) => {
      const chunk = ShaderChunk[name];
      if (!chunk) throw new Error(`Missing shader chunk ${name}`);
      return expand(chunk);
    });
    const common = '#version 300 es\nprecision highp float;\nprecision highp int;\n#define attribute in\n#define varying out\n';
    const vertPrefix = `${common}#define USE_SKINNING\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nin vec3 position;\nin vec3 normal;\nin vec2 uv;\nin vec4 skinIndex;\nin vec4 skinWeight;\n`;
    const fragPrefix = `${common.replace('#define varying out', '#define varying in')}layout(location=0) out vec4 outColor;\n#define gl_FragColor outColor\nvec3 toneMapping(vec3 c){return c;}\nvec4 linearToOutputTexel(vec4 c){return c;}\n`;
    const compile = (stage: 'vert' | 'frag', source: string) => {
      const result = spawnSync('glslangValidator', ['--stdin', '-S', stage], { input: source, encoding: 'utf8' });
      return result.status === 0 ? 'ok' : result.stdout + result.stderr;
    };
    assert({
      given: 'the patterned hand shaders with Three.js chunks',
      should: 'compile both WebGL2 stages',
      actual: [compile('vert', vertPrefix + expand(vertex)), compile('frag', fragPrefix + expand(fragment))],
      expected: ['ok', 'ok'],
    });
    const roomVertPrefix = `${common}uniform mat4 modelMatrix;\nuniform mat4 viewMatrix;\nuniform mat4 projectionMatrix;\nin vec3 position;\n`;
    assert({
      given: 'the room shader with the shared procedural pattern',
      should: 'compile both WebGL2 stages',
      actual: [compile('vert', roomVertPrefix + roomVertex), compile('frag', fragPrefix + expand(roomFragment))],
      expected: ['ok', 'ok'],
    });
  });
});
