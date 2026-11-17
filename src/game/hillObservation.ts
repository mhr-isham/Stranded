import { HOUR } from '../engine/constants';

export interface HillStation { name: string; h: number }
/** Existing walking/climbing model, shared by the preview and the action. */
export function hillTravel(stations: HillStation[], from: number, to: number, hillKm = 4) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || !stations[from] || !stations[to] || !Number.isFinite(hillKm) || hillKm < 0) return null;
  const gain = stations[to].h - stations[from].h;
  if (!Number.isFinite(gain)) return null;
  const walk = from !== to && (from === 0 || to === 0) ? hillKm / 4 * HOUR : 0;
  const vertical = from !== to ? Math.abs(gain) / 350 * HOUR : 0;
  const setup = from !== to ? .25 * HOUR : 0;
  return { gain, walk, vertical, setup, total: walk + vertical + setup };
}

export function travelTime(seconds: number) {
  const minutes = Math.round(seconds / 60), hours = Math.floor(minutes / 60), rest = minutes % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ''}` : `${minutes} min`;
}

/** Mechanical control range, independent of the correct horizon angle. */
export const hillPitch = (pitch: number) => Number.isFinite(pitch) ? Math.round(Math.max(-15, Math.min(15, pitch)) * 1e9) / 1e9 : 0;
export const braceSeconds = (until: number, now: number) => Math.max(0, Math.min(4, (until - now) / 1000));
