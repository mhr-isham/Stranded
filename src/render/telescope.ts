// Narrow-field telescope rendering in an ecliptic-aligned tangent plane
// (ecliptic east to the left, ecliptic north up).

import { ARCSEC, DEG, TAU } from '../engine/constants';
import { hash32, mulberry32 } from '../engine/rng';
import { cross, dot, unit, type Vec3 } from '../engine/vec';
import { css, mix, type RGB } from './color';

export interface ScopeView {
  center: Vec3; // pointing direction (ecliptic frame, unit)
  fov: number; // horizontal field of view (rad)
  w: number;
  h: number;
}

export interface ScopeProjector {
  k: number; // pixels per radian
  project(d: Vec3): { x: number; y: number } | null;
  /** Direction at a screen point. */
  unproject(x: number, y: number): Vec3;
  e1: Vec3;
  e2: Vec3;
}

export function scopeProjector(v: ScopeView): ScopeProjector {
  const c = unit(v.center);
  let e1 = cross([0, 0, 1], c);
  if (Math.hypot(...e1) < 1e-9) e1 = [1, 0, 0];
  e1 = unit(e1);
  const e2 = cross(c, e1);
  const k = v.w / (2 * Math.tan(v.fov / 2));
  return {
    k,
    e1,
    e2,
    project(d) {
      const z = dot(d, c);
      if (z <= 0) return null;
      return { x: v.w / 2 - (dot(d, e1) / z) * k, y: v.h / 2 - (dot(d, e2) / z) * k };
    },
    unproject(x, y) {
      const a = -(x - v.w / 2) / k;
      const b = -(y - v.h / 2) / k;
      return unit([c[0] + a * e1[0] + b * e2[0], c[1] + a * e1[1] + b * e2[1], c[2] + a * e1[2] + b * e2[2]]);
    },
  };
}

interface DeepStar {
  dir: Vec3;
  mag: number;
  tint: number;
}

const LEVELS = [
  { cell: 2, n: 60, m0: 5.5, m1: 9.5 },
  { cell: 0.2, n: 14, m0: 9.5, m1: 12.5 },
  { cell: 0.02, n: 4, m0: 12.5, m1: 15.5 },
  { cell: 0.003, n: 1, m0: 15.5, m1: 17 },
];

/** Faint field stars around a direction, fixed for a given seed. */
export function deepStars(seed: number, center: Vec3, radius: number): DeepStar[] {
  const lon = Math.atan2(center[1], center[0]) / DEG;
  const lat = Math.asin(Math.max(-1, Math.min(1, center[2]))) / DEG;
  const rDeg = radius / DEG;
  const out: DeepStar[] = [];
  LEVELS.forEach((L, li) => {
    const i0 = Math.floor((lon - rDeg) / L.cell);
    const i1 = Math.floor((lon + rDeg) / L.cell);
    const j0 = Math.floor((lat - rDeg) / L.cell);
    const j1 = Math.floor((lat + rDeg) / L.cell);
    // Skip levels that would need too many stars: they are too faint to matter at this zoom.
    if ((i1 - i0 + 1) * (j1 - j0 + 1) * L.n > 6000) return;
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const r = mulberry32(hash32(seed, li, i, j));
        for (let k = 0; k < L.n; k++) {
          const sl = (i + r()) * L.cell * DEG;
          const sb = (j + r()) * L.cell * DEG;
          const mag = L.m0 + (L.m1 - L.m0) * Math.pow(r(), 0.55);
          const cb = Math.cos(sb);
          out.push({ dir: [cb * Math.cos(sl), cb * Math.sin(sl), Math.sin(sb)], mag, tint: r() });
        }
      }
  });
  return out;
}

export interface ScopeScene {
  seed: number;
  sunDir: Vec3;
  sunRadius: number; // angular radius (rad)
  starColor: RGB;
  targetDir: Vec3 | null;
  targetRadius: number; // angular radius (rad)
  moonDir: Vec3 | null;
  moonRadius: number;
  skyBrightness: number; // 0 = dark night, 1 = full day
  seeing: number; // rad (FWHM)
  realTime: number; // ms
  filter: boolean; // solar filter fitted
  /** The planet is nearer than the star (an inner planet): through the filter it shows as a black dot in transit. */
  targetInFront?: boolean;
  shimmer?: { x: number; y: number }; // tip-tilt offset in rad
}

export function drawScope(ctx: CanvasRenderingContext2D, view: ScopeView, sc: ScopeScene, dpr: number): ScopeProjector {
  const P = scopeProjector(view);
  const { w, h } = view;
  const day = sc.skyBrightness;
  const bg = mix([3, 5, 10], [70, 110, 165], day);
  ctx.fillStyle = sc.filter ? '#010101' : css(bg);
  ctx.fillRect(0, 0, w, h);
  const sx = (sc.shimmer?.x ?? 0) * P.k;
  const sy = (sc.shimmer?.y ?? 0) * P.k;
  ctx.save();
  ctx.translate(sx, sy);
  const seeingPx = Math.max(1, sc.seeing * P.k);

  // Field stars (hidden by daylight and by the solar filter).
  if (!sc.filter && day < 0.6) {
    const radius = view.fov * 0.75 * Math.max(1, h / w);
    const stars = deepStars(sc.seed, view.center, radius);
    const lim = 15.5 - day * 12;
    const tw = sc.realTime / 1000;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (s.mag > lim) continue;
      const p = P.project(s.dir);
      if (!p || p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10) continue;
      const flux = Math.pow(10, -0.4 * (s.mag - lim + 2.5));
      const twinkle = 1 + 0.25 * Math.sin(tw * 9 + i * 1.7) * Math.sin(tw * 3.1 + i);
      const a = Math.min(1, flux * twinkle);
      const r = Math.max(0.8 * dpr, seeingPx * 0.5 * (0.6 + Math.min(1.6, flux * 0.6)));
      const tint: RGB = s.tint < 0.3 ? [255, 214, 170] : s.tint > 0.85 ? [180, 205, 255] : [245, 245, 255];
      if (r <= 1.5 * dpr) {
        ctx.fillStyle = css(tint, a);
        ctx.fillRect(p.x - r, p.y - r, 2 * r, 2 * r);
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2);
        g.addColorStop(0, css(tint, a));
        g.addColorStop(0.45, css(tint, a * 0.35));
        g.addColorStop(1, css(tint, 0));
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r * 2, p.y - r * 2, r * 4, r * 4);
      }
    }
  }

  // The star (only safe with the filter; without it, glare floods the view).
  const sp = P.project(sc.sunDir);
  if (sp) {
    const r = sc.sunRadius * P.k;
    if (sc.filter) drawFilteredStar(ctx, sp.x, sp.y, r, sc.seed);
    else if (sp.x > -r * 4 && sp.x < w + r * 4 && sp.y > -r * 4 && sp.y < h + r * 4) {
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.97)';
      ctx.fillRect(0, 0, w, h);
      return P;
    }
  }

  // A transit: the planet's silhouette against the filtered star.
  if (sc.filter && sc.targetInFront && sc.targetDir) {
    const p = P.project(sc.targetDir);
    if (p) {
      ctx.fillStyle = '#050403';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.6 * dpr, sc.targetRadius * P.k), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Blue planet.
  if (sc.targetDir && !sc.filter) {
    const p = P.project(sc.targetDir);
    if (p) drawPlanet(ctx, p.x, p.y, sc.targetRadius * P.k, seeingPx, sc.realTime, dpr, day);
  }
  // Its moon: grey, too small to resolve.
  if (sc.moonDir && !sc.filter) {
    const p = P.project(sc.moonDir);
    if (p) {
      const r = Math.max(0.9 * dpr, sc.moonRadius * P.k, seeingPx * 0.45);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2);
      g.addColorStop(0, `rgba(220,215,205,${0.85 - day * 0.6})`);
      g.addColorStop(1, 'rgba(220,215,205,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r * 2, p.y - r * 2, r * 4, r * 4);
    }
  }
  ctx.restore();

  // Optical vignette.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  return P;
}

function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seeingPx: number, now: number, dpr: number, day: number) {
  if (r < 1.5 * dpr) {
    const rr = Math.max(1.4 * dpr, seeingPx * 0.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.5);
    g.addColorStop(0, 'rgba(225,240,255,1)');
    g.addColorStop(0.35, 'rgba(140,195,255,0.6)');
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rr * 2.5, y - rr * 2.5, rr * 5, rr * 5);
    return;
  }
  ctx.save();
  // Seeing halo.
  const halo = ctx.createRadialGradient(x, y, r * 0.9, x, y, r + seeingPx * 1.2);
  halo.addColorStop(0, 'rgba(120,180,255,0.35)');
  halo.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r + seeingPx * 1.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  const ocean = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  ocean.addColorStop(0, '#7ec8ff');
  ocean.addColorStop(0.6, '#2f7fd0');
  ocean.addColorStop(1, '#0d2c5a');
  ctx.fillStyle = ocean;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  // Continents and cloud bands, slowly rotating.
  const rot = now / 60000;
  const rnd = mulberry32(99);
  for (let i = 0; i < 7; i++) {
    const lon = rnd() * TAU + rot;
    const lat = (rnd() - 0.5) * 1.6;
    const vis = Math.cos(lon);
    if (vis < -0.1) continue;
    const cx = x + Math.sin(lon) * Math.cos(lat) * r;
    const cy = y - Math.sin(lat) * r;
    ctx.fillStyle = `rgba(${i % 3 === 0 ? '96,140,86' : '120,150,100'},${0.55 * Math.max(0, vis)})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * (0.18 + rnd() * 0.2) * Math.max(0.2, vis), r * (0.1 + rnd() * 0.14), 0, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.lineWidth = r * 0.07;
  for (let i = -3; i <= 3; i++) {
    const yy = y + (i / 3.5) * r * 0.9;
    ctx.beginPath();
    ctx.moveTo(x - r, yy + Math.sin(rot * 3 + i) * r * 0.05);
    ctx.bezierCurveTo(x - r * 0.3, yy - r * 0.08, x + r * 0.3, yy + r * 0.08, x + r, yy);
    ctx.stroke();
  }
  // Limb darkening + atmosphere.
  const limb = ctx.createRadialGradient(x, y, r * 0.55, x, y, r);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(0.85, 'rgba(10,25,60,0.35)');
  limb.addColorStop(1, 'rgba(150,200,255,0.6)');
  ctx.fillStyle = limb;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
  // Soft edge from seeing.
  ctx.strokeStyle = 'rgba(140,195,255,0.25)';
  ctx.lineWidth = Math.max(1, seeingPx * 0.6);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  void day;
  void dpr;
}

function drawFilteredStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#ffcf73');
  g.addColorStop(0.7, '#f19a33');
  g.addColorStop(1, '#a8501a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  const rnd = mulberry32(seed ^ 0x5017);
  ctx.fillStyle = 'rgba(60,20,5,0.75)';
  for (let i = 0; i < 4; i++) {
    const a = rnd() * TAU;
    const d = rnd() * 0.7 * r;
    const s = (0.02 + rnd() * 0.04) * r;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, s, 0, TAU);
    ctx.fill();
  }
}

export const SEEING = 1.2 * ARCSEC;
