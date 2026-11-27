import { lunarDiskPoint, lunarSurfaceLight, lunarView, type LunarLight } from '../engine/eclipse';
import { mulberry32, unitHash } from '../engine/rng';
import { unit, type Vec3 } from '../engine/vec';

const SIZE = 80;
interface MapTexture { bitmap: HTMLCanvasElement; albedo: Float32Array; time: number; seed: number; generated: number }
const textures = new WeakMap<HTMLCanvasElement, MapTexture>();

function lunarAlbedo(seed: number) {
  const noise = mulberry32(seed ^ 0xa13bc92);
  const craters = Array.from({ length: 12 }, () => ({ x: noise() * 1.6 - .8, y: noise() * 1.6 - .8, r: .03 + noise() * .12 }));
  return Float32Array.from({ length: SIZE * SIZE }, (_, n) => {
    const i = n % SIZE, j = Math.floor(n / SIZE);
    const u = 2 * (i + .5) / SIZE - 1, v = 1 - 2 * (j + .5) / SIZE;
    if (u * u + v * v > 1) return 0;
    const basins = .18 * Math.exp(-7 * ((u + .32) ** 2 + (v - .28) ** 2)) +
      .23 * Math.exp(-12 * ((u - .32) ** 2 + (v + .25) ** 2));
    let value = .77 - basins + .18 * unitHash(seed, i, j);
    for (const c of craters) {
      const q = ((u - c.x) ** 2 + (v - c.y) ** 2) / c.r ** 2;
      if (q > 1.4) continue;
      value += .13 * Math.exp(-22 * (q - 1) ** 2) - .13 * Math.exp(-3 * q);
    }
    return Math.max(.2, Math.min(1, value));
  });
}

export function drawLunarDisk(ctx: CanvasRenderingContext2D, light: LunarLight, direction: Vec3, x: number, y: number,
  radius: number, seed: number, at: number, now: number, paused: boolean) {
  let texture = textures.get(ctx.canvas);
  if (!texture || texture.seed !== seed) {
    const bitmap = document.createElement('canvas');
    bitmap.width = bitmap.height = SIZE;
    texture = { bitmap, albedo: lunarAlbedo(seed), time: NaN, seed, generated: -Infinity };
    textures.set(ctx.canvas, texture);
  }
  if (texture.time !== at && (paused || now - texture.generated >= 85)) {
    const target = texture.bitmap.getContext('2d')!;
    const frame = target.createImageData(SIZE, SIZE);
    const { right, up, facing } = lunarView(direction);
    const star = unit(light.toStar);
    for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) {
      const u = 2 * (i + .5) / SIZE - 1, v = 1 - 2 * (j + .5) / SIZE;
      const distance = Math.hypot(u, v);
      if (distance > 1) continue;
      const normal = lunarDiskPoint(right, up, facing, u, v);
      const direct = lunarSurfaceLight(light, normal, star);
      // The terrain texture is illustrative. The moving shadow is computed.
      const value = 2 + 216 * Math.pow(direct, .58) * texture.albedo[j * SIZE + i];
      const pixel = 4 * (j * SIZE + i);
      frame.data[pixel] = value * 1.04;
      frame.data[pixel + 1] = value;
      frame.data[pixel + 2] = value * .94;
      frame.data[pixel + 3] = Math.min(255, (1 - distance) * SIZE * 180);
    }
    target.putImageData(frame, 0, 0);
    texture.time = at;
    texture.generated = now;
  }
  ctx.drawImage(texture.bitmap, x - radius, y - radius, 2 * radius, 2 * radius);
}
