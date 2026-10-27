// Ascent to a low parking orbit, in the planet's orbital plane (2D, polar
// coordinates around the planet's centre). Gravity, thinning air and drag are
// real; the pilot chooses the pitch and throttle. Whatever Δv a poorly flown
// ascent wastes beyond ECHO's profile comes out of the ship's fuel.

export interface AscentParams {
  mu: number; // G·M of the planet
  R: number; // planet radius (m)
  rho0: number;
  scaleH: number;
  /** Engine acceleration at full throttle (m/s²). */
  thrust: number;
  /** Drag area per mass (m²/kg). */
  cda: number;
  /** Target parking orbit altitude (m). */
  orbitAlt: number;
}

export interface AscentState {
  r: number;
  th: number; // angle around the planet (rad)
  vr: number;
  vt: number; // tangential speed (m/s, prograde +)
  pitch: number; // thrust angle above the local horizontal (rad)
  dv: number; // Δv spent so far (m/s)
  t: number;
}

export const ascentStart = (p: AscentParams, rotSpeed = 0): AscentState => ({ r: p.R, th: 0, vr: 0, vt: rotSpeed, pitch: Math.PI / 2, dv: 0, t: 0 });

export function stepAscent(p: AscentParams, s: AscentState, u: { pitchRate: number; throttle: number }, dt: number): AscentState {
  let { r, th, vr, vt, pitch, dv, t } = s;
  pitch = Math.max(-0.2, Math.min(Math.PI / 2, pitch + u.pitchRate * dt));
  const h = r - p.R;
  const rho = p.rho0 * Math.exp(-Math.max(0, h) / p.scaleH);
  // Air co-rotates with the planet at the surface speed; ignore that small effect here.
  const v = Math.hypot(vr, vt);
  const drag = 0.5 * rho * v * p.cda;
  const a = p.thrust * Math.max(0, Math.min(1, u.throttle));
  const ar = a * Math.sin(pitch) - drag * vr - p.mu / (r * r) + (vt * vt) / r;
  const at = a * Math.cos(pitch) - drag * vt - (vr * vt) / r;
  vr += ar * dt;
  vt += at * dt;
  r += vr * dt;
  th += (vt / r) * dt;
  dv += a * dt;
  if (r < p.R) {
    r = p.R;
    vr = Math.max(0, vr);
  }
  return { r, th, vr, vt, pitch, dv, t: t + dt };
}

/** Periapsis and apoapsis radii of the current orbit (m). */
export function apsides(p: AscentParams, s: AscentState) {
  const v2 = s.vr * s.vr + s.vt * s.vt;
  const energy = v2 / 2 - p.mu / s.r;
  const hMom = s.r * s.vt;
  const a = -p.mu / (2 * energy);
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * hMom * hMom) / (p.mu * p.mu)));
  return energy >= 0 ? { peri: (hMom * hMom) / (p.mu * (1 + e)), apo: Infinity } : { peri: a * (1 - e), apo: a * (1 + e) };
}

/** In orbit: periapsis clear of the air. */
export const inOrbit = (p: AscentParams, s: AscentState) => apsides(p, s).peri > p.R + 0.7 * p.orbitAlt;

/** ECHO's guidance: a gravity turn to raise apoapsis, a coast, then a circularising burn. */
export function autopilot(p: AscentParams, s: AscentState) {
  const h = s.r - p.R;
  const { apo } = apsides(p, s);
  const target = p.R + p.orbitAlt;
  let pitchCmd: number;
  let throttle = 1;
  if (h < 1000) pitchCmd = Math.PI / 2;
  else if (apo < target) {
    const f = Math.min(1, h / (0.55 * p.orbitAlt));
    pitchCmd = Math.max(0.03, (Math.PI / 2) * (1 - f) ** 1.3);
  } else if (s.vr > 15 && s.r < 0.995 * apo) {
    pitchCmd = 0;
    throttle = 0; // coast up to apoapsis
  } else {
    pitchCmd = Math.max(-0.2, Math.min(0.3, -s.vr / 300));
  }
  return { pitchRate: Math.max(-0.5, Math.min(0.5, (pitchCmd - s.pitch) * 3)), throttle };
}

/** Fly the ascent with ECHO's guidance; returns the Δv it takes (the baseline). */
export function autopilotDv(p: AscentParams, rotSpeed = 0) {
  let s = ascentStart(p, rotSpeed);
  for (let i = 0; i < 120000 && !inOrbit(p, s); i++) s = stepAscent(p, s, autopilot(p, s), 0.05);
  return s.dv;
}
