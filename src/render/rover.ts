// The rover: a six-wheeled rocker-bogie explorer with a solar deck, a camera
// mast with two "eyes", a dish antenna and headlights. Drawn side-on, facing
// right; (x, y) is the ground point under its middle wheel, `size` ≈ its length.

export interface RoverLook {
  /** Wheel rotation (rad), from the distance driven. */
  wheel?: number;
  /** Body pitch (rad), from the slope. */
  pitch?: number;
  /** Facing left instead of right. */
  flip?: boolean;
  lights?: boolean;
  /** Darkening in dim light, 0..1. */
  shade?: number;
  now: number;
}

export function drawRover(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, o: RoverLook) {
  const s = size;
  const sh = o.shade ?? 0;
  const dim = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(v * (1 - 0.88 * sh))).join(',')})`;
  ctx.save();
  ctx.translate(x, y);
  if (o.flip) ctx.scale(-1, 1);
  ctx.rotate(-(o.pitch ?? 0));
  const R = 0.11 * s;
  const wheels = [-0.4, 0, 0.4];

  // Headlight beams (under everything else).
  if (o.lights) {
    const bg = ctx.createLinearGradient(0.45 * s, 0, 2.6 * s, 0);
    bg.addColorStop(0, 'rgba(255,240,200,0.4)');
    bg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(0.46 * s, -0.42 * s);
    ctx.lineTo(2.6 * s, -0.75 * s);
    ctx.lineTo(2.6 * s, 0.05 * s);
    ctx.closePath();
    ctx.fill();
  }

  // Rocker-bogie suspension.
  ctx.strokeStyle = dim([150, 156, 168]);
  ctx.lineWidth = Math.max(1, 0.035 * s);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.08 * s, -0.36 * s); // rocker pivot
  ctx.lineTo(-0.4 * s, -R);
  ctx.moveTo(-0.08 * s, -0.36 * s);
  ctx.lineTo(0.2 * s, -0.24 * s); // to the bogie pivot
  ctx.moveTo(0.2 * s, -0.24 * s);
  ctx.lineTo(0, -R);
  ctx.moveTo(0.2 * s, -0.24 * s);
  ctx.lineTo(0.4 * s, -R);
  ctx.stroke();
  for (const [px, py] of [[-0.08, -0.36], [0.2, -0.24]]) {
    ctx.fillStyle = dim([90, 96, 108]);
    ctx.beginPath();
    ctx.arc(px * s, py * s, 0.03 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wheels with grousers and spokes.
  for (const wx of wheels) {
    const cx = wx * s;
    const cy = -R;
    ctx.fillStyle = dim([34, 36, 42]);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dim([70, 74, 84]);
    ctx.lineWidth = Math.max(0.8, 0.012 * s);
    const ph = o.wheel ?? 0;
    for (let k = 0; k < 10; k++) {
      const a = ph + (k * Math.PI) / 5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.fillStyle = dim([180, 186, 196]);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dim([110, 116, 128]);
    for (let k = 0; k < 4; k++) {
      const a = ph + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5);
      ctx.stroke();
    }
  }

  // Body: a warm, foil-wrapped box with dark trim.
  const body = ctx.createLinearGradient(0, -0.58 * s, 0, -0.34 * s);
  body.addColorStop(0, dim([246, 214, 150]));
  body.addColorStop(1, dim([196, 140, 70]));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-0.38 * s, -0.56 * s, 0.8 * s, 0.2 * s, 0.03 * s);
  ctx.fill();
  ctx.strokeStyle = dim([60, 48, 34]);
  ctx.lineWidth = Math.max(0.8, 0.012 * s);
  ctx.stroke();
  // Foil crinkles.
  ctx.strokeStyle = `rgba(255,255,255,${0.25 * (1 - sh)})`;
  ctx.beginPath();
  for (const fx of [-0.28, -0.12, 0.06, 0.22]) {
    ctx.moveTo(fx * s, -0.54 * s);
    ctx.lineTo((fx + 0.05) * s, -0.4 * s);
  }
  ctx.stroke();
  // Solar deck on top: dark blue cells in a grid, overhanging the body.
  ctx.fillStyle = dim([28, 52, 104]);
  ctx.fillRect(-0.48 * s, -0.63 * s, 0.86 * s, 0.06 * s);
  ctx.strokeStyle = dim([90, 140, 210]);
  ctx.lineWidth = Math.max(0.6, 0.008 * s);
  ctx.beginPath();
  for (let k = 1; k < 8; k++) {
    ctx.moveTo((-0.48 + (0.86 * k) / 8) * s, -0.63 * s);
    ctx.lineTo((-0.48 + (0.86 * k) / 8) * s, -0.57 * s);
  }
  ctx.stroke();
  // Dish antenna at the back.
  ctx.strokeStyle = dim([160, 166, 178]);
  ctx.lineWidth = Math.max(1, 0.02 * s);
  ctx.beginPath();
  ctx.moveTo(-0.3 * s, -0.63 * s);
  ctx.lineTo(-0.3 * s, -0.78 * s);
  ctx.stroke();
  ctx.fillStyle = dim([226, 230, 238]);
  ctx.beginPath();
  ctx.ellipse(-0.3 * s, -0.8 * s, 0.11 * s, 0.045 * s, -0.5, Math.PI, 0);
  ctx.fill();
  // Camera mast with its head: two lenses, a little like eyes.
  ctx.strokeStyle = dim([170, 176, 188]);
  ctx.lineWidth = Math.max(1, 0.03 * s);
  ctx.beginPath();
  ctx.moveTo(0.28 * s, -0.63 * s);
  ctx.lineTo(0.28 * s, -0.98 * s);
  ctx.stroke();
  ctx.fillStyle = dim([226, 230, 238]);
  ctx.beginPath();
  ctx.roundRect(0.18 * s, -1.08 * s, 0.22 * s, 0.11 * s, 0.025 * s);
  ctx.fill();
  for (const ex of [0.27, 0.35]) {
    ctx.fillStyle = dim([20, 24, 32]);
    ctx.beginPath();
    ctx.arc(ex * s, -1.025 * s, 0.028 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.lights ? 'rgba(120,220,255,0.95)' : dim([90, 150, 190]);
    ctx.beginPath();
    ctx.arc(ex * s + 0.006 * s, -1.03 * s, 0.01 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Beacon on the mast and headlights.
  const blink = Math.sin(o.now / 350) > 0.3 ? 1 : 0.2;
  dot(ctx, 0.22 * s, -1.1 * s, Math.max(1, 0.018 * s), [255, 190, 70], blink);
  if (o.lights) dot(ctx, 0.43 * s, -0.46 * s, Math.max(1, 0.022 * s), [255, 245, 215], 1);
  ctx.restore();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: [number, number, number], a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
  g.addColorStop(0, `rgba(${c.join(',')},${0.9 * a})`);
  g.addColorStop(1, `rgba(${c.join(',')},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}
