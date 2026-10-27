// Achievements, evaluated at the end of a run.

import type { QuantityKey } from '../engine/chain';
import type { QuantityScore } from '../engine/scoring';
import type { StarSystem } from '../engine/types';
import type { GameState } from './store';

export const ACHIEVEMENTS: Record<string, { name: string; icon: string; text: string }> = {
  landed: { name: 'Homeward', icon: '🌍', text: 'Reach orbit around the blue planet.' },
  eratosthenes: { name: 'Eratosthenes', icon: '📐', text: 'Planet radius within 1%.' },
  galileo: { name: 'Galileo', icon: '⏱', text: 'Surface gravity within 0.5%.' },
  kepler: { name: 'Kepler', icon: '🪐', text: 'Star mass within 3%.' },
  cassini: { name: 'Cassini & Richer', icon: '🔭', text: 'Parallax distance within 2%.' },
  honest: { name: 'Honest Navigator', icon: '⚖️', text: 'Every value on the sheet inside its own error bar.' },
  tycho: { name: 'Tycho', icon: '📒', text: 'Log 30 or more manual readings.' },
  lean: { name: 'Lean Burn', icon: '⛽', text: 'Arrive with at least 15% of your fuel.' },
  unaided: { name: 'No Help Needed', icon: '🧠', text: 'Succeed without hints or verification.' },
  survivor: { name: 'Survivor', icon: '🔥', text: 'Succeed in survival mode.' },
  oracle: { name: 'Called It', icon: '🎯', text: 'A prediction inside its range, scoring 80 points or more.' },
  seer: { name: 'Halley', icon: '☄️', text: 'Three predictions inside their ranges in one run.' },
  early: { name: 'Early Bird', icon: '🐦', text: 'Launch with more than a third of life support left.' },
};

export function evaluateAchievements(s: GameState, sys: StarSystem, outcome: string, rows: { k: QuantityKey; sc: QuantityScore | null }[]) {
  const got: string[] = [];
  const rel = (k: QuantityKey) => {
    const r = rows.find((x) => x.k === k);
    return r?.sc ? r.sc.z * r.sc.relSigma : Infinity;
  };
  const ok = outcome === 'success';
  if (ok) got.push('landed');
  if (rel('R1') < 0.01) got.push('eratosthenes');
  if (rel('g') < 0.005) got.push('galileo');
  if (rel('Mstar') < 0.03) got.push('kepler');
  if (rel('dPar') < 0.02) got.push('cassini');
  if (rows.every((r) => !r.sc || r.sc.inside) && rows.some((r) => r.sc)) got.push('honest');
  if (s.readings.length + s.starObs.length >= 30) got.push('tycho');
  if (ok && s.outcome && s.outcome.result.fuelLeft / sys.fuelDv >= 0.15) got.push('lean');
  if (ok && s.hintsUsed === 0 && s.checksUsed === 0) got.push('unaided');
  if (ok && s.settings.survival) got.push('survivor');
  if (ok && s.outcome && (sys.lifeSupport - s.outcome.plan.departTime) / sys.lifeSupport > 1 / 3) got.push('early');
  const hits = s.predictions.filter((p) => p.result && p.result.z <= 1);
  if (hits.some((p) => p.result!.points >= 80)) got.push('oracle');
  if (hits.length >= 3) got.push('seer');
  return got;
}
