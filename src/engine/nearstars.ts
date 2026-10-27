// Chapter 8: stellar parallax. Three nearby stars wobble against the far
// background once a year, because we watch them from a moving planet: the
// wobble's half-width p is the angle our orbit radius makes at the star, so the
// star is d = a₁ / tan p away. Each star also drifts slowly on its own (proper
// motion). Matching three distances against the Halcyon's catalogue tells us
// where we are.

import { ARCSEC, TAU } from './constants';
import { orbitAngle } from './ephemeris';
import { hash32 } from './rng';
import { starCatalog } from './sky';
import type { StarSystem } from './types';

export const LIGHT_YEAR = 9.4607e15;
const YEAR_S = 365.25 * 86400;

export interface NearStar {
  name: string;
  /** Index in the system's star catalogue (it is drawn there like any other star). */
  index: number;
  /** Ecliptic longitude (rad); the three are chosen near the ecliptic. */
  lon: number;
  /** Annual parallax (rad) and distance (m). */
  parallax: number;
  dist: number;
  /** Proper motion along the ecliptic (rad/s). */
  pm: number;
}

const NAMES = ['Kestrel', 'Wren', 'Osprey'];
const cache = new WeakMap<StarSystem, NearStar[]>();

export function nearStarsOf(sys: StarSystem): NearStar[] {
  let out = cache.get(sys);
  if (out) return out;
  out = [];
  if (sys.features.stars) {
    const cat = starCatalog(sys.seed);
    const u = (i: number, k: number) => hash32(sys.seed, i, k) / 4294967296;
    // Bright-ish stars close to the ecliptic, well apart in longitude.
    const cand = cat
      .map((c, i) => ({ i, lon: Math.atan2(c.dir[1], c.dir[0]), z: c.dir[2], mag: c.mag }))
      .filter((c) => Math.abs(c.z) < 0.12 && c.mag > 1.2 && c.mag < 3.6);
    for (const c of cand) {
      if (out.length === 3) break;
      if (out.some((o) => Math.abs(Math.atan2(Math.sin(o.lon - c.lon), Math.cos(o.lon - c.lon))) < 1.0)) continue;
      const k = out.length;
      const parallax = (0.08 + 0.37 * u(k, 0xa11)) * ARCSEC;
      out.push({
        name: NAMES[k],
        index: c.i,
        lon: c.lon,
        parallax,
        dist: sys.home.a / Math.tan(parallax),
        pm: ((u(k, 0xa12) * 2 - 1) * 0.3 * ARCSEC) / YEAR_S,
      });
    }
  }
  cache.set(sys, out);
  return out;
}

/** The star's offset along the ecliptic from where the far background says it "should" be (rad). */
export function parallaxOffset(sys: StarSystem, s: NearStar, t: number) {
  return -s.parallax * Math.sin(s.lon - orbitAngle(sys.home, t)) + s.pm * t;
}

/** The Halcyon's catalogue: four candidate places, each with distances (ly) to the three stars. One is right. */
export function catalogueOf(sys: StarSystem): { label: string; ly: number[]; truth: boolean }[] {
  const stars = nearStarsOf(sys);
  const u = (i: number, k: number) => hash32(sys.seed, i, k) / 4294967296;
  const truthAt = Math.floor(u(0, 0xca7) * 4);
  const labels = ['Sector 7 · Ashfall', 'Sector 9 · Lantern', 'Sector 12 · Tern Reach', 'Sector 4 · Cinder'];
  return labels.map((label, c) => ({
    label,
    truth: c === truthAt,
    ly: stars.map((s, i) => {
      const d = s.dist / LIGHT_YEAR;
      if (c === truthAt) return d;
      // Elsewhere: same stars, different distances (10–30% off for at least one of them).
      const f = u(c * 7 + i, 0xca8);
      const off = i === c % 3 ? 0.12 + 0.18 * f : (f - 0.5) * 0.3;
      return d * (1 + (u(c, i) < 0.5 ? -off : off));
    }),
  }));
}

export interface ParallaxFit {
  parallax: number;
  sigma: number;
  pm: number;
  model: (t: number) => number;
}

/**
 * Fit offset(t) = A sin(2πt/P₁) + B cos(2πt/P₁) + C + μt by least squares,
 * using the player's own year. The parallax is √(A² + B²).
 */
export function fitParallax(obs: { t: number; v: number }[], P1: number): ParallaxFit | null {
  const n = obs.length;
  if (n < 6) return null;
  const f = (t: number) => [Math.sin((TAU * t) / P1), Math.cos((TAU * t) / P1), 1, t / YEAR_S];
  const M = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const b = [0, 0, 0, 0];
  for (const o of obs) {
    const x = f(o.t);
    for (let i = 0; i < 4; i++) {
      b[i] += x[i] * o.v;
      for (let j = 0; j < 4; j++) M[i][j] += x[i] * x[j];
    }
  }
  const inv = invert4(M);
  if (!inv) return null;
  const c = inv.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
  let rss = 0;
  for (const o of obs) {
    const x = f(o.t);
    rss += (o.v - x.reduce((s, v, i) => s + v * c[i], 0)) ** 2;
  }
  const s2 = rss / Math.max(1, n - 4);
  const A = c[0];
  const B = c[1];
  const p = Math.hypot(A, B);
  // Error of the amplitude from the covariance of A and B.
  const vA = s2 * inv[0][0];
  const vB = s2 * inv[1][1];
  const cAB = s2 * inv[0][1];
  const varP = p > 0 ? (A * A * vA + B * B * vB + 2 * A * B * cAB) / (p * p) : vA;
  return { parallax: p, sigma: Math.sqrt(Math.max(0, varP)), pm: c[3] / YEAR_S, model: (t) => f(t).reduce((s, v, i) => s + v * c[i], 0) };
}

function invert4(A: number[][]): number[][] | null {
  const n = 4;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((r) => r.slice(n));
}

/** Which catalogue places fit the measured distances (χ² with the player's own error bars). */
export function matchCatalogue(cat: { label: string; ly: number[] }[], ly: (number | null)[], sigma: (number | null)[]) {
  return cat.map((c) => {
    let chi2 = 0;
    let n = 0;
    c.ly.forEach((d, i) => {
      if (ly[i] === null || !sigma[i]) return;
      chi2 += ((ly[i]! - d) / sigma[i]!) ** 2;
      n++;
    });
    return { label: c.label, chi2, n, ok: n === 3 && chi2 < 11.3 };
  });
}
