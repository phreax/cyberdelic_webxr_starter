import { Group, IcosahedronGeometry, Mesh } from '@iwsdk/core';
import { createHaloMaterial, createOrbMaterial, createOrbUniforms } from '../examples/placeholder/orb-material.js';

/**
 * Placeholder hero object for Phase 1: a floating noise orb (origin = centre).
 * The material's uniforms are animated by the placeholder experience.
 */
export function createCyberOrb(radius = 0.18): Group {
  const uniforms = createOrbUniforms();
  const orb = new Mesh(new IcosahedronGeometry(radius, 24), createOrbMaterial(uniforms));
  orb.name = 'cyber-orb-core';
  const halo = new Mesh(new IcosahedronGeometry(radius * 1.35, 6), createHaloMaterial(uniforms));
  halo.name = 'cyber-orb-halo';
  halo.renderOrder = 1;
  const root = new Group();
  root.add(orb, halo);
  return root;
}
