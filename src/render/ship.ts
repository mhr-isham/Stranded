// The ship: a lander-starship drawn in vector, shared by the prologue, the
// landings and the camp. Nose up at angle 0; `size` is roughly its height.

export interface ShipLook {
  /** Main engine, 0..1. */
  thrust?: number;
  /** Attitude thrusters: −1 turning left, +1 turning right. */
  rcs?: number;
  /** Heat-shield temperature 0..1 (entry). */
  heat?: number;
  /** Heat shield still attached. */
  shield?: boolean;
  /** Landing legs deployed, 0..1. */
  legs?: number;
  /** Light from the left (+1) or the right (−1). */
  light?: number;
  /** Cabin and nav lights on. */
  lights?: boolean;
  /** Darkening for dim light (dusk, night), 0..1. */
  shade?: number;
  now: number;
}

export function drawStarship(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, o: ShipLook) {
  const s = size;
  const t = o.now;
  const light = o.light ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  // Engine plume (drawn first, behind the hull).
  const thr = o.thrust ?? 0;
  if (thr > 0) plume(ctx, s, thr, t);

  // Landing legs.
  const legs = o.legs ?? 0;
  if (legs > 0) {
    ctx.strokeStyle = '#8c939f';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const a = (0.15 + 0.5 * legs) * side; // folds out from the hull
      const hx = side * 0.26 * s;
      const hy = 0.1 * s;
      const fx = hx + Math.sin(a) * 0.5 * s;
      const fy = hy + Math.cos(a) * 0.5 * s * (0.55 + 0.45 * legs);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(fx, fy);
      ctx.moveTo(hx * 0.6, 0.3 * s);
      ctx.lineTo((hx + fx) / 2, (hy + fy) / 2);
      ctx.stroke();
      ctx.fillStyle = '#5d636e';
      ctx.beginPath();
      ctx.ellipse(fx, fy, 0.07 * s, 0.022 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Side fins.
  for (const side of [-1, 1]) {
    ctx.fillStyle = shadeHex(side * light > 0 ? '#565d6b' : '#323844', o.shade ?? 0);
    ctx.beginPath();
    ctx.moveTo(side * 0.24 * s, -0.02 * s);
    ctx.lineTo(side * 0.43 * s, 0.22 * s);
    ctx.lineTo(side * 0.44 * s, 0.34 * s);
    ctx.lineTo(side * 0.27 * s, 0.24 * s);
    ctx.closePath();
    ctx.fill();
  }

  // Hull: a tapered body with a rounded nose, lit from one side.
  const hull = new Path2D();
  hull.moveTo(0, -0.66 * s);
  hull.bezierCurveTo(0.13 * s, -0.64 * s, 0.2 * s, -0.48 * s, 0.24 * s, -0.24 * s);
  hull.lineTo(0.31 * s, 0.22 * s);
  hull.lineTo(0.33 * s, 0.3 * s);
  hull.lineTo(-0.33 * s, 0.3 * s);
  hull.lineTo(-0.31 * s, 0.22 * s);
  hull.lineTo(-0.24 * s, -0.24 * s);
  hull.bezierCurveTo(-0.2 * s, -0.48 * s, -0.13 * s, -0.64 * s, 0, -0.66 * s);
  hull.closePath();
  const hg = ctx.createLinearGradient(-0.33 * s * light, 0, 0.33 * s * light, 0);
  hg.addColorStop(0, '#f2f4f8');
  hg.addColorStop(0.45, '#c3c9d4');
  hg.addColorStop(1, '#5f6776');
  ctx.fillStyle = hg;
  ctx.fill(hull);
  ctx.strokeStyle = 'rgba(30,34,44,0.7)';
  ctx.lineWidth = Math.max(0.8, s * 0.012);
  ctx.stroke(hull);

  ctx.save();
  ctx.clip(hull);
  // Panel seams.
  ctx.strokeStyle = 'rgba(40,46,58,0.35)';
  ctx.lineWidth = Math.max(0.6, s * 0.008);
  ctx.beginPath();
  for (const yy of [-0.42, -0.08, 0.14]) {
    ctx.moveTo(-0.4 * s, yy * s);
    ctx.lineTo(0.4 * s, yy * s);
  }
  ctx.moveTo(0, -0.42 * s);
  ctx.lineTo(0, -0.08 * s);
  ctx.stroke();
  // Service band with hazard chevrons.
  ctx.fillStyle = '#272c36';
  ctx.fillRect(-0.4 * s, 0.02 * s, 0.8 * s, 0.07 * s);
  ctx.fillStyle = '#ffb547';
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.07 * s, 0.02 * s);
    ctx.lineTo(i * 0.07 * s + 0.03 * s, 0.02 * s);
    ctx.lineTo(i * 0.07 * s + 0.0 * s, 0.09 * s);
    ctx.lineTo(i * 0.07 * s - 0.03 * s, 0.09 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Nose cap.
  ctx.fillStyle = 'rgba(40,46,58,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -0.62 * s, 0.1 * s, 0.06 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Shading on the dark side.
  const sh = ctx.createLinearGradient(0, -0.66 * s, 0, 0.3 * s);
  sh.addColorStop(0, 'rgba(255,255,255,0.12)');
  sh.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = sh;
  ctx.fillRect(-0.4 * s, -0.7 * s, 0.8 * s, 1.0 * s);
  // Dim light: the whole hull darkens (the lights still shine).
  if (o.shade) {
    ctx.fillStyle = `rgba(8,10,18,${Math.min(0.92, o.shade)})`;
    ctx.fillRect(-0.4 * s, -0.7 * s, 0.8 * s, 1.1 * s);
  }
  ctx.restore();

  // Cabin windows.
  const lit = o.lights ?? true;
  for (const wx of [-0.09, 0, 0.09]) {
    ctx.fillStyle = lit ? '#8fe0ff' : '#2b3a4a';
    ctx.beginPath();
    ctx.ellipse(wx * s, -0.3 * s, 0.032 * s, 0.022 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    if (lit) {
      const wg = ctx.createRadialGradient(wx * s, -0.3 * s, 0, wx * s, -0.3 * s, 0.09 * s);
      wg.addColorStop(0, 'rgba(140,220,255,0.35)');
      wg.addColorStop(1, 'rgba(140,220,255,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(wx * s - 0.09 * s, -0.39 * s, 0.18 * s, 0.18 * s);
    }
  }
  // Registry stripe.
  ctx.fillStyle = 'rgba(108,196,255,0.85)';
  ctx.fillRect(-0.2 * s, -0.17 * s, 0.4 * s, 0.018 * s);

  // Heat shield, glowing when hot.
  if (o.shield ?? true) {
    const heat = Math.max(0, Math.min(1, o.heat ?? 0));
    const sg = ctx.createLinearGradient(0, 0.29 * s, 0, 0.4 * s);
    sg.addColorStop(0, shadeHex(mixHex('#6b4a35', '#ffd9a0', heat), o.shade ?? 0));
    sg.addColorStop(1, shadeHex(mixHex('#3d2a1f', '#ff7a3a', heat), o.shade ?? 0));
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(-0.36 * s, 0.29 * s);
    ctx.lineTo(0.36 * s, 0.29 * s);
    ctx.quadraticCurveTo(0, 0.46 * s, -0.36 * s, 0.29 * s);
    ctx.fill();
    if (heat > 0.05) {
      const hg2 = ctx.createRadialGradient(0, 0.4 * s, 0, 0, 0.4 * s, 0.6 * s);
      hg2.addColorStop(0, `rgba(255,200,120,${0.55 * heat})`);
      hg2.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = hg2;
      ctx.fillRect(-0.6 * s, 0.1 * s, 1.2 * s, 0.7 * s);
    }
  } else {
    // Engine bell under the hull.
    const bg = ctx.createLinearGradient(-0.12 * s, 0, 0.12 * s, 0);
    bg.addColorStop(0, '#5a606b');
    bg.addColorStop(0.5, '#2b2f37');
    bg.addColorStop(1, '#16191e');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-0.08 * s, 0.3 * s);
    ctx.lineTo(0.08 * s, 0.3 * s);
    ctx.lineTo(0.14 * s, 0.42 * s);
    ctx.lineTo(-0.14 * s, 0.42 * s);
    ctx.closePath();
    ctx.fill();
    if (thr > 0) {
      ctx.fillStyle = `rgba(255,190,110,${0.6 * thr})`;
      ctx.beginPath();
      ctx.ellipse(0, 0.42 * s, 0.13 * s, 0.03 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Attitude-thruster puffs at the nose.
  const rcs = o.rcs ?? 0;
  if (Math.abs(rcs) > 0.1) {
    const side = rcs > 0 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      const r = (0.04 + 0.03 * i + 0.02 * Math.random()) * s;
      ctx.fillStyle = `rgba(230,240,255,${0.5 - i * 0.14})`;
      ctx.beginPath();
      ctx.arc(side * (0.24 + 0.08 * i) * s, -0.44 * s, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Navigation lights.
  if (lit) {
    const blink = Math.sin(t / 260) > 0.2 ? 1 : 0.25;
    glowDot(ctx, -0.44 * s, 0.33 * s, Math.max(1.2, 0.025 * s), [255, 70, 80], blink);
    glowDot(ctx, 0.44 * s, 0.33 * s, Math.max(1.2, 0.025 * s), [80, 255, 140], blink);
    glowDot(ctx, 0, -0.66 * s, Math.max(1.2, 0.02 * s), [255, 255, 255], Math.sin(t / 700) > 0.85 ? 1 : 0);
  }
  ctx.restore();
}

function plume(ctx: CanvasRenderingContext2D, s: number, thr: number, t: number) {
  const len = s * (0.9 + 0.7 * thr) * (0.92 + 0.08 * Math.sin(t / 23) + 0.06 * Math.random());
  const y0 = 0.38 * s;
  const w0 = 0.13 * s;
  // Outer flame.
  const og = ctx.createLinearGradient(0, y0, 0, y0 + len);
  og.addColorStop(0, `rgba(255,170,80,${0.85 * thr})`);
  og.addColorStop(0.5, `rgba(255,110,50,${0.45 * thr})`);
  og.addColorStop(1, 'rgba(255,70,40,0)');
  ctx.fillStyle = og;
  ctx.beginPath();
  ctx.moveTo(-w0, y0);
  ctx.quadraticCurveTo(-w0 * 1.6, y0 + len * 0.45, 0, y0 + len);
  ctx.quadraticCurveTo(w0 * 1.6, y0 + len * 0.45, w0, y0);
  ctx.closePath();
  ctx.fill();
  // Hot core.
  const cg = ctx.createLinearGradient(0, y0, 0, y0 + len * 0.6);
  cg.addColorStop(0, `rgba(255,255,240,${thr})`);
  cg.addColorStop(1, 'rgba(180,220,255,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-w0 * 0.55, y0);
  ctx.quadraticCurveTo(-w0 * 0.7, y0 + len * 0.3, 0, y0 + len * 0.6);
  ctx.quadraticCurveTo(w0 * 0.7, y0 + len * 0.3, w0 * 0.55, y0);
  ctx.closePath();
  ctx.fill();
  // Shock diamonds.
  for (let i = 1; i <= 3; i++) {
    const yy = y0 + len * 0.13 * i;
    ctx.fillStyle = `rgba(255,255,255,${(0.5 - i * 0.12) * thr})`;
    ctx.beginPath();
    ctx.ellipse(0, yy, w0 * (0.45 - i * 0.08), len * 0.03, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: [number, number, number], a: number) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
  g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.9 * a})`);
  g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

function shadeHex(c: string, k: number) {
  if (!k) return c;
  const v = c.startsWith('rgb') ? c.slice(4, -1).split(',').map(Number) : [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return `rgb(${v.map((x) => Math.round(x * (1 - 0.9 * Math.min(1, k)))).join(',')})`;
}

function mixHex(a: string, b: string, f: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(',')})`;
}
