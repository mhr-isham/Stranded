// Local solar time at the crash site, from the star's hour angle.

import { DAY } from '../engine/constants';
import { eclToEq, meridianAngle, topocentric } from '../engine/sky';
import type { StarSystem } from '../engine/types';

export function localSolarHours(sys: StarSystem, t: number) {
  const s = eclToEq(topocentric(sys, 'star', t, sys.site), sys.home.obliquity);
  const ra = Math.atan2(s[1], s[0]);
  const H = meridianAngle(sys, t, sys.site) - ra;
  const h = 12 + (H / (2 * Math.PI)) * 24;
  return ((h % 24) + 24) % 24;
}

export const hhmm = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export const dayNumber = (t: number) => Math.floor(t / DAY) + 1;
