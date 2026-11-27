import { sightingChange, type SkySighting } from './skyObservation';

export const RELAY_SIGHTING_STEP = 45;
const MIN_SEPARATION = 25;
const PASS_WINDOW = 15 * 60;
export const RELAY_TAG_FIELD = 0.055; // degrees

export interface RelayTag {
  at: number;
  mark: string;
  signal: number[];
}

/** The observer can establish movement from one short arc, without inferring a range or period. */
export function relayMotion(sightings: readonly SkySighting[]) {
  const sorted = sightings.filter((s) => s.key === 'relay' && s.instrument === 'scope' && s.relayPrecision !== undefined)
    .sort((a, b) => a.at - b.at);
  const last = sorted.at(-1);
  const points = last ? sorted.filter((s) => last.at - s.at <= PASS_WINDOW) : [];
  const first = points[0];
  const span = last && first ? last.at - first.at : 0;
  const shift = last && first ? sightingChange(first, last) : 0;
  const motion = !!last && !!first && points.some((middle) => {
    if (middle.at - first.at < MIN_SEPARATION || last.at - middle.at < MIN_SEPARATION) return false;
    const clearsAim = (a: SkySighting, b: SkySighting) =>
      sightingChange(a, b) > Math.max(0.18, 3 * (a.relayPrecision! + b.relayPrecision!));
    return clearsAim(first, middle) && clearsAim(middle, last) && clearsAim(first, last);
  });
  return { points, total: sorted.length, span, shift, motion };
}

const REGISTRY = 'HALCYON';
const BITS = [...REGISTRY].flatMap((letter) => Array.from({ length: 8 }, (_, i) => (letter.charCodeAt(0) >> (7 - i)) & 1));

/** Idealized photometric reader for the coded reflector. Adjacent cells are
 * a bright/dim pair, so the mark survives changes in overall brightness. */
export function captureRelayTag(at: number, seeing: number): RelayTag | null {
  if (!Number.isFinite(at) || at < 0 || !Number.isFinite(seeing) || seeing <= 0) return null;
  const contrast = 0.65 / Math.max(1, seeing);
  if (contrast < 0.17) return null;
  const signal = BITS.flatMap((bit, i) => {
    const baseline = 0.38 + 0.07 * Math.sin(i * 0.25 + at * 0.03);
    const bright = baseline + contrast / 2, dim = baseline - contrast / 2;
    return bit ? [bright, dim] : [dim, bright];
  });
  let mark = '';
  for (let start = 0; start < signal.length; start += 16) {
    let byte = 0;
    for (let i = start; i < start + 16; i += 2) byte = (byte << 1) | Number(signal[i] > signal[i + 1]);
    mark += String.fromCharCode(byte);
  }
  return { at, mark, signal };
}
