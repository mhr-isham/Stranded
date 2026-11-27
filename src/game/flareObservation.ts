import { DAY } from '../engine/constants';
import { flareAt } from '../engine/flares';
import type { StarSystem } from '../engine/types';
import { isCloudy } from './survival';

export const FLARE_SAMPLE_SECONDS = 15 * 60;

export interface FlareSession {
  start: number;
  end: number;
  clouds: boolean;
}

export interface GlowSample {
  at: number;
  /** Scattered light relative to a quiet sky. Null means an obscured reading. */
  glow: number | null;
}

export const FLARE_GLOW_THRESHOLD = 1.12;

/** A relative sky-glow channel at the night-side camp. The flare onset and
 * duration come from the same simulation as the optical blackout. */
export function readSkyGlow(sys: StarSystem, at: number, clouds: boolean): GlowSample {
  if (clouds && isCloudy(sys.seed, at)) return { at, glow: null };
  const flare = flareAt(sys, at);
  if (!flare) return { at, glow: 1 };
  const age = (at - flare.start) / (flare.end - flare.start);
  const profile = age < .15 ? age / .15 : ((1 - age) / .85) ** 2;
  return { at, glow: 1 + 4 * flare.peak * profile };
}

/** Reconstruct a retained session using only its elapsed sample slots. */
export function glowSamples(sys: StarSystem, session: FlareSession, now: number): GlowSample[] {
  const elapsed = Math.min(now, session.end) - session.start;
  if (!Number.isFinite(elapsed) || elapsed < 0) return [];
  return Array.from({ length: Math.floor(elapsed / FLARE_SAMPLE_SECONDS) + 1 }, (_, i) =>
    readSkyGlow(sys, session.start + i * FLARE_SAMPLE_SECONDS, session.clouds));
}

/** Count quiet-to-bright changes where both ends of one cadence are observed.
 * A session or clear spell that starts bright has an unknown onset. */
export function flareEvidence(records: readonly (readonly GlowSample[])[]) {
  let onsetCount = 0, quietSeconds = 0, observedSeconds = 0;
  for (const samples of records) {
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i], dt = b.at - a.at;
      if (a.glow === null || b.glow === null || Math.abs(dt - FLARE_SAMPLE_SECONDS) > .001) continue;
      observedSeconds += dt;
      if (a.glow >= FLARE_GLOW_THRESHOLD) continue;
      if (b.glow >= FLARE_GLOW_THRESHOLD) {
        onsetCount++;
        quietSeconds += dt / 2;
      } else quietSeconds += dt;
    }
  }
  return { onsetCount, quietSeconds, observedSeconds };
}

function poissonCdf(count: number, mean: number) {
  if (mean === 0 || mean < count - 12 * Math.sqrt(count + 1)) return 1;
  let logMass = -mean;
  for (let i = 1; i <= count; i++) logMass += Math.log(mean / i);
  let mass = Math.exp(logMass), sum = mass;
  for (let i = count; i > 0; i--) { mass *= i / mean; sum += mass; }
  return Math.min(1, sum);
}

/** Mean event count with the specified cumulative tail probability. */
function poissonMean(count: number, probability: number) {
  let lo = 0, hi = count + 12 * Math.sqrt(count + 1) + 12;
  for (let i = 0; i < 42; i++) {
    const mid = (lo + hi) / 2;
    if (poissonCdf(count, mid) > probability) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Approximate risk from onset counts using a constant-rate Poisson model.
 * Count uncertainty is the central 90% interval before the risk transform. */
export function flareRisk(evidence: ReturnType<typeof flareEvidence>, windowSeconds: number) {
  const { onsetCount, quietSeconds } = evidence;
  if (!(quietSeconds > 0 && windowSeconds > 0 && Number.isFinite(windowSeconds))) return null;
  const scale = windowSeconds / quietSeconds;
  const chance = (mean: number) => -Math.expm1(-mean * scale);
  const lower = onsetCount > 0 ? poissonMean(onsetCount - 1, .95) : 0;
  const upper = poissonMean(onsetCount, .05);
  return { probability: chance(onsetCount), lower: chance(lower), upper: chance(upper), ratePerDay: onsetCount * DAY / quietSeconds };
}
