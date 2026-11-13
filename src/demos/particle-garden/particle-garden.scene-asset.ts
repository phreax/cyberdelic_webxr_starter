import { BufferAttribute, BufferGeometry, Group, Mesh, MeshStandardMaterial, Points, TorusGeometry } from '@iwsdk/core';
import { createGardenMaterial } from './particle-material.js';
import { createParticleLayout } from './garden-math.js';

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
  // DepthSensingSystem visits Mesh children, while the visible garden uses Points.
  // A clipped three-vertex Mesh shares the particle material so the system can
  // update that material's XR depth uniforms without adding visible geometry.
  const depthBridgeGeometry = new BufferGeometry();
  depthBridgeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
  depthBridgeGeometry.setAttribute('aSeed', new BufferAttribute(new Float32Array([-1, 0, 0, 0, -1, 0, 0, 0, -1, 0, 0, 0]), 4));
  const depthBridge = new Mesh(depthBridgeGeometry, points.material);
  depthBridge.name = 'particle-garden-depth-bridge';
  depthBridge.frustumCulled = false;
  root.add(depthBridge);
  return root;
}

/** Interaction zone marker (a ring). */
export function createGardenZone(): Group {
  const ring = new Mesh(new TorusGeometry(0.09, 0.01, 12, 48), new MeshStandardMaterial({ color: '#9baeab', roughness: 0.4, emissive: '#000000' }));
  const root = new Group();
  root.add(ring);
  return root;
}
