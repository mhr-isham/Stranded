// Display formatting for game values.

import { DAY, DEG } from '../engine/constants';
import { QUANTITY_INFO, type QuantityKey } from '../engine/chain';

export const fmt = (x: number, digits = 2) =>
  Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';

/** Significant-figure formatting that never uses exponent notation for game-range numbers. */
export function sig(x: number, n = 4) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const d = Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x))));
  return fmt(x, Math.min(d, 8));
}

export const toDisplay = (key: QuantityKey, si: number) => si / QUANTITY_INFO[key].scale;
export const fromDisplay = (key: QuantityKey, v: number) => v * QUANTITY_INFO[key].scale;

export function showQuantity(key: QuantityKey, si: number, sigma?: number) {
  const info = QUANTITY_INFO[key];
  const v = sig(toDisplay(key, si), 5);
  const s = sigma !== undefined && sigma > 0 ? ` ± ${sig(toDisplay(key, sigma), 2)}` : '';
  return `${v}${s}${info.unit ? ' ' + info.unit : ''}`;
}

export const days = (t: number) => t / DAY;

export function clockLabel(t: number) {
  const d = Math.floor(t / DAY);
  const rem = t - d * DAY;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem - h * 3600) / 60);
  return { day: d + 1, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

export const deg = (rad: number, digits = 2) => `${fmt(rad / DEG, digits)}°`;
export const arcsec = (rad: number, digits = 2) => `${fmt((rad / DEG) * 3600, digits)}″`;
export const arcmin = (rad: number, digits = 2) => `${fmt((rad / DEG) * 60, digits)}′`;
export const kms = (ms: number, digits = 2) => `${fmt(ms / 1000, digits)} km/s`;
