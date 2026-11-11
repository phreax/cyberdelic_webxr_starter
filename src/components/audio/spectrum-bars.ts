/** Aggregate a byte spectrum into `count` log-spaced bars (0..1), for compact visualisers. */
export const spectrumBars = (spectrum: ArrayLike<number>, count: number, out: number[] = new Array(count).fill(0)): number[] => {
  const bins = spectrum.length;
  for (let bar = 0; bar < count; bar += 1) {
    const from = Math.floor(bins ** (bar / count)) - 1;
    const to = Math.max(from + 1, Math.floor(bins ** ((bar + 1) / count)) - 1);
    let sum = 0;
    for (let i = Math.max(0, from); i < to; i += 1) sum += spectrum[i]!;
    out[bar] = sum / ((to - Math.max(0, from)) * 255);
  }
  return out;
};
