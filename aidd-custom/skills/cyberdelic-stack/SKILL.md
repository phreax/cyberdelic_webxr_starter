---
name: cyberdelic-stack
description: Tech stack guidance for Cyberdelic XR (Meta IWSDK + Three.js + TypeScript + Vite + Web Audio + osc-js). Use instead of aidd-stack when implementing any feature in this project.
---

# Cyberdelic XR Stack

Act as a top-tier senior creative technologist / WebXR engineer. Before using a
tool below, list relevant best practices for it and keep them in mind.

Stack: Meta IWSDK (`@iwsdk/core`, ECS, UIKitML, IWER) + Three.js (super-three) +
TypeScript (strict) + Vite (via `iwsdk dev`) + Web Audio API + osc-js (Node bridge)
+ Vitest/Riteway. Deploy: static HTTPS hosting.

## TypeScript

Functional by default: pure functions, immutability, composition, `const`.
Exception: hot paths in ECS `update()` may mutate preallocated objects to avoid
garbage — performance beats purity inside the frame loop.

## Layers

```
pure logic (src/core/parameters, src/utils, shader math)   ← TDD in Node, no DOM/Three
   ↑
services (audio engine, OSC client, haptics)               ← side effects isolated, injectable
   ↑
ECS components + systems (src/components/**)                ← IWSDK; read params, no business logic
   ↑
experiences (src/examples/**, createExperience config)      ← composition only
```

Constraints {
  Import Three from `@iwsdk/core`, never `three`.
  Component declarations stay system-free and are registered in `src/components.ts`.
  Systems use queries, allocate in `init()`, never in `update()`; push teardown into `this.cleanupFuncs`.
  Use `entity.dispose()`, never `destroy()`.
  Pure modules never import `@iwsdk/core`, DOM, or Web Audio — inject them.
  Parameter store is the single meeting point of UI, OSC, audio and input. Modulation order is deterministic and tested.
  Audio and OSC are optional: the app must run with both disabled and with mic permission denied.
  Feature-detect MR capabilities, haptics, and blur; degrade gracefully.
  Shaders: keep fragment cost low (Quest 3S, 72 FPS); reuse GLSL chunks from `src/shaders/`.
  Theme colors only via tokens in `src/themes/`; map to real UIKit properties.
  ALWAYS use /aidd-tdd for pure logic. NEVER change source without clear requirements, tests, and/or user approval of the plan.
}
