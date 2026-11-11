import { Group, Mesh, SphereGeometry } from '@iwsdk/core';
import { createSculptureMaterial } from '../examples/reactive-sculpture/sculpture-material.js';

/**
 * Reactive Sculpture hero object (origin = centre). Indexed UV sphere, ~19k vertices: the vertex
 * shader carries the form, so the budget is vertices × 3 FBM evaluations (Quest 3S safe).
 */
export function createReactiveSculpture(radius = 0.2): Group {
  const geometry = new SphereGeometry(radius, 160, 120);
  // The shader grows the form outward; enlarge bounds so frustum culling never clips it.
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius = radius * 1.8;
  const mesh = new Mesh(geometry, createSculptureMaterial());
  mesh.name = 'reactive-sculpture-mesh';
  const root = new Group();
  root.add(mesh);
  return root;
}
