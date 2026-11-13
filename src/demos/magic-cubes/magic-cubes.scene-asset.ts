// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
import { Group, Mesh, SphereGeometry } from '@iwsdk/core';
import { createCubesMaterial } from './cubes-material.js';

/** Magic Cubes bounding sphere (radius 1.5 to contain kaleidoscope folds). */
export function createMagicCubes(): Group {
  const mesh = new Mesh(new SphereGeometry(1.5, 32, 16), createCubesMaterial());
  mesh.name = 'magic-cubes-sphere';
  const root = new Group();
  root.add(mesh);
  return root;
}
