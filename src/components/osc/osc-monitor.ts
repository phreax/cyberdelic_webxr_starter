/** OSC monitor data (PRD §8.5): last message and per-address message rate over a sliding window. */
export type OscRecord = { address: string; args: unknown[]; time: number };

export const createOscMonitor = ({ window = 1, maxPerAddress = 512 } = {}) => {
  const times = new Map<string, number[]>();
  let last: OscRecord | undefined;

  const prune = (list: number[], now: number) => {
    let drop = 0;
    while (drop < list.length && list[drop]! < now - window) drop += 1;
    if (drop) list.splice(0, drop);
  };

  return {
    record(address: string, args: unknown[], time: number): void {
      last = { address, args, time };
      const list = times.get(address) ?? [];
      list.push(time);
      if (list.length > maxPerAddress) list.shift();
      prune(list, time);
      times.set(address, list);
    },
    stats(now: number) {
      const addresses = [...times.entries()]
        .map(([address, list]) => {
          prune(list, now);
          return { address, rate: list.length / window };
        })
        .sort((a, b) => a.address.localeCompare(b.address));
      return { last, addresses };
    },
  };
};

export type OscMonitor = ReturnType<typeof createOscMonitor>;
