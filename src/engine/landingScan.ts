import { deployChute, dynPressure, judgeTouchdown, siteAt, slopeAt, stepDescent, type DescentParams, type DescentState, type Terrain, type TerrainFeature } from './descent';

export type LandingSite = { kind: TerrainFeature['kind']; x: number };

const BANKS = [-1.4, -1.05, -0.65, 0, 0.65, 1.05, 1.4];
const BURN_SECONDS = [0, 2, 4, 6, 9, 12, 16, 20, 25, 30, 36, 42];
const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

/** Sample a banked burn, a coast, and a braking approach on a copy of the ship.
 * The survey can identify feasible pads but never sends commands to the live flight.
 */
function testApproach(p: DescentParams, start: DescentState, tr: Terrain, bank: number, burnSeconds: number, steering: number, canopy: boolean) {
  let ship = start;
  let braking = false;
  const dt = 0.05;
  for (let elapsed = 0; elapsed < 260; elapsed += dt) {
    const height = ship.y - tr.height(ship.x);
    if (height <= 0) {
      const touch = judgeTouchdown(tr, ship, p.assist);
      return touch === 'crash' || ship.fuel < 25 ? null : { ship, clean: touch === 'clean' };
    }
    const falling = Math.max(0, -ship.vy);
    const speed = Math.hypot(ship.vx, falling);
    braking ||= height < 1.8 * speed * falling / (2 * (p.thrust - p.g)) + 2 * falling + 36;
    const burning = !braking && elapsed < burnSeconds;
    if (canopy && !burning && !braking && height < 1900 && ship.chute === 'stowed' && dynPressure(p, ship) < p.chuteMaxQ * 0.95) {
      ship = deployChute(p, ship);
    }
    const tilt = braking ? clamp(-ship.vx * 0.03, 0.72) : burning ? bank : 0;
    const turn = clamp(4 * (tilt - ship.th) - 2.5 * ship.om, steering);
    const targetFall = Math.max(2, Math.min(25, height * 0.45));
    const throttle = braking
      ? Math.max(0, Math.min(1, (p.g + 1.45 * (-targetFall - ship.vy)) / (p.thrust * Math.max(0.4, Math.cos(ship.th)))))
      : burning && Math.abs(bank - ship.th) < 0.28 ? 1 : 0;
    ship = stepDescent(p, ship, { turn, throttle }, dt);
    if (ship.fuel < 25) return null;
  }
  return null;
}

export function surveyLandingSites(p: DescentParams, start: DescentState, tr: Terrain, steering: number): LandingSite[] {
  if (start.y <= tr.height(start.x) || start.fuel < 25) return [];
  const ice = tr.features.find((f) => f.kind === 'ice')!;
  const best = new Map<LandingSite['kind'], { x: number; quality: number }>();
  for (const bank of BANKS) {
    for (const seconds of BURN_SECONDS) {
      if (seconds === 0 && bank !== 0) continue;
      for (const canopy of [false, true]) {
        const result = testApproach(p, start, tr, bank, seconds, steering, canopy);
        if (!result) continue;
        const { x, fuel } = result.ship;
        const terrain = siteAt(tr, x);
        const iceEdge = Math.max(ice.x0 - x, x - ice.x1, 0);
        const kind = terrain === 'rough' && iceEdge <= 350 && slopeAt(tr, x) < 0.12 ? 'ice' : terrain;
        if (kind === 'rough') continue;
        const quality = fuel + (result.clean ? 90 : 0) - (kind === 'ice' ? iceEdge * 0.15 : 0);
        if (quality > (best.get(kind)?.quality ?? -Infinity)) best.set(kind, { x, quality });
      }
    }
  }
  return tr.features.flatMap(({ kind }) => {
    const pad = best.get(kind);
    return pad ? [{ kind, x: pad.x }] : [];
  }).sort((a, b) => a.x - b.x);
}
