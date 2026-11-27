import { TAU } from '../engine/constants';
import { phaseIncidence, type PlanetPhase } from '../engine/planetPhase';

const SIZE = 120;
const cache = new WeakMap<HTMLCanvasElement, { bitmap: HTMLCanvasElement; key: string; time: number }>();

/** Lambertian phase geometry with an illustrative blue surface and clouds. */
export function drawPlanetPhase(ctx: CanvasRenderingContext2D, phase: PlanetPhase, x: number, y: number,
  radius: number, blur: number, now: number, paused: boolean) {
  let entry = cache.get(ctx.canvas);
  if (!entry) {
    const bitmap = document.createElement('canvas');
    bitmap.width = bitmap.height = SIZE;
    entry = { bitmap, key: '', time: -Infinity };
    cache.set(ctx.canvas, entry);
  }
  const key = [phase.cosine, phase.limbX, phase.limbY].map((value) => value.toFixed(4)).join(':');
  if (entry.key !== key && (paused || now - entry.time > 65)) {
    const target = entry.bitmap.getContext('2d')!;
    const frame = target.createImageData(SIZE, SIZE);
    for (let row = 0; row < SIZE; row++) for (let col = 0; col < SIZE; col++) {
      const u = (col + 0.5) * 2 / SIZE - 1, v = (row + 0.5) * 2 / SIZE - 1;
      const r = Math.hypot(u, v);
      if (r >= 1) continue;
      const light = phaseIncidence(phase, u, v);
      const gain = light ** 0.55;
      const swirl = Math.sin(v * 17 + 1.5 * Math.sin(u * 8 + v * 4)) + 0.6 * Math.sin(v * 35 - u * 9)
        + 0.33 * Math.sin(u * 59 + v * 85);
      const cloud = Math.max(0, swirl - 0.55) * 0.46;
      const ocean = 0.85 + 0.15 * Math.cos(u * 14 + Math.sin(v * 7));
      const limb = r ** 7 * gain;
      const i = (row * SIZE + col) * 4;
      frame.data[i] = (54 * ocean + 132 * cloud) * gain + 14 * limb;
      frame.data[i + 1] = (135 * ocean + 119 * cloud) * gain + 26 * limb;
      frame.data[i + 2] = (226 * ocean + 58 * cloud) * gain + 24 * limb;
      frame.data[i + 3] = 255 * Math.min(1, (1 - r) * SIZE) * Math.min(1, gain * 5);
    }
    target.putImageData(frame, 0, 0);
    entry.key = key;
    entry.time = now;
  }
  ctx.save();
  if (blur >= 0.35) ctx.filter = `blur(${Math.min(8, blur).toFixed(2)}px)`;
  ctx.drawImage(entry.bitmap, x - radius, y - radius, 2 * radius, 2 * radius);
  ctx.restore();
}

export function drawPhasePoint(ctx: CanvasRenderingContext2D, phase: PlanetPhase, x: number, y: number, radius: number) {
  if (phase.flux < 0.0001) return;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.6);
  glow.addColorStop(0, `rgba(194,226,255,${Math.sqrt(phase.flux)})`);
  glow.addColorStop(1, 'rgba(137,190,247,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, radius * 2.6, 0, TAU); ctx.fill();
}
