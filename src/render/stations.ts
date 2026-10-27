// Hand-drawn vector props for the camp: the crashed ship, observatory, pendulum
// rig, rover and the survey flag on the hill.

import { DEG } from '../engine/constants';
import { css, mix, type RGB } from './color';
import { dirFromAltAz, type Projector } from './projection';
import { drawStarship } from './ship';

export type StationKind = 'ship' | 'observatory' | 'pendulum' | 'rover' | 'hill' | 'workshop' | 'probe' | 'gnomon';

export interface Station {
  kind: StationKind;
  az: number;
  alt: number; // base altitude angle on the ground
  size: number; // angular height (rad)
}

export function drawStation(ctx: CanvasRenderingContext2D, P: Projector, st: Station, ground: RGB, sunAlt: number, now: number) {
  const base = P.project(dirFromAltAz(st.alt, st.az));
  if (!base || base.z < 0.2) return null;
  const s = st.size * P.scale; // pixel height
  const night = sunAlt < -6;
  const body = css(mix(ground, [8, 10, 16], 0.55));
  const edge = css(mix(ground, [255, 255, 255], night ? 0.06 : 0.18));
  const x = base.x;
  const y = base.y;
  ctx.save();
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.strokeStyle = edge;
  ctx.fillStyle = body;
  const blink = 0.5 + 0.5 * Math.sin(now / 400);

  switch (st.kind) {
    case 'ship': {
      // The same ship you flew down, standing on its legs and leaning a little on uneven ground.
      const k = Math.max(0, Math.min(1, (6 - sunAlt) / 18));
      drawStarship(ctx, x, y - 0.47 * s, -6 * DEG, s * 1.05, { now, legs: 1, shield: false, lights: sunAlt < 3, shade: 0.15 + 0.7 * k, light: 1 });
      break;
    }
    case 'observatory': {
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.rect(-0.38 * s, -0.42 * s, 0.76 * s, 0.42 * s);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -0.42 * s, 0.38 * s, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      // open slit
      ctx.fillStyle = night ? 'rgba(255,190,120,0.55)' : 'rgba(0,0,0,0.5)';
      ctx.fillRect(-0.06 * s, -0.79 * s, 0.12 * s, 0.32 * s);
      glow(ctx, 0.25 * s, -0.15 * s, Math.max(1.5, s * 0.015), [120, 255, 170], 0.6 + 0.4 * blink);
      break;
    }
    case 'pendulum': {
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(-0.35 * s, 0);
      ctx.lineTo(0, -s);
      ctx.lineTo(0.35 * s, 0);
      ctx.moveTo(0, -s);
      ctx.lineTo(0.05 * s, 0);
      ctx.stroke();
      const ang = 0.35 * Math.sin(now / 520);
      const bx = Math.sin(ang) * 0.8 * s;
      const by = -s + Math.cos(ang) * 0.8 * s;
      ctx.strokeStyle = css(mix(ground, [255, 255, 255], 0.35));
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = '#d4a556';
      ctx.beginPath();
      ctx.arc(bx, by, 0.06 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rover': {
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.roundRect(-0.5 * s, -0.55 * s, 1.0 * s, 0.38 * s, 0.06 * s);
      ctx.fill();
      ctx.stroke();
      for (const wx of [-0.34, 0, 0.34]) {
        ctx.beginPath();
        ctx.arc(wx * s, -0.12 * s, 0.12 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0.3 * s, -0.55 * s);
      ctx.lineTo(0.36 * s, -0.95 * s);
      ctx.stroke();
      glow(ctx, 0.36 * s, -0.95 * s, Math.max(1.5, s * 0.02), [255, 200, 90], blink);
      break;
    }
    case 'workshop': {
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(-0.5 * s, 0);
      ctx.lineTo(-0.5 * s, -0.45 * s);
      ctx.lineTo(0, -0.7 * s);
      ctx.lineTo(0.5 * s, -0.45 * s);
      ctx.lineTo(0.5 * s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = night ? 'rgba(255,200,120,0.7)' : 'rgba(0,0,0,0.4)';
      ctx.fillRect(-0.12 * s, -0.3 * s, 0.24 * s, 0.3 * s);
      break;
    }
    case 'probe': {
      // A small probe on its launch rail.
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(-0.4 * s, 0);
      ctx.lineTo(0.1 * s, -0.9 * s);
      ctx.stroke();
      ctx.save();
      ctx.translate(-0.05 * s, -0.55 * s);
      ctx.rotate(30 * DEG);
      ctx.beginPath();
      ctx.moveTo(-0.08 * s, 0.25 * s);
      ctx.lineTo(0.08 * s, 0.25 * s);
      ctx.lineTo(0.08 * s, -0.15 * s);
      ctx.lineTo(0, -0.3 * s);
      ctx.lineTo(-0.08 * s, -0.15 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = `rgba(108,196,255,${0.4 + 0.5 * blink})`;
      ctx.fillRect(0.05 * s, -0.95 * s, 0.05 * s, 0.05 * s);
      break;
    }
    case 'gnomon': {
      // A shadow stick with its shadow.
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, -0.02 * s, 0.7 * s, 0.04 * s);
      break;
    }
    case 'hill': {
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s);
      ctx.stroke();
      ctx.fillStyle = '#ff9b54';
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(0.45 * s, -0.85 * s);
      ctx.lineTo(0, -0.7 * s);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
  return { x, y: y - s * (st.kind === 'rover' ? 0.9 : 1.02) };
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
  g.addColorStop(0, css(c, a));
  g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = css([255, 255, 255], a);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Warm floodlight pooled on the ground around camp at night. */
export function drawCampLight(ctx: CanvasRenderingContext2D, P: Projector, az: number, sunAlt: number) {
  if (sunAlt > -3) return;
  const c = P.project(dirFromAltAz(-7 * DEG, az));
  if (!c) return;
  const k = Math.min(1, (-3 - sunAlt) / 6);
  const rx = 28 * DEG * P.scale;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(1, 0.22);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(255,190,120,${0.22 * k})`);
  g.addColorStop(0.5, `rgba(255,170,100,${0.08 * k})`);
  g.addColorStop(1, 'rgba(255,170,100,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Foreground boulders for depth. */
export function drawRocks(ctx: CanvasRenderingContext2D, P: Projector, seed: number, ground: RGB, sunAlt: number) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const col = css(mix(ground, [0, 0, 0], 0.45));
  const rim = css(mix(ground, [255, 220, 180], sunAlt > -6 ? 0.25 : 0.06));
  for (let i = 0; i < 26; i++) {
    const az = rnd() * Math.PI * 2;
    const alt = -(6 + rnd() * 26) * DEG;
    const size = (0.6 + rnd() * 2.4) * DEG * (1 + (-alt / DEG - 6) / 12);
    const p = P.project(dirFromAltAz(alt, az));
    if (!p || p.z < 0.2) continue;
    const r = size * P.scale;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y);
    ctx.quadraticCurveTo(p.x - r * 0.8, p.y - r * 0.7, p.x - r * 0.1, p.y - r * 0.75);
    ctx.quadraticCurveTo(p.x + r * 0.7, p.y - r * 0.6, p.x + r, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.75, p.y - r * 0.55);
    ctx.quadraticCurveTo(p.x - r * 0.3, p.y - r * 0.78, p.x + r * 0.3, p.y - r * 0.68);
    ctx.stroke();
  }
}
