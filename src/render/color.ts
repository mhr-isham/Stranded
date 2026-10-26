// Colour helpers and the sky colour model.

export type RGB = [number, number, number];

export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Sky colour keyframes against the star's altitude (degrees). */
const KEYS: { alt: number; zenith: RGB; horizon: RGB; ground: RGB }[] = [
  { alt: -90, zenith: hex('#020308'), horizon: hex('#070b18'), ground: hex('#030406') },
  { alt: -18, zenith: hex('#03050d'), horizon: hex('#0a1024'), ground: hex('#040508') },
  { alt: -12, zenith: hex('#060b1e'), horizon: hex('#1d2346'), ground: hex('#06070c') },
  { alt: -6, zenith: hex('#13204a'), horizon: hex('#6b4a6e'), ground: hex('#0c0c14') },
  { alt: -2, zenith: hex('#253f7a'), horizon: hex('#d97a52'), ground: hex('#1a1518') },
  { alt: 3, zenith: hex('#3a64a8'), horizon: hex('#f2b77c'), ground: hex('#3a2b24') },
  { alt: 10, zenith: hex('#3570c0'), horizon: hex('#b9d3ea'), ground: hex('#5a4a3c') },
  { alt: 30, zenith: hex('#2a64bf'), horizon: hex('#a8cbef'), ground: hex('#6b5844') },
  { alt: 90, zenith: hex('#1f5bbd'), horizon: hex('#9cc4ee'), ground: hex('#7a6550') },
];

export function skyColors(sunAltDeg: number) {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (sunAltDeg <= b.alt) {
      const t = Math.max(0, (sunAltDeg - a.alt) / (b.alt - a.alt));
      return { zenith: mix(a.zenith, b.zenith, t), horizon: mix(a.horizon, b.horizon, t), ground: mix(a.ground, b.ground, t) };
    }
  }
  const k = KEYS[KEYS.length - 1];
  return { zenith: k.zenith, horizon: k.horizon, ground: k.ground };
}

/** Faintest star magnitude visible against the sky for a given star altitude. */
export function limitingMag(sunAltDeg: number) {
  if (sunAltDeg > 0) return -4;
  if (sunAltDeg > -4) return -1 + (-sunAltDeg / 4) * 1.5;
  if (sunAltDeg > -12) return 0.5 + ((-sunAltDeg - 4) / 8) * 3.5;
  if (sunAltDeg > -18) return 4 + ((-sunAltDeg - 12) / 6) * 2.4;
  return 6.4;
}
