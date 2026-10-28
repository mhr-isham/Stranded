// Fitting helpers used by the analysis panels. The player chooses the data;
// the game does the arithmetic.

export { linearFit } from '../engine/solver';

export interface SineFit {
  amplitude: number;
  period: number;
  sigmaAmplitude: number;
  sigmaPeriod: number;
  rms: number;
  model: (t: number) => number;
  /**
   * A second, clearly different period that fits almost as well (period
   * aliasing from gaps in the data). Two hypotheses — more data decides.
   */
  alternative?: { period: number; amplitude: number; rssRatio: number; model: (t: number) => number };
}

/**
 * Least-squares fit of y = A sin(2πt/P − φ(t)) + B cos(2πt/P − φ(t)) + C, searching over P.
 * The optional phase φ(t) is for a moon seen from a moving viewpoint: its swing is
 * measured across our line of sight, which turns as the planet moves in our sky, so
 * the plain period of the swing is not the moon's orbital period.
 */
export function sineFit(t: number[], y: number[], pMin: number, pMax: number, phase?: (t: number) => number): SineFit | null {
  const n = t.length;
  if (n < 6) return null;
  const t0 = t[0];
  const ph0 = phase ? phase(t0) : 0;
  const arg = (w: number, tt: number) => w * (tt - t0) - (phase ? phase(tt) - ph0 : 0);
  // The phase at each data point, worked out once (the period scan uses it thousands of times).
  const phs = t.map((tt) => (phase ? phase(tt) - ph0 : 0));
  const argI = (w: number, i: number) => w * (t[i] - t0) - phs[i];
  const solve = (P: number) => {
    const w = (2 * Math.PI) / P;
    // Normal equations for [A, B, C].
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const v = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const s = Math.sin(argI(w, i));
      const c = Math.cos(argI(w, i));
      const f = [s, c, 1];
      for (let a = 0; a < 3; a++) {
        v[a] += f[a] * y[i];
        for (let b = 0; b < 3; b++) M[a][b] += f[a] * f[b];
      }
    }
    const sol = solve3(M, v);
    if (!sol) return { rss: Infinity, sol: [0, 0, 0] };
    let rss = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.sin(argI(w, i));
      const c = Math.cos(argI(w, i));
      rss += (y[i] - sol[0] * s - sol[1] * c - sol[2]) ** 2;
    }
    return { rss, sol };
  };
  // Log-spaced scan, then golden-section refinement.
  let bestP = pMin;
  let best = Infinity;
  const N = 3000;
  const scan: { P: number; r: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const P = pMin * Math.pow(pMax / pMin, i / N);
    const r = solve(P).rss;
    scan.push({ P, r });
    if (r < best) [best, bestP] = [r, P];
  }
  const k = (Math.sqrt(5) - 1) / 2;
  const refine = (P0: number) => {
    let a = P0 * Math.pow(pMax / pMin, -1 / N);
    let b = P0 * Math.pow(pMax / pMin, 1 / N);
    for (let i = 0; i < 60; i++) {
      const c = b - k * (b - a);
      const d = a + k * (b - a);
      if (solve(c).rss < solve(d).rss) b = d;
      else a = c;
    }
    return 0.5 * (a + b);
  };
  const P = refine(bestP);
  const { rss, sol } = solve(P);
  // Another local minimum at a clearly different period that fits nearly as well?
  let alt: SineFit['alternative'];
  let altBest = Infinity;
  let altP = 0;
  for (let i = 1; i < N; i++) {
    const q = scan[i];
    if (q.r < scan[i - 1].r && q.r <= scan[i + 1].r && Math.abs(Math.log(q.P / P)) > 0.15 && q.r < altBest) [altBest, altP] = [q.r, q.P];
  }
  // "Nearly as well": the extra misfit is small compared with the swing itself.
  const mean = y.reduce((a, b) => a + b, 0) / n;
  const tss = y.reduce((a, b) => a + (b - mean) ** 2, 0);
  const close = (r: number) => r < rss + 0.03 * tss;
  if (altP && close(altBest)) {
    const Pa = refine(altP);
    const ra = solve(Pa);
    if (close(ra.rss)) {
      const wa = (2 * Math.PI) / Pa;
      alt = {
        period: Pa,
        amplitude: Math.hypot(ra.sol[0], ra.sol[1]),
        rssRatio: ra.rss / Math.max(rss, 1e-30),
        model: (tt) => ra.sol[0] * Math.sin(arg(wa, tt)) + ra.sol[1] * Math.cos(arg(wa, tt)) + ra.sol[2],
      };
    }
  }
  const A = Math.hypot(sol[0], sol[1]);
  const rms = Math.sqrt(rss / Math.max(1, n - 4));
  const span = t[n - 1] - t[0];
  const sigmaF = (Math.sqrt(6) * rms) / (Math.PI * A * span * Math.sqrt(n));
  const w = (2 * Math.PI) / P;
  return {
    amplitude: A,
    period: P,
    sigmaAmplitude: rms * Math.sqrt(2 / n),
    sigmaPeriod: P * P * sigmaF,
    rms,
    model: (tt) => sol[0] * Math.sin(arg(w, tt)) + sol[1] * Math.cos(arg(w, tt)) + sol[2],
    alternative: alt,
  };
}

/**
 * A planet's tracked longitude as a smooth function of time (days): the tracker's
 * nightly log, unwrapped across 0/360° and interpolated. Used as the line-of-sight
 * phase when fitting its moon's swing.
 */
export function trackedPhase(track: { at: number; v: number }[], dayS = 86400): ((d: number) => number) | undefined {
  if (track.length < 2) return undefined;
  const ts = track.map((o) => o.at / dayS);
  const vs: number[] = [track[0].v];
  for (let i = 1; i < track.length; i++) {
    let d = track[i].v - track[i - 1].v;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    vs.push(vs[i - 1] + d);
  }
  return (d: number) => {
    let lo = 0;
    let hi = ts.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ts[m] < d) lo = m + 1;
      else hi = m;
    }
    const i = Math.min(ts.length - 1, Math.max(1, lo));
    const f = (d - ts[i - 1]) / Math.max(1e-9, ts[i] - ts[i - 1]);
    return vs[i - 1] + (vs[i] - vs[i - 1]) * f;
  };
}

/** Fit a moon's swing with the line-of-sight phase, trying both senses of orbit. */
export function moonFit(t: number[], y: number[], pMin: number, pMax: number, phase: ((d: number) => number) | undefined, envelope = false) {
  if (!phase) return sineFit(t, y, pMin, pMax);
  const f = envelope ? moonSwingFit : sineFit;
  const fits = [f(t, y, pMin, pMax, phase), f(t, y, pMin, pMax, (d) => -phase(d))].filter((q): q is SineFit => q !== null);
  return fits.sort((a, b) => a.rms - b.rms)[0] ?? null;
}

/**
 * The swing of a moon seen from a moving planet. Two real effects bend the plain
 * sine: the line of sight turns as the planet moves in our sky (the phase φ(t), from
 * its tracked longitude), and the planet's distance changes, so the swing grows and
 * shrinks. Model, with τ measured from the middle of the stretch:
 *   y = (1 + e₁τ + e₂τ²) · (A sin(2πt/P − φ) + B cos(2πt/P − φ)) + C.
 * One envelope shared by sin and cos (it can't fake a drifting phase, so the period
 * stays honest). The amplitude reported is the swing at the middle, √(A² + B²),
 * which is when the reading is dated.
 */
export function moonSwingFit(t: number[], y: number[], pMin: number, pMax: number, phase: (t: number) => number): SineFit | null {
  const n = t.length;
  if (n < 12) return null;
  const base = sineFit(t, y, pMin, pMax, phase);
  if (!base) return null;
  const mid = 0.5 * (t[0] + t[n - 1]);
  const half = Math.max(1e-9, 0.5 * (t[n - 1] - t[0]));
  const ph0 = phase(mid);
  const phs = t.map((tt) => phase(tt) - ph0);
  const us = t.map((tt) => (tt - mid) / half);
  // For one period: alternate the linear solves for (A, B, C) and for the envelope (e₁, e₂).
  const solveAt = (P: number) => {
    const w = (2 * Math.PI) / P;
    const sn = t.map((tt, i) => Math.sin(w * (tt - mid) - phs[i]));
    const cs = t.map((tt, i) => Math.cos(w * (tt - mid) - phs[i]));
    let e1 = 0;
    let e2 = 0;
    let abc = [0, 0, 0];
    for (let it = 0; it < 8; it++) {
      const env = us.map((u) => 1 + e1 * u + e2 * u * u);
      const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const v = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        const f = [env[i] * sn[i], env[i] * cs[i], 1];
        for (let a = 0; a < 3; a++) {
          v[a] += f[a] * y[i];
          for (let b = 0; b < 3; b++) M[a][b] += f[a] * f[b];
        }
      }
      const sol = solveN(M, v);
      if (!sol) return { rss: Infinity, abc, e1, e2 };
      abc = sol;
      // y − C − g = g·(e₁u + e₂u²), with g = A sin + B cos.
      const M2 = [[0, 0], [0, 0]];
      const v2 = [0, 0];
      for (let i = 0; i < n; i++) {
        const g = abc[0] * sn[i] + abc[1] * cs[i];
        const f = [g * us[i], g * us[i] * us[i]];
        const r = y[i] - abc[2] - g;
        for (let a = 0; a < 2; a++) {
          v2[a] += f[a] * r;
          for (let b = 0; b < 2; b++) M2[a][b] += f[a] * f[b];
        }
      }
      const e = solveN(M2, v2);
      if (!e) break;
      [e1, e2] = [Math.max(-0.8, Math.min(0.8, e[0])), Math.max(-0.8, Math.min(0.8, e[1]))];
    }
    let rss = 0;
    for (let i = 0; i < n; i++) {
      const g = abc[0] * sn[i] + abc[1] * cs[i];
      rss += (y[i] - abc[2] - g * (1 + e1 * us[i] + e2 * us[i] * us[i])) ** 2;
    }
    return { rss, abc, e1, e2 };
  };
  // Refine the period near the line-of-sight fit's value.
  const gr = (Math.sqrt(5) - 1) / 2;
  let a = base.period * 0.9;
  let b = base.period * 1.1;
  for (let i = 0; i < 50; i++) {
    const c = b - gr * (b - a);
    const d = a + gr * (b - a);
    if (solveAt(c).rss < solveAt(d).rss) b = d;
    else a = c;
  }
  const P = 0.5 * (a + b);
  const fit = solveAt(P);
  const A = Math.hypot(fit.abc[0], fit.abc[1]);
  const rms = Math.sqrt(fit.rss / Math.max(1, n - 6));
  const sigmaF = (Math.sqrt(6) * rms) / (Math.PI * Math.max(A, 1e-30) * 2 * half * Math.sqrt(n));
  const w = (2 * Math.PI) / P;
  return {
    amplitude: A,
    period: P,
    // The envelope widens the amplitude's error bar, and a smooth envelope only
    // approximates the changing distance: no better than ~0.6%.
    sigmaAmplitude: Math.max(1.5 * rms * Math.sqrt(2 / n), 0.006 * A),
    // The period's error bar includes the envelope's pull on it (no better than ~0.3%).
    sigmaPeriod: Math.max(P * P * sigmaF, 0.003 * P),
    rms,
    model: (tt) => {
      const u = (tt - mid) / half;
      const arg = w * (tt - mid) - (phase(tt) - ph0);
      return (1 + fit.e1 * u + fit.e2 * u * u) * (fit.abc[0] * Math.sin(arg) + fit.abc[1] * Math.cos(arg)) + fit.abc[2];
    },
    alternative: base.alternative,
  };
}

/** Gaussian elimination with partial pivoting. */
function solveN(M: number[][], v: number[]): number[] | null {
  const k = v.length;
  const A = M.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-300) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[k] / row[i]);
}

function solve3(M: number[][], v: number[]): number[] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-300) return null;
  return [0, 1, 2].map((col) => det(M.map((row, i) => row.map((x, j) => (j === col ? v[i] : x)))) / D);
}
