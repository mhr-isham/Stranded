import { describe, expect, it } from 'vitest';
import { DAY, HOUR } from '../src/engine/constants';
import { horizonDip } from '../src/engine/measure';
import { windAt, windBiases, rawHumidK, humidK, instrumentHumidK, humidityCalibration, affectedReadings } from '../src/game/anomalies';
import { conditionUncertainty, correctHorizon } from '../src/game/measurementEnvironment';
import type { GameState, Reading } from '../src/game/store';

const state = (difficulty: 'cadet' | 'astronomer' = 'astronomer') => ({ seed: 42, settings: { difficulty, survival: false, sound: false, formulas: true, rulesetVersion: 3 } });
const reading = (patch: Partial<Reading> = {}): Reading => ({ id: '1', key: 'R1', at: 0, value: 6e6, kept: true, note: '', ...patch });
const episode = (test: (at: number) => boolean) => {
  for (let day = 0; day < 300; day++) if (test(day * DAY)) return day * DAY;
  throw Error('No test episode found');
};

describe('manageable environmental conditions', () => {
  it('lets a windscreen remove the modeled steady crosswind without changing gravity', () => {
    const s = state();
    const at = episode((t) => windAt(s, t) > 6);
    expect(windBiases(s, at)).toBe(true);
    expect(windBiases(s, at, true)).toBe(false);
    expect(windAt(s, at)).toBeGreaterThan(6); // the weather itself is unchanged
    const easy = state('cadet');
    const easyAt = episode((t) => windAt(easy, t) > 6);
    expect(windBiases(easy, easyAt)).toBe(false); // labeled ECHO stabilization
  });

  it('exposes apparent humidity in new easy runs while retaining legacy compensated sights', () => {
    const easy = state('cadet');
    const at = episode((t) => rawHumidK(easy, t) > 0);
    expect(instrumentHumidK(easy, at)).toBeGreaterThan(0);
    expect(humidK(easy, at)).toBe(0);
    expect(instrumentHumidK({ ...easy, settings: { ...easy.settings, rulesetVersion: 2 } }, at)).toBe(0);
    expect(rawHumidK(easy, at + 13 * HOUR)).toBe(0);
  });

  it('provides an uncertain repeatable local calibration rather than an exact global atmosphere', () => {
    const s = state();
    for (let day = 0; day < 30; day++) {
      const at = day * DAY;
      const c = humidityCalibration(s, at);
      expect(Math.abs(c.k - rawHumidK(s, at))).toBeLessThan(c.sigmaK);
      expect(humidityCalibration(s, at + HOUR)).toEqual(c);
    }
    // The same local sample cannot remove a persistent thick-air layer.
    const radius = 6e6, height = 800, trueK = .6;
    const rawAngle = horizonDip(radius, height) * Math.sqrt(1 - trueK);
    const localOnly = correctHorizon(height, rawAngle, .15, .02)!;
    expect(localOnly.radius).toBeGreaterThan(radius * 1.5);
  });
});

describe('refraction correction and uncertainty', () => {
  it('recovers a radius from an apparent angle only when a justified coefficient is supplied', () => {
    const radius = 6e6, height = 800, k = .2;
    const apparent = horizonDip(radius, height) * Math.sqrt(1 - k);
    expect(correctHorizon(height, apparent)!.radius).toBeGreaterThan(radius * 1.2);
    expect(correctHorizon(height, apparent, k)!.radius).toBeCloseTo(radius, 3);
    expect(correctHorizon(height, apparent, .1)!.radius).not.toBeCloseTo(radius, -3);
  });

  it('propagates the entered coefficient uncertainty into radius units', () => {
    const height = 800, apparent = .015, k = .2, sigma = .01, delta = 1e-6;
    const result = correctHorizon(height, apparent, k, sigma)!;
    const derivative = (correctHorizon(height, apparent, k + delta)!.radius - correctHorizon(height, apparent, k - delta)!.radius) / (2 * delta);
    expect(result.sigmaValue).toBeCloseTo(Math.abs(derivative) * sigma, 3);
    expect(correctHorizon(height, apparent, k, sigma * 2)!.sigmaValue).toBeCloseTo(result.sigmaValue * 2);
  });

  it('rejects singular, non-finite and out-of-model corrections', () => {
    for (const inputs of [[0, .01, .2, .01], [800, 0, .2, .01], [800, .01, 1, .01], [800, .01, -.1, .01], [800, .01, .8, .2], [800, .01, .2, -1], [800, .01, NaN, .01], [800, 1.5, .8, .01]]) {
      expect(correctHorizon(inputs[0], inputs[1], inputs[2], inputs[3])).toBeNull();
    }
  });

  it('does not average away shared model uncertainty or include discarded readings', () => {
    const e = { instrument: 'horizon' as const, at: 0, rawValue: 7e6, horizon: { height: 800, station: 'Summit', rawAngle: .01, usedAngle: .012, damp: true, correction: { source: 'player' as const, k: .2, sigmaK: .02, sigmaValue: 120e3 } } };
    const readings = Array.from({ length: 20 }, (_, i) => reading({ id: String(i), environment: e }));
    expect(conditionUncertainty(readings)).toBe(120e3);
    readings.push(reading({ kept: false, environment: { ...e, horizon: { ...e.horizon, correction: { ...e.horizon.correction, sigmaValue: 999e3 } } } }));
    expect(conditionUncertainty(readings)).toBe(120e3);
  });

  it('uses frozen treatment records for debrief, with a legacy fallback for old readings', () => {
    const s = state();
    const at = episode((t) => windBiases(s, t));
    const exposed = reading({ id: 'exposed', key: 'g', at, environment: { instrument: 'pendulum', at, rawValue: 10, wind: { speed: windAt(s, at), protection: 'none' } } });
    const screened = reading({ ...exposed, id: 'screened', environment: { ...exposed.environment!, wind: { ...exposed.environment!.wind!, protection: 'windscreen' } } });
    const old = reading({ key: 'g', at, id: 'legacy' });
    expect(affectedReadings({ ...s, readings: [exposed, screened, old] } as GameState).map((r) => r.id)).toEqual(['exposed', 'legacy']);
  });
});
