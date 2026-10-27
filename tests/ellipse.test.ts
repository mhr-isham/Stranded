import { describe, expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { deriveAll, truthValues, keysFor, type Primaries } from '../src/engine/chain';
import { keplerState, leadAngle, meanLonForTrue, oppositions } from '../src/engine/ephemeris';
import { fitOrbit } from '../src/engine/orbitfit';
import { targetLongitude } from '../src/engine/measure';
import { generateSystem } from '../src/engine/system';

describe('chapter 4: elliptical orbits', () => {
  const sys = generateSystem(5, 'navigator', 4);
  it('keplerState hits the requested true longitude', () => {
    const m = meanLonForTrue(0.3, 1.1, 2.5);
    const [r] = keplerState(1, 1, 0.3, 1.1, m);
    expect(Math.atan2(r[1], r[0])).toBeCloseTo(2.5, 9);
  });
  it('oppositions are uneven and real', () => {
    const o = oppositions(sys, 0, sys.lifeSupport);
    expect(o.length).toBeGreaterThanOrEqual(2);
    for (const t of o) expect(Math.min(leadAngle(sys, t), 2 * Math.PI - leadAngle(sys, t))).toBeLessThan(1e-6);
    expect(Math.abs(o[1] - o[0] - sys.synodic)).toBeGreaterThan(DAY);
  });
  it('the chain reproduces the truth from true primaries', () => {
    const o = oppositions(sys, 0, sys.lifeSupport)[1];
    const tr = truthValues(sys, { tOpp: { value: o, sigma: 1 } });
    const p: Primaries = {};
    for (const k of keysFor('ellipse')) p[k] = { value: tr[k], sigma: 0, at: k === 'dPar' || k === 'alpha2' || k === 'thetaM' ? o : undefined };
    const d = deriveAll(p, 'ellipse');
    expect(d.a1!.value / sys.home.a).toBeCloseTo(1, 4);
    expect(d.a2!.value / sys.target.a).toBeCloseTo(1, 4);
  });
  it('the orbit fit recovers the ellipse from directions alone', () => {
    const o = oppositions(sys, 0, sys.lifeSupport);
    const obs = [];
    for (let d = 3; d < o[1] / DAY + 20; d += 4) obs.push({ t: d * DAY, lon: targetLongitude(sys, d * DAY, sys.site) });
    const f = fitOrbit(obs, sys.home.period, o[1])!;
    expect(f.P2 / sys.target.period).toBeCloseTo(1, 3);
    expect(f.e).toBeCloseTo(sys.target.e!, 2);
    const c = fitOrbit(obs, sys.home.period, o[1], undefined, true)!;
    expect(c.rms).toBeGreaterThan(20 * f.rms);
    void DEG;
  });
});
