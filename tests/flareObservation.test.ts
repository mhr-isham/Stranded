import { describe, expect, it } from 'vitest';
import { DAY, HOUR } from '../src/engine/constants';
import { flareAt, flaresOf } from '../src/engine/flares';
import { FLARE_SAMPLE_SECONDS, flareEvidence, flareRisk, glowSamples, readSkyGlow } from '../src/game/flareObservation';
import { world } from '../src/game/world';
import { isCloudy } from '../src/game/survival';

const sys = world(316, 'navigator', 6).system;
const step = FLARE_SAMPLE_SECONDS;

describe('flare monitor', () => {
  it('uses elapsed slots and the same onset as the optical simulation', () => {
    const first = flaresOf(sys)[0];
    const session = { start: first.start - step + .123, end: first.end + DAY, clouds: false };
    const peak = first.start + (first.end - first.start) * .15;
    expect(glowSamples(sys, session, session.start - 1)).toEqual([]);
    const available = glowSamples(sys, session, peak + step);
    expect(available.every((row) => row.at <= peak + step)).toBe(true);
    expect(available[0].glow).toBe(1);
    expect(readSkyGlow(sys, peak, false).glow).toBeGreaterThan(2);
    expect(readSkyGlow(sys, first.end - 1, false).glow).toBeLessThan(1.01);
    expect(flareEvidence([available]).onsetCount).toBe(1);
  });

  it('excludes cloudy and left-censored intervals across separate sessions', () => {
    const samples = (values: (number | null)[]) => values.map((glow, i) => ({ at: 0.123 + i * step, glow }));
    expect(flareEvidence([samples([1.5, 1.8, 1, 1, 1.8, null, 1.7, 1]), samples([1.3, 1.6])])).toEqual({
      onsetCount: 1, quietSeconds: step * 1.5, observedSeconds: step * 6,
    });
    expect(flareEvidence([samples([1]), samples([1.8])]).onsetCount).toBe(0);
    const cloudyDay = Array.from({ length: 100 }, (_, i) => DAY * i).find((t) => isCloudy(sys.seed, t))!;
    expect(readSkyGlow(sys, cloudyDay, true).glow).toBeNull();
  });

  it('keeps an upper risk bound in a quiet record and grows with window length', () => {
    const empty = { onsetCount: 0, quietSeconds: 0, observedSeconds: 0 };
    expect(flareRisk(empty, HOUR)).toBeNull();
    const quiet = { ...empty, quietSeconds: 2 * DAY };
    expect(flareRisk(quiet, DAY)!.upper).toBeCloseTo(1 - Math.sqrt(.05));
    const measured = { ...quiet, onsetCount: 2 };
    const short = flareRisk(measured, 6 * HOUR)!;
    const long = flareRisk(measured, DAY)!;
    expect(long.probability).toBeCloseTo(1 - Math.exp(-1));
    expect(short.probability).toBeLessThan(long.probability);
    expect(long.lower).toBeLessThan(long.probability);
    expect(long.upper).toBeGreaterThan(long.probability);
  });

  it('keeps an overlapping flare active after the later flare ends', () => {
    const flares = flaresOf(sys);
    const covering = flares.find((a, i) => {
      const b = flares[i + 1];
      return b && b.start < a.end && b.end < a.end && flareAt(sys, b.end) === a;
    });
    expect(covering).toBeDefined();
  });
});
