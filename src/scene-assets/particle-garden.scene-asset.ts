import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Points, TorusGeometry } from '@iwsdk/core';
import { createGardenMaterial } from '../examples/particle-garden/particle-material.js';
import { createParticleLayout } from '../examples/particle-garden/garden-math.js';

export const GARDEN_MAX_PARTICLES = 24000;
export const GARDEN_BOUNDS = { center: [0, 1.3, -1.2], radius: [1.2, 0.6, 1.0] } as const;

/**
 * Particle Garden field: deterministic layout (seed 7), positions authored in world-like
 * coordinates, so place the node at the origin. Density uses drawRange (no rebuild).
 */
export function createParticleGarden(): Group {
  const { homes, seeds } = createParticleLayout(GARDEN_MAX_PARTICLES, 7, GARDEN_BOUNDS);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(homes, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 4));
  const points = new Points(geometry, createGardenMaterial());
  points.name = 'particle-garden-points';
  points.frustumCulled = false; // positions move in the shader
  const root = new Group();
  root.add(points);
  return root;
}

/** Interaction zone marker (a ring). */
export function createGardenZone(): Group {
  const ring = new Mesh(new TorusGeometry(0.09, 0.01, 12, 48), new MeshStandardMaterial({ color: '#9baeab', roughness: 0.4, emissive: '#000000' }));
  const root = new Group();
  root.add(ring);
  return root;
}
