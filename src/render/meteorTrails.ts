import type { MeteorTrail } from '../engine/meteors';
import { css, type RGB } from './color';
import type { Projector } from './projection';

export function drawMeteorTrails(ctx: CanvasRenderingContext2D, P: Projector, trails: readonly MeteorTrail[], dpr: number) {
  for (const trail of trails) {
    const a = P.project(trail.from), b = P.project(trail.to);
    if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < dpr) continue;
    const cool: RGB = trail.warm ? [245, 199, 144] : [143, 209, 244];
    const bright: RGB = trail.warm ? [255, 239, 209] : [234, 248, 255];
    const level = trail.intensity;
    const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    gradient.addColorStop(0, css(cool, 0));
    gradient.addColorStop(.28, css(cool, level * .29));
    gradient.addColorStop(.76, css(bright, level * .78));
    gradient.addColorStop(1, css(bright, level * (trail.head ? 1 : .58)));
    const line = (style: string | CanvasGradient, width: number) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = width * dpr;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round';
    line(css(cool, level * .09), trail.head ? 5 : 3.5);
    line(gradient, trail.head ? 1.55 : 1);
    if (trail.head) {
      const radius = 4 * dpr, bloom = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
      bloom.addColorStop(0, css(bright, level));
      bloom.addColorStop(.23, css(cool, level * .47));
      bloom.addColorStop(1, css(cool, 0));
      ctx.fillStyle = bloom;
      ctx.fillRect(b.x - radius, b.y - radius, 2 * radius, 2 * radius);
    }
    ctx.restore();
  }
}
