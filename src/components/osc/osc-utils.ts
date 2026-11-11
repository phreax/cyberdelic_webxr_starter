/** Pure OSC helpers: address pattern matching (OSC 1.0), value normalisation, reconnect backoff. */

const partToRegExp = (part: string): RegExp => {
  let source = '';
  for (let i = 0; i < part.length; i += 1) {
    const char = part[i]!;
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (char === '[') {
      const end = part.indexOf(']', i);
      if (end < 0) source += '\\[';
      else {
        const body = part.slice(i + 1, end).replace(/^!/, '^').replace(/\\/g, '\\\\');
        source += `[${body}]`;
        i = end;
      }
    } else if (char === '{') {
      const end = part.indexOf('}', i);
      if (end < 0) source += '\\{';
      else {
        const options = part.slice(i + 1, end).split(',').map((o) => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        source += `(?:${options.join('|')})`;
        i = end;
      }
    } else source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
};

export const matchAddress = (pattern: string, address: string): boolean => {
  if (pattern === address) return true;
  const patternParts = pattern.split('/');
  const addressParts = address.split('/');
  if (patternParts.length !== addressParts.length) return false;
  return patternParts.every((part, i) => partToRegExp(part).test(addressParts[i]!));
};

export const normalizeInput = (
  value: number,
  [inMin, inMax]: readonly [number, number],
  [outMin, outMax]: readonly [number, number],
): number => {
  const t = inMax === inMin ? 0 : Math.min(1, Math.max(0, (value - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
};

export const reconnectDelay = (attempt: number, { base = 500, max = 8000 } = {}): number =>
  Math.min(max, base * 2 ** Math.max(0, attempt));
