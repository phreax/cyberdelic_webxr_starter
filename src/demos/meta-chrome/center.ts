// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import type { Color } from '@iwsdk/core';
import { defineCenterObject, shaderCenter } from '../scene-creator/center-object.js';
import { createChromePinch } from './chrome-pinch.js';
import { CHROME_PARAMS } from './meta-chrome-experience.js';
import { CHROME_QUALITY_STEPS } from './meta-chrome-material.js';

/** Same order as CHROME_GLOW_COLORS. */
const GLOW_RGB = [[0.192, 0.075, 0.788], [1, 0.072, 0.616], [0, 0.693, 0.572], [1, 0.301, 0], [1, 1, 1]] as const;

export default defineCenterObject({
  id: 'chrome',
  label: 'Meta Chrome',
  order: 60,
  assetId: 'meta-chrome',
  baseScale: 0.22,
  params: CHROME_PARAMS,
  excludedSettings: ['manipulateMode'],
  manipulable: true,
  attach: (() => {
    let manipulating = false;
    let pinch: ReturnType<typeof createChromePinch> | undefined;
    return shaderCenter({
      materialName: 'meta-chrome',
      qualitySteps: CHROME_QUALITY_STEPS,
      palette: () => 'Cosine Rainbow',
      onAttach: ({ ctx, object, uniforms }) => { pinch = createChromePinch(ctx.world, object, uniforms as never); },
      onApply: ({ uniforms }, settings) => {
        const [r, g, b] = GLOW_RGB[Math.round(settings.glowColor ?? 0)] ?? GLOW_RGB[0];
        (uniforms.uGlowColor?.value as Color | undefined)?.setRGB(r, g, b);
      },
      onUpdate: () => pinch?.update(manipulating),
      setManipulating: (_hooks, on) => { manipulating = on; if (!on) pinch?.update(false); },
    });
  })(),
});
