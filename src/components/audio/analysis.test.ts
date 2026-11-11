import { describe, test } from 'vitest';
import { assert } from 'riteway/vitest';
import { bandEnergy, createBeatDetector, createOnsetDetector, rms } from './analysis.js';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 1024; // 512 bins of 46.875 Hz

/** Byte spectrum with `level` (0..255) in the bins covering [fromHz, toHz). */
const spectrumWith = (fromHz: number, toHz: number, level: number) => {
  const bins = new Uint8Array(FFT_SIZE / 2);
  const hzPerBin = SAMPLE_RATE / FFT_SIZE;
  for (let i = 0; i < bins.length; i += 1) {
    const hz = i * hzPerBin;
    if (hz >= fromHz && hz < toHz) bins[i] = level;
  }
  return bins;
};

describe('rms()', () => {
  test('volume', () => {
    assert({
      given: 'silence and a full-scale square wave',
      should: 'report 0 and 1',
      actual: [rms(new Float32Array(64)), rms(Float32Array.from({ length: 64 }, (_, i) => (i % 2 ? 1 : -1)))],
      expected: [0, 1],
    });
  });
});

describe('bandEnergy()', () => {
  test('frequency ranges', () => {
    const bassOnly = spectrumWith(20, 250, 255);
    const read = (from: number, to: number) => Math.round(bandEnergy(bassOnly, SAMPLE_RATE, FFT_SIZE, from, to) * 100) / 100;

    assert({
      given: 'energy only in the bass range',
      should: 'report full bass and no mid/high',
      actual: [read(20, 250), read(250, 2000), read(2000, 16000)],
      expected: [1, 0, 0],
    });
  });
});

describe('createOnsetDetector()', () => {
  test('rise and cooldown', () => {
    const onset = createOnsetDetector({ threshold: 0.15, cooldown: 0.08 });
    const frames = [0.1, 0.1, 0.6, 0.9, 0.2, 0.9].map((energy) => onset(energy, 0.03));

    assert({
      given: 'a sudden rise, a further rise inside the cooldown, then a later rise',
      should: 'report the first and the later onset only',
      actual: frames,
      expected: [false, false, true, false, false, true],
    });
  });
});

describe('createBeatDetector()', () => {
  test('steady energy', () => {
    const beat = createBeatDetector();
    const fired = Array.from({ length: 120 }, () => beat(0.5, 1 / 60)).some(Boolean);

    assert({
      given: 'two seconds of steady bass energy',
      should: 'not report beats',
      actual: fired,
      expected: false,
    });
  });

  test('kick pattern', () => {
    const beat = createBeatDetector();
    let count = 0;
    for (let frame = 0; frame < 240; frame += 1) {
      const kick = frame % 30 < 3 ? 0.9 : 0.1; // 2 Hz kick at 60 fps
      if (beat(kick, 1 / 60)) count += 1;
    }

    assert({
      given: 'a 2 Hz kick for four seconds',
      should: 'report roughly one beat per kick',
      actual: count >= 6 && count <= 8,
      expected: true,
    });
  });
});
