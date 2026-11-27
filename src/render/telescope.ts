import type { SolarDisc } from '../engine/solarEclipse';
// Narrow-field telescope rendering in an ecliptic-aligned tangent plane
// (ecliptic east to the left, ecliptic north up).

import { ARCSEC, DEG, TAU } from '../engine/constants';
import { lunarExposure, type LunarLight } from '../engine/eclipse';
import { drawLunarDisk } from './lunarDisk';
import { solarGlare, type SolarGlareSource } from '../engine/solarGlare';
import { hash32, mulberry32 } from '../engine/rng';
import { cross, dot, unit, type Vec3 } from '../engine/vec';
import { css, mix, type RGB } from './color';
import type { CatalogStar } from '../engine/sky';

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
  glareSource?: SolarGlareSource;
  sunRadius: number; // angular radius (rad)
  starColor: RGB;
  targetDir: Vec3 | null;
  targetRadius: number; // angular radius (rad)
  moonDir: Vec3 | null;
  moonRadius: number;
  moonLight?: number;
  lunarLighting?: { light: LunarLight; at: number; closeUp: boolean; paused: boolean };
  skyBrightness: number; // 0 = dark night, 1 = full day
  seeing: number; // rad (FWHM)
  realTime: number; // ms
  filter: boolean; // solar filter fitted
  solarDiscs?: readonly SolarDisc[];
  /** An independent low-light camera channel, used only during totality. */
  solarCorona?: boolean;
  shimmer?: { x: number; y: number }; // tip-tilt offset in rad
  brightStars?: CatalogStar[];
  reduceFlicker?: boolean;
  targetStyle?: 'blue' | 'giant';
  extraLights?: { dir: Vec3; radius: number; style?: 'giant'; color: RGB }[];
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
    // Narrow fields reveal fainter stars; wide fields retain a readable hierarchy.
    const lim = Math.min(15.5, Math.max(8.5, 9 - 2.5 * Math.log10(view.fov / DEG / 2))) - day * 12;
    const tw = sc.realTime / 1000;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (s.mag > lim) continue;
      const p = P.project(s.dir);
      if (!p || p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10) continue;
      const flux = Math.pow(10, -0.4 * (s.mag - lim + 3));
      const twinkle = sc.reduceFlicker ? 1 : 1 + 0.25 * Math.sin(tw * 9 + i * 1.7) * Math.sin(tw * 3.1 + i);
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

  const sp = P.project(sc.sunDir);
  if (sc.filter && sp) {
    const r = sc.sunRadius * P.k;
    if (sc.solarCorona) drawSolarCorona(ctx, sp.x, sp.y, r, sc.seed);
    drawFilteredStar(ctx, sp.x, sp.y, r, sc.seed);
    // The ordinary filter shows silhouettes only against the stellar disk.
    ctx.save();
    if (!sc.solarCorona) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r, 0, TAU);
      ctx.clip();
    }
    ctx.fillStyle = '#050403';
    for (const disc of sc.solarDiscs ?? []) {
      const p = P.project(disc.direction);
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, disc.radius * P.k, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Preserve the bright stars selected in the wide view at narrow fields too.
  if (!sc.filter && day < .6) for (const star of sc.brightStars ?? []) {
    if (star.mag > 5.5) continue;
    const p = P.project(star.dir);
    if (!p || p.x < -12 || p.y < -12 || p.x > w + 12 || p.y > h + 12) continue;
    const variation = sc.reduceFlicker ? 1 : 1 + .16 * Math.sin(sc.realTime / 140 + star.twinklePhase) * Math.sin(sc.realTime / 430 + star.twinklePhase);
    const r = Math.max((1.3 + Math.max(0, 2.6 - star.mag) * .25) * dpr, seeingPx * .55);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
    glow.addColorStop(0, css(star.color.map((v) => v * 255) as RGB, Math.min(1, variation * (1 - day))));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(p.x - r * 3, p.y - r * 3, r * 6, r * 6);
  }
  if (!sc.filter) for (const light of sc.extraLights ?? []) {
    const p = P.project(light.dir);
    if (!p) continue;
    if (light.style === 'giant') drawPlanet(ctx, p.x, p.y, light.radius * P.k, seeingPx, sc.realTime, dpr, day, true);
    else {
      const r = Math.max(1.2 * dpr, seeingPx * .55), glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      glow.addColorStop(0, css(light.color, 1)); glow.addColorStop(1, css(light.color, 0));
      ctx.fillStyle = glow; ctx.fillRect(p.x - r * 3, p.y - r * 3, r * 6, r * 6);
    }
  }
  // Blue planet.
  if (sc.targetDir && !sc.filter) {
    const p = P.project(sc.targetDir);
    if (p) drawPlanet(ctx, p.x, p.y, sc.targetRadius * P.k, seeingPx, sc.realTime, dpr, day, sc.targetStyle === 'giant');
  }
  const unoccluded = sc.moonLight ?? 1;
  if (sc.moonDir && !sc.filter && unoccluded > 0) {
    const p = P.project(sc.moonDir);
    if (p && p.x >= -w && p.x <= 2 * w && p.y >= -h && p.y <= 2 * h) {
      const radius = sc.moonRadius * P.k;
      const lighting = sc.lunarLighting;
      if (lighting?.closeUp && radius >= 2 * dpr) {
        ctx.save();
        const planet = unoccluded < 1 && sc.targetDir && P.project(sc.targetDir);
        if (planet) {
          ctx.beginPath();
          ctx.rect(-w, -h, 3 * w, 3 * h);
          ctx.moveTo(planet.x + sc.targetRadius * P.k, planet.y);
          ctx.arc(planet.x, planet.y, sc.targetRadius * P.k, 0, TAU);
          ctx.clip('evenodd');
        }
        drawLunarDisk(ctx, lighting.light, sc.moonDir, p.x, p.y, radius, sc.seed, lighting.at, sc.realTime, lighting.paused);
        ctx.restore();
      } else {
        const exposure = lighting ? lunarExposure(lighting.light, sc.moonDir).fraction : 1;
        const r = Math.max(.9 * dpr, radius, seeingPx * .45);
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 2 * r);
        glow.addColorStop(0, `rgba(220,215,205,${unoccluded * exposure * (.85 - day * .6)})`);
        glow.addColorStop(1, 'rgba(220,215,205,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - 2 * r, p.y - 2 * r, 4 * r, 4 * r);
      }
    }
  }
  if (!sc.filter && sc.glareSource && sc.glareSource.exposure > 0) {
    drawSolarGlare(ctx, P, sc.glareSource, sc.starColor, w, h);
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

function drawSolarGlare(ctx: CanvasRenderingContext2D, projection: ScopeProjector, source: SolarGlareSource, color: RGB, w: number, h: number) {
  const star = projection.project(source.direction);
  const diagonal = Math.hypot(w, h);
  const veil = mix([255, 245, 229], color, .24);
  const opacity = (x: number, y: number) => .94 * solarGlare(source, projection.unproject(x, y));
  if (star && Math.hypot(star.x - w / 2, star.y - h / 2) < 2 * diagonal) {
    const reach = diagonal + Math.hypot(star.x - w / 2, star.y - h / 2);
    const halo = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, reach);
    for (const stop of [0, .04, .10, .20, .36, .58, .80, 1]) halo.addColorStop(stop, css(veil, opacity(star.x + stop * reach, star.y)));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
  } else {
    // An offscreen star can still veil a narrow field.
    const level = opacity(w / 2, h / 2);
    if (level < .008) return;
    ctx.fillStyle = css(veil, level);
    ctx.fillRect(0, 0, w, h);
  }
  if (star) {
    const r = source.radius * projection.k;
    if (star.x + r >= 0 && star.x - r <= w && star.y + r >= 0 && star.y - r <= h) {
      ctx.fillStyle = css(mix(veil, [255, 255, 255], .82), Math.min(1, .85 + source.exposure));
      ctx.beginPath();
      ctx.arc(star.x, star.y, r, 0, TAU);
      ctx.fill();
    }
  }
}

function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seeingPx: number, now: number, dpr: number, day: number, giant = false) {
  if (r < 1.5 * dpr) {
    const rr = Math.max(1.4 * dpr, seeingPx * 0.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 2.5);
    g.addColorStop(0, giant ? 'rgba(255,244,222,1)' : 'rgba(225,240,255,1)');
    g.addColorStop(0.35, giant ? 'rgba(255,220,170,.6)' : 'rgba(140,195,255,0.6)');
    g.addColorStop(1, giant ? 'rgba(255,220,170,0)' : 'rgba(120,180,255,0)');
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
  ocean.addColorStop(0, giant ? '#efe0bc' : '#7ec8ff');
  ocean.addColorStop(0.6, giant ? '#c19b6d' : '#2f7fd0');
  ocean.addColorStop(1, giant ? '#67503e' : '#0d2c5a');
  ctx.fillStyle = ocean;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  // Continents and cloud bands, slowly rotating.
  const rot = now / 60000;
  const rnd = mulberry32(99);
  for (let i = 0; i < (giant ? 0 : 7); i++) {
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
  ctx.strokeStyle = giant ? 'rgba(99,65,38,.4)' : 'rgba(255,255,255,0.32)';
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

function drawSolarCorona(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  const glow = ctx.createRadialGradient(x, y, r * .94, x, y, r * 2.5);
  glow.addColorStop(0, 'rgba(228,242,250,.72)');
  glow.addColorStop(.2, 'rgba(177,211,232,.27)');
  glow.addColorStop(.53, 'rgba(126,164,197,.10)');
  glow.addColorStop(1, 'rgba(126,164,197,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 2.5 * r, y - 2.5 * r, 5 * r, 5 * r);

  const random = mulberry32(seed ^ 0x57ea);
  for (let i = 0; i < 78; i++) {
    const a = TAU * i / 78 + random() * .045;
    const span = (1.28 + .52 * Math.abs(Math.cos(a * 2.0 - .7)) + .38 * random()) * r;
    const endX = x + Math.cos(a) * span, endY = y + Math.sin(a) * span;
    const startX = x + Math.cos(a) * r, startY = y + Math.sin(a) * r;
    const streamer = ctx.createLinearGradient(startX, startY, endX, endY);
    streamer.addColorStop(0, 'rgba(226,235,247,.23)');
    streamer.addColorStop(1, 'rgba(167,188,227,0)');
    ctx.strokeStyle = streamer;
    ctx.lineWidth = Math.max(.8, r * (.012 + .022 * random()));
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(x + Math.cos(a + .09) * (span + r) / 2, y + Math.sin(a + .09) * (span + r) / 2, endX, endY);
    ctx.stroke();
  }
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
