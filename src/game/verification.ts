import { clock } from './clock';
import { currentVariant, currentWorld } from './sim';
import { modeOf } from './modes';
import { useGame } from './store';
import { truthValues, type QuantityKey } from '../engine/chain';
import { probeTruth } from './probeState';
import { enteredEstimate, reviewEvidence, type Evidence, type EvidenceReview } from './evidenceReview';

export const VERIFICATION_COST = 40;
export type VerificationKind = 'evidence' | 'sensors';
export interface VerificationRecord extends EvidenceReview {
  id: string; kind: VerificationKind; key: QuantityKey; at: number;
  value: number; sigma: number; estimateAt?: number; evidenceStamp?: string;
  good?: boolean;
}

/** A compact change marker for observed data only; never generated truth. */
export function evidenceStamp(s: Evidence) {
  const value = JSON.stringify({ sheet: s.sheet, readings: s.readings, starObs: s.starObs, oppPicks: s.oppPicks, oppPicksG: s.oppPicksG, moonTrack: s.moonTrack, moonTrackG: s.moonTrackG, track: s.track, starPar: s.starPar, shadows: s.shadows });
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${value.length}:${hash >>> 0}`;
}

/** Both paid actions enforce the live budget here, rather than trusting a button. */
export function requestVerification(key: QuantityKey, kind: VerificationKind): { ok: true; record: VerificationRecord } | { ok: false; reason: string } {
  const s = useGame.getState(), mode = modeOf(s.settings.difficulty);
  if (s.phase !== 'play') return { ok: false, reason: 'Paid ECHO checks are available on the expedition progress sheet.' };
  if (mode.verifies <= 0 || s.checksUsed >= mode.verifies) return { ok: false, reason: 'No paid ECHO checks remain in this mode.' };
  const { system: sys } = currentWorld();
  const variant = currentVariant(), estimate = enteredEstimate(s, key, variant);
  if (!estimate) return { ok: false, reason: 'Enter a finite value and a positive uncertainty first.' };
  if (sys.fuelDv - s.penaltyDv < VERIFICATION_COST) return { ok: false, reason: 'This check needs 40 m/s of remaining flight reserve.' };
  let report: EvidenceReview, good: boolean | undefined;
  if (kind === 'evidence') {
    const review = reviewEvidence(s, key, variant, s.settings.difficulty === 'navigator');
    if (!review) return { ok: false, reason: 'There are no saved readings or observations supporting this review yet. No fuel or use was spent.' };
    report = review;
  } else {
    const truth = truthValues(sys, s.sheet, probeTruth(s))[key];
    if (!Number.isFinite(truth)) return { ok: false, reason: 'The ship sensors cannot verify this quantity yet. No fuel or use was spent.' };
    const z = Math.abs(estimate.value - truth) / estimate.sigma;
    good = z <= 1;
    report = { facts: [good ? 'Ship-sensor verification: the true value lies INSIDE the checked error bar.' : z < 2 ? 'Ship-sensor verification: the true value lies just OUTSIDE the checked error bar.' : 'Ship-sensor verification: the true value lies well OUTSIDE the checked error bar.', 'This paid check compares with hidden system truth. It does not provide the exact value, diagnose the cause of a miss, or certify the rest of the expedition.'], why: [], next: [] };
  }
  const record: VerificationRecord = { id: `${s.runId}:${s.checksUsed + 1}`, kind, key, at: clock.t, value: estimate.value, sigma: estimate.sigma, estimateAt: estimate.at, ...report, ...(good !== undefined ? { good } : {}), ...(kind === 'evidence' ? { evidenceStamp: evidenceStamp(s) } : {}) };
  useGame.setState({ penaltyDv: s.penaltyDv + VERIFICATION_COST, checksUsed: s.checksUsed + 1, verificationHistory: [...(s.verificationHistory ?? []), record] });
  return { ok: true, record };
}
