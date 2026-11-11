# Audio input & analysis

Enable with `createExperience(world, { audio: true, ... })` → `ctx.audio`. Nothing starts until a
source is chosen from a user gesture (panel button / XR select).

| Source | Call | Notes |
|---|---|---|
| Microphone | `audio.useMicrophone()` | Asks permission; `denied` keeps the scene running. Works on Quest. |
| Playback capture | `audio.usePlaybackCapture()` | System / tab audio via `getDisplayMedia`. Desktop Chrome: tick *Share tab audio* (macOS) or *Share system audio* (Windows). Reports `unsupported` on Quest Browser. |
| Audio file | `audio.useFile(urlOrFile)` / `audio.pickFile()` | Played aloud and analysed. |
| Demo beat | `audio.useDemo()` | Built-in 120 BPM pattern to try reactivity without any input. |
| Any node | `audio.useNode(node)` | Synths, players, effects (not routed to speakers). |

Signals (0..1): `volume`, `bass`, `mid`, `high`; `onset` and `beat` are 1 on the frame they fire.
Also `audio.getSpectrum()` (byte FFT) and `audio.getWaveform()` (time domain).

Drive parameters through the store (deterministic modulation order: replace → add → multiply):

```ts
ctx.track(bindAudio(ctx.params, ctx.audio!, 'bass', 'growth', { amount: 0.5 }));                 // add 50% of range
ctx.track(bindAudio(ctx.params, ctx.audio!, 'beat', 'pulse', { mode: 'trigger', decay: 0.3 }));  // fire + decay
```
