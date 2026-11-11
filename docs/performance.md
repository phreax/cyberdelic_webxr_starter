# Quest 3S performance

Target: **72 FPS** (≈13.9 ms/frame) on Quest 3S; 90 FPS where feasible.

## Reactive Sculpture budget

| Item | Cost | Notes |
|---|---|---|
| Sculpture | 1 draw, ~19k vertices / ~38k triangles | Vertex shader: 3 × 2-octave FBM (6 simplex) per vertex for normals. |
| Fragment | 1 pow-based fresnel, 1 specular, cosine palette | No textures, no PBR, no transparency (no overdraw). |
| Panel | UIKit batched | Meters/spectrum update at 15 Hz, only while the Audio tab is open. |
| Per frame JS | No allocation in `update()` | Uniforms written from the param store. |

Levers if a device drops frames: `SphereGeometry` segments in
`src/scene-assets/reactive-sculpture.scene-asset.ts` (160×120 → 96×72 quarters the vertex cost),
`FBM_OCTAVES` (2 → 1), and the `Complexity` range.

## Test configuration

1. Production build served over HTTPS (`npm run build && npm run preview -- --host`), Quest 3S, default IWSDK settings.
2. Enter MR, audio = Demo beat, preset *Ember* (highest complexity), sculpture filling ~30° of view.
3. Read the panel's FPS indicator (Session tab, 1 s average) or OVR Metrics Tool for 60 s.
4. Pass: ≥ 72 FPS average, no sustained drops.

## Particle Garden budget

| Item | Cost | Notes |
|---|---|---|
| Field | 1 draw, 16k points default (2k–24k via Density, drawRange, no rebuild) | Vertex: 3 simplex per particle; stateless (no simulation buffers). |
| Fragment | additive soft sprite, 6–14 mm, capped at 64 px | Overdraw is the main cost: lower Density or Particle size first. |
