// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineCenterObject, qualityIndex, shaderCenter } from '../scene-creator/center-object.js';
import { SCULPTURE_PARAMS } from './reactive-sculpture-experience.js';
import { createSculptureGeometry } from './reactive-sculpture.scene-asset.js';

type SculptureGeometry = ReturnType<typeof createSculptureGeometry>;

export default defineCenterObject({
  id: 'sculpture',
  label: 'Sculpture',
  order: 10,
  assetId: 'reactive-sculpture',
  baseScale: 1,
  params: SCULPTURE_PARAMS,
  excludedSettings: ['pulse', 'reactivity'],
  attach: (() => {
    // Quality swaps the mesh resolution; level 0 is the asset's own geometry.
    const geometries: Array<SculptureGeometry | undefined> = [];
    return shaderCenter({
      materialName: 'reactive-sculpture',
      defaultSpeed: false,
      onAttach: ({ mesh }) => { geometries[0] = mesh.geometry as SculptureGeometry; },
      onApply: ({ mesh, ctx }, settings) => {
        const quality = qualityIndex(settings);
        if (quality > 0 && !geometries[quality]) geometries[quality] = ctx.track(createSculptureGeometry(0.2, quality));
        mesh.geometry = geometries[quality]!;
      },
      onUpdate: ({ uniforms, object }, dt, _elapsed, settings) => {
        if ((settings.spin ?? 0) >= 0.5) object.rotateY(dt * 0.15);
        if (uniforms.uPhase) uniforms.uPhase.value = Number(uniforms.uPhase.value ?? 0) + dt * (settings.flow ?? 0);
      },
    });
  })(),
});
