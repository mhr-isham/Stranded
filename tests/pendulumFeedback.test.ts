import { describe, expect, it } from 'vitest';
import { earthGravityComparison, pendulumReading, swingTimingBudget } from '../src/game/pendulumFeedback';

describe('hand-timed pendulum interpretation', () => {
  it('recovers standard Earth gravity from a one-metre, 2.006-second pendulum', () => {
    const reading = pendulumReading(1, 40.121, 20)!;
    expect(reading.period).toBeCloseTo(2.00605, 5);
    expect(reading.gravity).toBeCloseTo(9.81, 2);
    // A counting mistake remains a player measurement, without truth correction.
    expect(pendulumReading(1, 40.121, 10)!.gravity).toBeCloseTo(reading.gravity / 4, 5);
  });
  it('spreads the same whole-interval timing error across more swings', () => {
    expect(swingTimingBudget(2, 1, .2)).toEqual({ duration: 2, periodError: .2, fraction: .1 });
    expect(swingTimingBudget(2, 20, .2)).toEqual({ duration: 40, periodError: .01, fraction: .005 });
    const measured = swingTimingBudget(3.5, 10, .4)!;
    expect(measured.duration).toBe(35);
    expect(measured.periodError).toBe(.04);
    expect(measured.fraction).toBeCloseTo(.4 / 35);
  });
  it('rejects invalid timing, counting and numerical overflow rather than saving nonfinite gravity', () => {
    for (const args of [[0, 2, 1], [1, 0, 1], [1, -1, 1], [1, NaN, 1], [1, 2, Infinity], [1, 2, 1.5], [1, 2, 0], [1, 2, Number.MAX_SAFE_INTEGER + 1], [1, 1e-300, 1]]) {
      expect(pendulumReading(args[0], args[1], args[2])).toBeNull();
    }
    for (const args of [[0, 20, .2], [2, 1.5, .2], [2, 20, 0], [2, 20, NaN], [1e308, 20, .2], [1e-300, 20, 1e308]]) {
      expect(swingTimingBudget(args[0], args[1], args[2])).toBeNull();
    }
  });
  it('scales player gravity and the stated uncertainty to Earth weight without changing mass', () => {
    expect(earthGravityComparison(4.905, .4905)!.ratio).toBe(.5);
    expect(earthGravityComparison(4.905, .4905)!.ratioSigma).toBeCloseTo(.05);
    expect(earthGravityComparison(19.62, 1.962)!.ratio).toBe(2);
    expect(earthGravityComparison(19.62, 1.962)!.ratioSigma).toBeCloseTo(.2);
    expect(earthGravityComparison(9.81)!.ratioSigma).toBeUndefined();
    expect(earthGravityComparison(9.81, NaN)!.ratioSigma).toBeUndefined();
    for (const value of [0, -1, Infinity, NaN, 1e308]) expect(earthGravityComparison(value)).toBeNull();
  });
});
