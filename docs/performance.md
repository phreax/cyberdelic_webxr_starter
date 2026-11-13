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
`src/demos/reactive-sculpture/reactive-sculpture.scene-asset.ts` (160×120 → 96×72 quarters the vertex cost),
`FBM_OCTAVES` (2 → 1), and the `Complexity` range.

## Test configuration

1. Production build served over HTTPS (`npm run build && npm run preview -- --host`), Quest 3S, default IWSDK settings.
2. Enter MR, audio = Demo beat, preset *Ember* (highest complexity), sculpture filling ~30° of view.
3. Read the panel's FPS indicator (Session tab, 1 s average) or OVR Metrics Tool for 60 s.
4. Pass: ≥ 72 FPS average, no sustained drops.

## Particle Garden budget

| Item | Cost | Notes |
|---|---|---|
| Simulation | 2 small GPU passes per frame on 128×128 float textures (16 384 particles) | Velocity pass: 3 simplex + one 3D texture fetch per particle. Runs with XR rendering disabled for the pass. |
| Stirred field | 12×8×12 cells on the CPU, stamped by moving hands, decayed by Field memory | Uploaded each frame as a 1 152-texel half-float 3D texture. |
| Render | 1 draw, additive soft sprites, 6–14 mm, capped at 64 px | Overdraw dominates: lower Density or Particle size first. |
| Fallback | Stateless particles (no float render targets) | Hands then warp particles instead of stirring currents. |

## Snake Creator budget

| Item | Cost | Notes |
|---|---|---|
| Snake | 1 draw, 192 × 24 grid (~9k triangles), MeshStandardMaterial | Vertex shader bends the fixed grid; curve is a 256 × 3 float texture rewritten only when the path changes. |
| Path edits | CPU resample (≤ 48 anchors × 64 steps) only while an anchor moves | |

## Raymarched demos (Cubes, Meta Chrome)

| Item | Cost | Notes |
|---|---|---|
| Raymarch | Only pixels covered by the bounding sphere; steps Low 48 / Medium 72 / High 110 | Rays march between sphere entry and exit only. |
| Shading | Normal + environment reflection at the hit | Depth comes from the hit, so occlusion stays correct. |

Cost grows with how much of the view the sphere covers: stepping back or zooming out is the cheapest win.
