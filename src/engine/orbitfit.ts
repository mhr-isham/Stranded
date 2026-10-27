// Kepler's method (chapter 4): find the blue planet's ellipse from nothing but
// its direction in our sky, night after night, seen from our own moving planet.
// Our orbit is a circle we already know (period P₁; at the opposition tOpp our
// planet points the same way as the blue planet). Five numbers are fitted:
// the blue planet's period, the shape and direction of its ellipse, and where
// both planets were at tOpp. Distances come out in units of our own orbit.

import { TAU } from './constants';
import { keplerState, meanLonForTrue } from './ephemeris';

export interface OrbitObs {
  t: number;
  lon: number; // blue planet's ecliptic longitude in our sky (rad)
}

export interface OrbitFit {
  P2: number;
  e: number;
  /** Perihelion direction measured from our planet's direction at tOpp (rad). */
  wPeri: number;
  sigmaP2: number;
  sigmaE: number;
  sigmaW: number;
  /** RMS misfit (rad). */
  rms: number;
  /** Heliocentric path of the fitted orbit and our circle, in units of a₁, model frame. */
  orbit: (t: number) => [number, number];
  home: (t: number) => [number, number];
  /** Predicted sky longitude (rad, absolute frame). */
  predict: (t: number) => number;
  /** Rotation from the model frame to the sky frame (our planet's direction at tOpp). */
  lambda0: number;
  /** The fitted opposition nearest tOpp (when both planets point the same way), and its error. */
  tOppFit: number;
  sigmaTOpp: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type X = [number, number, number, number, number]; // P2, k = e cos ϖ, h = e sin ϖ, L0 (blue planet's true longitude at tOpp), λ0 (ours)

function model(x: X, P1: number, tOpp: number) {
  const [P2, k, h, L0, l0] = x;
  const e = Math.min(0.95, Math.hypot(k, h));
  const peri = Math.atan2(h, k);
  const ratio = (Math.abs(P2) / P1) ** (2 / 3);
  const m0 = meanLonForTrue(e, peri, L0);
  const target = (t: number) => keplerState(ratio, P2, e, peri, m0 + (TAU * (t - tOpp)) / P2)[0];
  const home = (t: number): [number, number] => {
    const L = l0 + (TAU * (t - tOpp)) / P1;
    return [Math.cos(L), Math.sin(L)];
  };
  const lon = (t: number) => {
    const r2 = target(t);
    const r1 = home(t);
    return Math.atan2(r2[1] - r1[1], r2[0] - r1[0]);
  };
  return { e, peri, target, home, lon };
}

/** Solve A x = b for a small symmetric system (Gaussian elimination with pivoting). */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

function invert(A: number[][]): number[][] | null {
  const n = A.length;
  const cols: number[][] = [];
  for (let j = 0; j < n; j++) {
    const col = solve(A, A.map((_, i) => (i === j ? 1 : 0)));
    if (!col) return null;
    cols.push(col);
  }
  return A.map((_, i) => cols.map((c) => c[i]));
}

/**
 * Fit the ellipse. Needs a long arc: at least ~12 nights spread over a good
 * part of the blue planet's orbit, or the fit is poorly constrained.
 */
export function fitOrbit(obs: OrbitObs[], P1: number, tOpp: number, P2guess?: number, circle = false): OrbitFit | null {
  if (obs.length < 8) return null;
  const resid = (x: X) => {
    const m = model(x, P1, tOpp);
    return obs.map((o) => wrap(o.lon - m.lon(o.t)));
  };
  const rss = (x: X) => resid(x).reduce((a, r) => a + r * r, 0);
  // Where the blue planet was seen nearest tOpp: both planets point that way at opposition.
  const near = obs.reduce((b, o) => (Math.abs(o.t - tOpp) < Math.abs(b.t - tOpp) ? o : b), obs[0]);
  const lam = near.lon;
  const starts: number[] = P2guess ? [P2guess] : [];
  if (!P2guess) for (let f = 1.35; f <= 3.6; f *= 1.06) starts.push(f * P1);
  let best: { x: X; r: number } | null = null;
  for (const P2 of starts) {
    for (const ph of [0, 2.1, 4.2]) {
      if (circle && ph) continue;
      const e0 = circle ? 0 : 0.05;
      let x: X = [P2, e0 * Math.cos(ph), e0 * Math.sin(ph), lam, lam];
      let r = rss(x);
      let mu = 1e-3;
      for (let it = 0; it < 40; it++) {
        const r0 = resid(x);
        const steps = [P2 * 1e-5, 1e-5, 1e-5, 1e-6, 1e-6];
        const J = obs.map(() => [0, 0, 0, 0, 0]);
        for (let j = 0; j < 5; j++) {
          const xp = [...x] as X;
          xp[j] += steps[j];
          const rp = resid(xp);
          for (let i = 0; i < obs.length; i++) J[i][j] = -(wrap(rp[i] - r0[i]) / steps[j]);
        }
        if (circle) for (const row of J) row[1] = row[2] = 0;
        const JTJ = [0, 1, 2, 3, 4].map((a) => [0, 1, 2, 3, 4].map((b) => J.reduce((s, row) => s + row[a] * row[b], 0)));
        const JTr = [0, 1, 2, 3, 4].map((a) => J.reduce((s, row, i) => s + row[a] * r0[i], 0));
        // A circle: hold e at zero (keep the system solvable).
        if (circle) for (const j of [1, 2]) JTJ[j][j] = 1;
        let improved = false;
        for (let tries = 0; tries < 8 && !improved; tries++) {
          const A = JTJ.map((row, i) => row.map((v, j) => (i === j ? v * (1 + mu) : v)));
          const dx = solve(A, JTr);
          if (!dx) break;
          const xn = x.map((v, i) => v + dx[i]) as X;
          const rn = rss(xn);
          if (rn < r) {
            [x, r] = [xn, rn];
            mu = Math.max(1e-9, mu / 4);
            improved = true;
          } else mu *= 8;
        }
        if (!improved) break;
      }
      if (!best || r < best.r) best = { x, r };
    }
  }
  if (!best) return null;
  const x = best.x;
  const n = obs.length;
  const s2 = best.r / Math.max(1, n - 5);
  // Covariance from the Jacobian at the solution.
  const r0 = resid(x);
  const steps = [x[0] * 1e-6, 1e-6, 1e-6, 1e-7, 1e-7];
  const J = obs.map(() => [0, 0, 0, 0, 0]);
  for (let j = 0; j < 5; j++) {
    const xp = [...x] as X;
    xp[j] += steps[j];
    const rp = resid(xp);
    for (let i = 0; i < n; i++) J[i][j] = -(wrap(rp[i] - r0[i]) / steps[j]);
  }
  if (circle) for (const row of J) row[1] = row[2] = 0;
  const JTJ = [0, 1, 2, 3, 4].map((a) => [0, 1, 2, 3, 4].map((b) => J.reduce((s, row) => s + row[a] * row[b], 0)));
  if (circle) for (const j of [1, 2]) JTJ[j][j] = 1e30;
  const C = invert(JTJ)?.map((row) => row.map((v) => v * s2));
  const m = model(x, P1, tOpp);
  // Outputs as functions of the parameters, for error propagation.
  const outs = [(y: X) => Math.abs(y[0]), (y: X) => Math.hypot(y[1], y[2]), (y: X) => wrap(Math.atan2(y[2], y[1]) - y[4])];
  const sig = outs.map((f) => {
    if (!C) return NaN;
    const g = [0, 1, 2, 3, 4].map((j) => {
      const h = steps[j] * 10;
      const up = [...x] as X;
      const dn = [...x] as X;
      up[j] += h;
      dn[j] -= h;
      return wrap(f(up) - f(dn)) / (2 * h);
    });
    let v = 0;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) v += g[a] * C[a][b] * g[b];
    return Math.sqrt(Math.max(0, v));
  });
  const rot = (v: [number, number] | number[], a: number): [number, number] => [v[0] * Math.cos(a) + v[1] * Math.sin(a), -v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  return {
    P2: Math.abs(x[0]),
    e: m.e,
    wPeri: wrap(m.peri - x[4]),
    // Floors for what the fit can't see: the camp sits off the planet's centre, and
    // our own year and opposition date carry errors of their own.
    sigmaP2: Math.max(sig[0], 3e-4 * Math.abs(x[0])),
    sigmaE: Math.max(sig[1], 0.002),
    sigmaW: Math.max(sig[2], 0.4 * (Math.PI / 180)),
    rms: Math.sqrt(s2),
    orbit: (t) => rot(m.target(t), x[4]),
    home: (t) => rot(m.home(t), x[4]),
    predict: m.lon,
    lambda0: x[4],
    // Opposition: the planet's longitude catches up with ours. Near tOpp the gap closes at
    // (2π/P₁ − 2π/P₂ per second, ignoring the ellipse's small speed changes).
    ...(() => {
      const rate = TAU / P1 - TAU / Math.abs(x[0]);
      const gap = wrap(x[3] - x[4]);
      // Error of the gap from the covariance of L0 and λ0.
      const vGap = C ? C[3][3] + C[4][4] - 2 * C[3][4] : NaN;
      return { tOppFit: tOpp + gap / rate, sigmaTOpp: Math.sqrt(Math.max(0, vGap)) / Math.abs(rate) };
    })(),
  };
}
