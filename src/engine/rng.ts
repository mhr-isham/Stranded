// Small deterministic PRNG so a seed always reproduces the same system.

export type Rng = {
  next(): number;
  range(min: number, max: number): number;
  normal(mean?: number, sd?: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
};

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed);
  let spare: number | null = null;
  const rng: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    normal(mean = 0, sd = 1) {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return mean + sd * s;
      }
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return mean + sd * r * Math.cos(2 * Math.PI * v);
    },
    int: (min, maxInclusive) => min + Math.floor(next() * (maxInclusive - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
  return rng;
}

/** Stable 32-bit hash for deriving sub-seeds (e.g. per sky cell). */
export function hash32(...parts: number[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    h ^= p | 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
  }
  return h >>> 0;
}
