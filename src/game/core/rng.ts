export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  range(min: number, max: number): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);

      return Math.floor(next() * (hi - lo + 1)) + lo;
    },
    range(min: number, max: number): number {
      return next() * (max - min) + min;
    },
  };
}
