import { ARCSEC } from '../engine/constants';
import { angleBetween, cross, norm, sub, unit, type Vec3 } from '../engine/vec';

/** Gnomonic offsets from the shared camera centre; +x right, +y down. */
export interface CameraMark { x: number; y: number }
export type JumpDirection = 'left' | 'right' | 'up' | 'down' | 'unresolved';
export interface ParallaxPair {
  id: string; at: number; dirA: Vec3; dirB: Vec3; radius: number;
  baseline: number; projectedBaseline: number; seeing: number; roverDistance: number;
  marks: { A: CameraMark | null; B: CameraMark | null }; viewedB: boolean;
  prediction?: { direction: JumpDirection; comparison?: ParallaxComparison };
}
export interface ParallaxComparison { dx: number; dy: number; shift: number; direction: JumpDirection }
export interface ParallaxInvestigationRecord { captureId: string; at: number; projectedBaseline: number; prediction: JumpDirection; comparison: ParallaxComparison }
export interface ParallaxReading {
  captureId: string; baseline: number; projectedBaseline: number; shift: number;
  markA: CameraMark; markB: CameraMark;
}

/** The laser baseline component perpendicular to the camp camera's pointing. */
export function projectedBaseline(a: Vec3, b: Vec3, pointing: Vec3) {
  if (![...a, ...b, ...pointing].every(Number.isFinite) || norm(pointing) === 0) return 0;
  return norm(cross(sub(b, a), unit(pointing)));
}

export function measuredParallax(pair: Pick<ParallaxPair, 'marks' | 'projectedBaseline'>) {
  const { A, B } = pair.marks;
  if (!A || !B || ![A.x, A.y, B.x, B.y, pair.projectedBaseline].every(Number.isFinite) || pair.projectedBaseline <= 0) return null;
  // A marker is a tangent-plane coordinate, not itself an angle.
  const shift = angleBetween([1, A.x, A.y], [1, B.x, B.y]);
  const distance = pair.projectedBaseline / shift;
  return shift > 0 && Number.isFinite(distance) ? { shift, distance, dx: B.x - A.x, dy: B.y - A.y } : null;
}

/** Only committed predictions and player marks enter this comparison. */
export function compareParallax(pair: ParallaxPair): ParallaxPair {
  if (!pair.prediction || pair.prediction.comparison) return pair;
  const measured = measuredParallax(pair);
  if (!measured) return pair;
  const { dx, dy, shift } = measured;
  const direction: JumpDirection = shift <= 1.2 * ARCSEC * pair.seeing ? 'unresolved'
    : Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
  return { ...pair, prediction: { ...pair.prediction, comparison: { dx, dy, shift, direction } } };
}
