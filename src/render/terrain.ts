// Procedural skyline around the crash site. Altitudes are angles above the
// mathematical horizon as seen from the camp.

import { DEG, TAU } from '../engine/constants';
import { makeRng } from '../engine/rng';

export interface Ridge {
  alt: (az: number) => number;
  haze: number; // 0 = near, 1 = far
}

export interface Landscape {
  ridges: Ridge[];
  hillAz: number;
}

const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
const angDiff = (a: number, b: number) => {
  let d = wrap(a - b);
  if (d > Math.PI) d -= TAU;
  return d;
};

export function makeLandscape(seed: number, hillHeight: number): Landscape {
  const rng = makeRng(seed ^ 0x7e11a1);
  const hillAz = rng.range(200, 250) * DEG;
  const layer = (amp: number, base: number, harmonics: number, haze: number, hill = 0): Ridge => {
    const terms = Array.from({ length: harmonics }, (_, i) => ({
      k: i + 2 + Math.floor(rng.range(0, 3)) * (i + 1),
      a: amp / (i + 1) ** 1.1,
      p: rng.range(0, TAU),
    }));
    return {
      haze,
      alt: (az) => {
        let h = base;
        for (const t of terms) h += t.a * Math.sin(t.k * az + t.p);
        if (hill) {
          const d = angDiff(az, hillAz) / (14 * DEG);
          h += hill * Math.exp(-d * d) * (1 + 0.06 * Math.sin(az * 40));
        }
        return h;
      },
    };
  };
  // The hill is ~5 km away: its summit stands atan(h/5km) above the horizon.
  const hillAngle = Math.atan(hillHeight / 5200);
  return {
    hillAz,
    ridges: [
      layer(0.9 * DEG, 0.9 * DEG, 7, 1),
      layer(0.8 * DEG, 0.3 * DEG, 6, 0.6, hillAngle),
      layer(0.5 * DEG, -0.6 * DEG, 5, 0.15),
    ],
  };
}
