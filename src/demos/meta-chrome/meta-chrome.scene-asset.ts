// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { Group, Mesh, SphereGeometry } from '@iwsdk/core';
import { createMetaChromeMaterial } from './meta-chrome-material.js';

export function createMetaChrome(): Group {
  const mesh = new Mesh(new SphereGeometry(1.4, 32, 16), createMetaChromeMaterial());
  mesh.name = 'meta-chrome-sphere';
  mesh.frustumCulled = false; // The vertex shader changes the proxy radius at runtime.
  const root = new Group();
  root.add(mesh);
  return root;
}
