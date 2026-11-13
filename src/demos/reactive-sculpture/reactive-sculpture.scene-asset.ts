import { Group, Mesh, SphereGeometry } from '@iwsdk/core';
import { createSculptureMaterial } from './sculpture-material.js';

/**
 * Reactive Sculpture hero object (origin = centre). Indexed UV sphere, ~19k vertices: the vertex
 * shader carries the form, so the budget is vertices × 3 FBM evaluations (Quest 3S safe).
 */
export const SCULPTURE_SEGMENTS = [[160, 120], [224, 168], [256, 192]] as const;

export function createSculptureGeometry(radius: number, quality = 0): SphereGeometry {
  const [width, height] = SCULPTURE_SEGMENTS[quality] ?? SCULPTURE_SEGMENTS[0];
  const geometry = new SphereGeometry(radius, width, height);
  // The shader grows the form outward; enlarge bounds so frustum culling never clips it.
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius = radius * 1.8;
  return geometry;
}

export function createReactiveSculpture(radius = 0.2): Group {
  const geometry = createSculptureGeometry(radius);
  const mesh = new Mesh(geometry, createSculptureMaterial());
  mesh.name = 'reactive-sculpture-mesh';
  const root = new Group();
  root.add(mesh);
  return root;
}
