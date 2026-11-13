// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Creative example experience — not MIT. See LICENSE-CC-BY-NC-SA.md.
/**
 * Where the body lies on the curve, in arc fractions (tail → head).
 * Open paths (as in shader-lab): one cycle carries the head in at 0 until the tail leaves at 1.
 * Closed loops: endless crawl, the whole body always on the loop; values wrap in the shader.
 */
export type CrawlSettings = {
  /** Path fractions per second. */
  speed: number;
  /** Body length as a fraction of the path. */
  length: number;
  closed: boolean;
  reverse: boolean;
};

export type Crawl = { head: number; tail: number };

export const crawlAt = (time: number, { speed, length, closed, reverse }: CrawlSettings): Crawl => {
  if (closed) {
    const phase = time * speed;
    const along = reverse ? -phase : phase;
    const tail = along - Math.floor(along);
    return reverse ? { head: tail, tail: tail + length } : { head: tail + length, tail };
  }
  const cycle = (1 + length) / Math.max(speed, 1e-4);
  const progress = (time % cycle) / cycle;
  const travel = progress * (1 + length);
  return reverse ? { head: 1 - travel, tail: 1 - travel + length } : { head: travel, tail: travel - length };
};
