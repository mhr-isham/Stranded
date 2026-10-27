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

/** Least-squares fit of y = A sin(2πt/P) + B cos(2πt/P) + C, searching over P. */
export function sineFit(t: number[], y: number[], pMin: number, pMax: number): SineFit | null {
  const n = t.length;
  if (n < 6) return null;
  const t0 = t[0];
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
      const s = Math.sin(w * (t[i] - t0));
      const c = Math.cos(w * (t[i] - t0));
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
      const s = Math.sin(w * (t[i] - t0));
      const c = Math.cos(w * (t[i] - t0));
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
        model: (tt) => ra.sol[0] * Math.sin(wa * (tt - t0)) + ra.sol[1] * Math.cos(wa * (tt - t0)) + ra.sol[2],
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
    model: (tt) => sol[0] * Math.sin(w * (tt - t0)) + sol[1] * Math.cos(w * (tt - t0)) + sol[2],
    alternative: alt,
  };
}

function solve3(M: number[][], v: number[]): number[] | null {
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-300) return null;
  return [0, 1, 2].map((col) => det(M.map((row, i) => row.map((x, j) => (j === col ? v[i] : x)))) / D);
}
