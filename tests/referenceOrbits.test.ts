import { expect, it } from 'vitest';
import { AU, DAY, G } from '../src/engine/constants';
import { deriveAll, type Primaries } from '../src/engine/chain';
import { captureCost, hohmannTof, hohmannVInfArrive, hohmannVInfDepart, propagate } from '../src/engine/orbits';
import { hohmannFor, planTransfer, posAt, predictedWindows, targetState, velAt, type PlayerModel } from '../src/engine/planner';
import { add, norm, scale, sub } from '../src/engine/vec';

// Rounded mean Solar System anchors, not high-precision dated ephemerides.
// A direct solar GM avoids silently testing the engine's rounded G*M_SUN
// against the very same constants. Planet orbits are circularized here.
const MU_SUN = 1.32712440018e20;
const CASES = [
  { name: 'Mars', a: 1.523679, period: 686.98, synodic: 779.94, radius: 3389500, mu: 4.282837e13, tof: 258.866, departure: 2944.69, arrival: 2648.90, capture: 2025.90, inner: false },
  { name: 'Venus', a: .723332, period: 224.701, synodic: 583.92, radius: 6051800, mu: 3.24858592e14, tof: 146.075, departure: -2495.39, arrival: -2706.56, capture: 3056.18, inner: true },
];
const estimate = (value: number) => ({ value, sigma: Math.max(1e-9, Math.abs(value) * 1e-6) });

for (const c of CASES) {
  it(`recovers Earth–${c.name} period, scale, radius and masses from reference inputs`, () => {
    const separation = Math.abs(c.a - 1) * AU;
    const p: Primaries = { P1: estimate(365.256363 * DAY), S2: estimate(c.synodic * DAY), tOpp: estimate(0),
      dPar: { ...estimate(separation), at: 0 }, alpha2: { ...estimate(2 * Math.atan(c.radius / separation)), at: 0 },
      g: estimate(9.8203), R1: estimate(6371000) };
    const d = deriveAll(p, c.inner ? 'inner' : 'standard');
    expect(Math.abs(d.P2!.value / DAY / c.period - 1)).toBeLessThan(2e-5);
    expect(Math.abs(d.ratio!.value / c.a - 1)).toBeLessThan(3e-5);
    expect(Math.abs(d.a1!.value / AU - 1)).toBeLessThan(1e-4);
    expect(Math.abs(d.a2!.value / (c.a * AU) - 1)).toBeLessThan(1e-4);
    expect(Math.abs(d.Mstar!.value / 1.98847e30 - 1)).toBeLessThan(.001);
    expect(Math.abs(d.M1!.value / 5.9722e24 - 1)).toBeLessThan(.001);
    expect(d.R2!.value / c.radius).toBeCloseTo(1, 8);
    if (!c.inner) {
      // Phobos supplies an observed moon scale; Venus has no invented moon.
      const moon = deriveAll({ ...p, thetaM: { ...estimate(Math.atan(9376000 / separation)), at: 0 }, Pm: estimate(27552) });
      expect(Math.abs(moon.M2!.value / 6.4171e23 - 1)).toBeLessThan(.003);
    }
  });
  it(`matches circular Earth–${c.name} Hohmann and planetary-capture references`, () => {
    expect(hohmannTof(AU, c.a * AU, MU_SUN) / DAY).toBeCloseTo(c.tof, 2);
    expect(hohmannVInfDepart(AU, c.a * AU, MU_SUN)).toBeCloseTo(c.departure, 1);
    expect(hohmannVInfArrive(AU, c.a * AU, MU_SUN)).toBeCloseTo(c.arrival, 1);
    expect(captureCost(c.arrival, c.mu, c.radius * 1.3)).toBeCloseTo(c.capture, 1);
  });
  it(`plans and propagates an Earth–${c.name} transfer with the correct excess-velocity direction`, () => {
    const m = model(c.a, c.mu, c.radius), h = hohmannFor(m), window = predictedWindows(m, 0, 1000 * DAY)[0];
    const transfer = planTransfer(m, window, h.tof)!; expect(transfer).not.toBeNull();
    expect(Math.sign(transfer.plan.vInfPrograde)).toBe(c.inner ? -1 : 1);
    expect(Math.abs(transfer.plan.vInfRadial)).toBeLessThan(1);
    expect(transfer.vInfDepart).toBeCloseTo(Math.abs(c.departure), 0);
    expect(transfer.vInfArrive).toBeCloseTo(Math.abs(c.arrival), 0);
    expect(endpointMiss(m, transfer.plan.departTime, transfer.plan.tof, transfer.plan.vInfRadial, transfer.plan.vInfPrograde)).toBeLessThan(1e6);
  });
}

function model(ratio: number, muPlanet = 4.282837e13, radius = 3389500): PlayerModel {
  const P1 = 2 * Math.PI * Math.sqrt(AU ** 3 / MU_SUN), a2 = ratio * AU, P2 = 2 * Math.PI * Math.sqrt(a2 ** 3 / MU_SUN);
  return { P1, P2, S2: 1 / Math.abs(1 / P1 - 1 / P2), a1: AU, a2, Mstar: MU_SUN / G, tOpp: 0,
    M1: 3.986004418e14 / G, R1: 6371000, M2: muPlanet / G, R2: radius, inner: ratio < 1 };
}
function endpointMiss(m: PlayerModel, td: number, tof: number, radial: number, prograde: number) {
  const home = posAt(m.a1, m.P1, m, td), vHome = velAt(m.a1, m.P1, m, td);
  const v = add(vHome, add(scale(home, radial / norm(home)), scale(vHome, prograde / norm(vHome))));
  const [arrival] = propagate(home, v, tof, G * m.Mstar);
  return norm(sub(arrival, targetState(m, td + tof)[0]));
}

it('uses fitted dated ellipse positions rather than a Hohmann reference circle for the endpoint', () => {
  const ellipse: PlayerModel = { ...model(1.523679), ecc: .3, peri: .7 }, circle = { ...ellipse, ecc: 0 };
  const td = 40 * DAY, tof = 230 * DAY, transfer = planTransfer(ellipse, td, tof)!;
  expect(transfer).not.toBeNull();
  expect(endpointMiss(ellipse, td, tof, transfer.plan.vInfRadial, transfer.plan.vInfPrograde)).toBeLessThan(10000);
  expect(norm(sub(targetState(ellipse, td + tof)[0], targetState(circle, td + tof)[0]))).toBeGreaterThan(1e9);
  expect(hohmannFor(ellipse).tof).toBe(hohmannFor(circle).tof);
});
