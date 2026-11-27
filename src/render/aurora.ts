import type { AuroraRibbon } from '../engine/aurora';
import { css, type RGB } from './color';
import type { Camera, Projector } from './projection';

const MINT: RGB = [105, 233, 176];
const TEAL: RGB = [62, 188, 158];
const ROSE: RGB = [160, 100, 147];

export function drawAurora(ctx: CanvasRenderingContext2D, P: Projector, camera: Camera, ribbons: readonly AuroraRibbon[], dpr: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const ribbon of ribbons) {
    const rays = ribbon.map((r) => ({ a: P.project(r.lower), b: P.project(r.middle), c: P.project(r.upper), level: r.brightness }));
    // Diffuse emission around the bright layer softens the pencil-thin rays.
    ctx.globalAlpha = 1;
    for (let i = 6; i < rays.length; i += 12) {
      const { b, level } = rays[i];
      if (!b || level < .09) continue;
      const radius = Math.min(camera.w, camera.h) * .10;
      if (b.x < -radius || b.x > camera.w + radius || b.y < -radius || b.y > camera.h + radius) continue;
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
      glow.addColorStop(0, css(TEAL, level * .19));
      glow.addColorStop(.53, css(TEAL, level * .06));
      glow.addColorStop(1, css(TEAL, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(b.x - radius, b.y - radius, 2 * radius, 2 * radius);
    }
    for (let i = 0; i < rays.length; i++) {
      const { a, b, c, level } = rays[i];
      if (!a || !b || !c || level < .006) continue;
      if (Math.max(a.x, b.x, c.x) < -15 * dpr || Math.min(a.x, b.x, c.x) > camera.w + 15 * dpr ||
          Math.max(a.y, b.y, c.y) < -15 * dpr || Math.min(a.y, b.y, c.y) > camera.h + 15 * dpr) continue;
      if (Math.hypot(c.x - a.x, c.y - a.y) < .35 * dpr) continue;
      const next = rays[i + 1]?.b ?? rays[i - 1]?.b;
      const separation = next ? Math.hypot(next.x - b.x, next.y - b.y) : 0;
      const width = Math.max(1.25 * dpr, Math.min(12 * dpr, separation * 1.52));
      const gradient = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
      gradient.addColorStop(0, css(MINT, 0));
      gradient.addColorStop(.13, css(MINT, level * .76));
      gradient.addColorStop(.35, css(TEAL, level * .54));
      gradient.addColorStop(.61, css(TEAL, level * .24));
      gradient.addColorStop(.78, css(ROSE, level * .24));
      gradient.addColorStop(1, css(ROSE, 0));
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(2 * b.x - (a.x + c.x) / 2, 2 * b.y - (a.y + c.y) / 2, c.x, c.y);
      ctx.globalAlpha = .15;
      ctx.lineWidth = width * 3.2;
      ctx.stroke();
      ctx.globalAlpha = .38;
      ctx.lineWidth = width * 1.45;
      ctx.stroke();
      ctx.globalAlpha = .78;
      ctx.lineWidth = Math.max(.6 * dpr, width * .56);
      ctx.stroke();
    }
  }
  ctx.restore();
}
