// Scoring for "value ± error" entries. Based on the Gaussian log score, so an
// honest error bar is the best strategy: a tight range that misses the truth
// scores worse than a wide range that contains it.

export interface QuantityScore {
  z: number; // |error| / stated sigma
  relSigma: number; // stated sigma / |truth|
  inside: boolean;
  points: number; // <= 100, can be negative for confident misses
}

const LN_TIGHT = Math.log(1 / 0.001); // 0.1% honest error bar = 100 points
const LN_LOOSE = Math.log(1 / 0.5); // 50% error bar = 0 points

export function scoreQuantity(value: number, sigma: number, truth: number): QuantityScore {
  const relSigma = Math.max(1e-6, Math.abs(sigma / truth));
  const z = Math.abs(value - truth) / Math.max(Math.abs(sigma), 1e-30);
  const s = -Math.log(relSigma) - (z * z) / 2;
  const points = Math.min(100, Math.round((100 * (s - LN_LOOSE)) / (LN_TIGHT - LN_LOOSE)));
  return { z, relSigma, inside: z <= 1, points: Math.max(-200, points) };
}

/** Disagreement between two independent estimates of the same thing, in combined sigma. */
export const tension = (a: number, sa: number, b: number, sb: number) =>
  Math.abs(a - b) / Math.sqrt(sa * sa + sb * sb);

export interface RunGrade {
  letter: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  total: number;
}

export function gradeRun(opts: { measurementPoints: number; fuelLeftFraction: number; daysLeftFraction: number; hintsUsed: number; success: boolean; penalty?: number; predictionPoints?: number }): RunGrade {
  const total = Math.round(
    opts.measurementPoints * 0.6 +
      0.5 * (opts.predictionPoints ?? 0) +
      (opts.success ? 200 + 400 * Math.max(0, opts.fuelLeftFraction) + 100 * Math.max(0, opts.daysLeftFraction) : 0) -
      25 * opts.hintsUsed -
      (opts.penalty ?? 0),
  );
  const letter = !opts.success ? 'F' : total > 1100 ? 'S' : total > 900 ? 'A' : total > 700 ? 'B' : total > 450 ? 'C' : 'D';
  return { letter, total };
}
