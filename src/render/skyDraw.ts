// Draws the wide-angle sky: atmosphere, stars, the star, the blue planet and
// the landscape. Designed to stay cheap enough for phones at 60 fps.

import { DEG } from '../engine/constants';
import type { CatalogStar } from '../engine/sky';
import { css, limitingMag, mix, skyColors, type RGB } from './color';
import { dirFromAltAz, makeProjector, type Camera, type Projector } from './projection';
import type { Scene } from './scene';
import type { Landscape } from './terrain';

export interface SkyOptions {
  realTime: number; // ms, drives twinkle (atmospheric, not game time)
  starColor: RGB; // colour of the system's star
  starAngularRadius: number;
  showGround?: boolean;
  showEcliptic?: boolean;
  eclipticDirs?: [number, number, number][];
  highlightTarget?: boolean;
  dpr: number;
}

export function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, scene: Scene, catalog: CatalogStar[], land: Landscape | null, o: SkyOptions): Projector {
  const P = makeProjector(cam);
  const { w, h } = cam;
  const sunAlt = scene.sunAltDeg;
  const col = skyColors(sunAlt);

  // Atmosphere: vertical gradient keyed to projected altitudes.
  const yH = P.project(dirFromAltAz(0, cam.az))?.y ?? h;
  const yZ = P.project(dirFromAltAz(Math.min(cam.alt + cam.fov * 0.6, 89 * DEG), cam.az))?.y ?? 0;
  const g = ctx.createLinearGradient(0, Math.min(yZ, yH - 1), 0, yH);
  g.addColorStop(0, css(col.zenith));
  g.addColorStop(0.75, css(mix(col.zenith, col.horizon, 0.55)));
  g.addColorStop(1, css(col.horizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Glow around the star (also lights the horizon during twilight).
  const sp = P.project(scene.sun);
  if (sp && sunAlt > -18) {
    const strength = Math.max(0, Math.min(1, (sunAlt + 18) / 24));
    const rad = P.scale * (sunAlt > 0 ? 0.6 : 0.9);
    const glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, rad);
    const warm: RGB = sunAlt > 8 ? [255, 250, 235] : [255, 190, 130];
    glow.addColorStop(0, css(warm, 0.55 * strength));
    glow.addColorStop(0.25, css(warm, 0.18 * strength));
    glow.addColorStop(1, css(warm, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  // Milky Way: faint, only under a properly dark sky.
  const lim = limitingMag(sunAlt);
  if (lim > 4.5) {
    const a0 = Math.min(1, (lim - 4.5) / 1.9) * 0.16;
    const m = scene.milky;
    const sz = Math.max(1, o.dpr * Math.min(2.2, P.scale / 700));
    ctx.fillStyle = 'rgb(200,210,255)';
    const p = { x: 0, y: 0 };
    for (let i = 0; i < m.length; i += 4) {
      if (m[i + 2] < 0) continue;
      if (!P.projectXYZ(m[i], m[i + 1], m[i + 2], p) || p.x < 0 || p.y < 0 || p.x > w || p.y > h) continue;
      ctx.globalAlpha = a0 * m[i + 3];
      ctx.fillRect(p.x, p.y, sz * 1.6, sz * 1.6);
    }
    ctx.globalAlpha = 1;
  }

  // Background stars.
  if (lim > -1) {
    const tw = o.realTime / 1000;
    const s = scene.stars;
    const p = { x: 0, y: 0 };
    const sizeK = o.dpr * Math.min(1.6, Math.max(0.7, P.scale / 900));
    for (let i = 0; i < catalog.length; i++) {
      const st = catalog[i];
      if (st.mag > lim) continue;
      const up = s[i * 3 + 2];
      if (up < -0.05) continue;
      if (!P.projectXYZ(s[i * 3], s[i * 3 + 1], up, p) || p.x < -4 || p.y < -4 || p.x > w + 4 || p.y > h + 4) continue;
      // Scintillation grows near the horizon where the air path is longer.
      const air = 1 / Math.max(0.12, up);
      const twinkle = 1 + Math.min(0.6, 0.12 * air) * Math.sin(tw * (7 + (i % 5)) + st.twinklePhase) * Math.sin(tw * 2.3 + i);
      const a = Math.max(0, Math.min(1, (lim - st.mag) / 2.2)) * twinkle;
      const r = Math.max(0.55, 1.9 - 0.32 * st.mag) * sizeK;
      const c = st.color;
      ctx.fillStyle = `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${Math.min(1, a)})`;
      if (r < 1.1) ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Ecliptic guide line.
  if (o.showEcliptic && o.eclipticDirs) {
    ctx.strokeStyle = 'rgba(255,214,140,0.28)';
    ctx.setLineDash([4 * o.dpr, 6 * o.dpr]);
    ctx.lineWidth = o.dpr;
    ctx.beginPath();
    let pen = false;
    for (const d of o.eclipticDirs) {
      const p = P.project(d);
      if (!p || p.z < 0) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(p.x, p.y);
      else ctx.moveTo(p.x, p.y);
      pen = true;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The blue planet: a steady point that never twinkles.
  const tp = P.project(scene.target);
  if (tp && lim > 0.5) {
    const a = Math.max(0, Math.min(1, (lim - 0.5) / 2));
    const r = 2.1 * o.dpr;
    const halo = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, r * 4);
    halo.addColorStop(0, `rgba(170,215,255,${0.9 * a})`);
    halo.addColorStop(0.3, `rgba(120,180,255,${0.25 * a})`);
    halo.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(tp.x - r * 4, tp.y - r * 4, r * 8, r * 8);
    ctx.fillStyle = `rgba(215,236,255,${a})`;
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // The star itself.
  if (sp) {
    const rDisk = Math.max(3 * o.dpr, o.starAngularRadius * P.scale);
    const bloom = ctx.createRadialGradient(sp.x, sp.y, rDisk * 0.5, sp.x, sp.y, rDisk * 6);
    bloom.addColorStop(0, css(mix(o.starColor, [255, 255, 255], 0.6), 0.9));
    bloom.addColorStop(1, css(o.starColor, 0));
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, rDisk * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(mix(o.starColor, [255, 255, 255], 0.8));
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, rDisk, 0, Math.PI * 2);
    ctx.fill();
  }

  if (land && o.showGround !== false) drawLandscape(ctx, P, cam, land, col.ground, col.horizon, sunAlt);
  return P;
}

function drawLandscape(ctx: CanvasRenderingContext2D, P: Projector, cam: Camera, land: Landscape, ground: RGB, horizon: RGB, sunAlt: number) {
  const span = cam.fov * 0.85 + 0.3;
  const steps = 160;
  for (const ridge of land.ridges) {
    const c = mix(ground, horizon, ridge.haze * 0.55 * (sunAlt > -8 ? 1 : 0.5));
    ctx.fillStyle = css(c);
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= steps; i++) {
      const az = cam.az - span + (2 * span * i) / steps;
      const p = P.project(dirFromAltAz(ridge.alt(az), az));
      if (!p) continue;
      if (first) {
        ctx.moveTo(p.x, p.y);
        first = false;
      } else ctx.lineTo(p.x, p.y);
    }
    const bl = P.project(dirFromAltAz(-60 * DEG, cam.az + span));
    const br = P.project(dirFromAltAz(-60 * DEG, cam.az - span));
    ctx.lineTo(bl ? bl.x : cam.w * 2, cam.h * 3);
    ctx.lineTo(br ? br.x : -cam.w, cam.h * 3);
    ctx.closePath();
    ctx.fill();
  }
}

/** Ecliptic great circle as local directions (for the guide line). */
export function eclipticCircle(scene: Scene, n = 180): [number, number, number][] {
  const { east, north, up } = scene.frame;
  const out: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = [Math.cos(a), Math.sin(a), 0];
    out.push([
      d[0] * east[0] + d[1] * east[1],
      d[0] * north[0] + d[1] * north[1],
      d[0] * up[0] + d[1] * up[1],
    ]);
  }
  return out;
}
