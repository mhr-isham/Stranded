import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { surfaceGravity } from '../src/engine/measure';
import { useGame } from '../src/game/store';
import { currentWorld } from '../src/game/sim';
import { reviewEvidence } from '../src/game/evidenceReview';
import { evidenceStamp, requestVerification, VERIFICATION_COST } from '../src/game/verification';
import { loadSlot, rewindToLaunch, savePrelaunch, saveSlot } from '../src/game/checkpoints';

beforeEach(() => {
  useGame.getState().newGame(316, { difficulty: 'cadet', survival: false, formulas: true, sound: false });
  useGame.setState({ phase: 'play', sheet: { g: { value: 9.8, sigma: .01 } } });
  for (const value of [9.6, 9.8, 10]) useGame.getState().addReading({ key: 'g', value, at: 0, ...(value === 10 ? { environment: { instrument: 'pendulum', at: 0, rawValue: value, wind: { speed: 12, protection: 'none' } } } : {}) });
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe('evidence-based reviews', () => {
  it('compares the kept mean, repeatability and recorded wind without consulting hidden truth', () => {
    const s = useGame.getState();
    const report = reviewEvidence(s, 'g', 'standard')!;
    expect(report.facts.join(' ')).toContain('matches this average');
    expect(report.facts.join(' ')).toContain('smaller than this repeatability');
    expect(report.facts.join(' ')).toContain('exposed rig in strong wind');
    expect(report.why.join(' ')).toContain('not proof');
    expect(report.facts.join(' ')).not.toMatch(/INSIDE|OUTSIDE/);
    expect(reviewEvidence({ ...s, seed: 888 } as typeof s, 'g', 'standard')).toEqual(report);
  });
  it('ranks uncertainty in a derived calculation using only the entered model', () => {
    useGame.getState().setSheet('R1', { value: 6e6, sigma: 1e5 });
    const report = reviewEvidence(useGame.getState(), 'M1', 'standard')!;
    expect(report.facts.join(' ')).toContain('Largest first-order uncertainty contribution in this model: R₁');
    expect(report.facts.join(' ')).toContain('not independent confirmation');
  });
  it('does not sell a review with no supporting records and keeps Navigator concise', () => {
    const s = useGame.getState();
    const concise = reviewEvidence(s, 'g', 'standard', true)!;
    expect(concise.facts.length).toBeGreaterThan(0);
    expect(concise.why).toEqual([]);
    expect(concise.next).toEqual([]);
    useGame.setState({ readings: [] });
    expect(requestVerification('g', 'evidence').ok).toBe(false);
    expect(useGame.getState().checksUsed).toBe(0);
    expect(useGame.getState().penaltyDv).toBe(0);
  });
  it('invalidates an evidence snapshot when records change, without invalidating it for its own fee/history', () => {
    const stamp = evidenceStamp(useGame.getState());
    const review = requestVerification('g', 'evidence');
    expect(review.ok && review.record.evidenceStamp).toBe(stamp);
    expect(evidenceStamp(useGame.getState())).toBe(stamp);
    useGame.getState().toggleReading(useGame.getState().readings[0].id);
    expect(evidenceStamp(useGame.getState())).not.toBe(stamp);
  });
});

describe('paid verification contract', () => {
  it('retains the explicit hidden-truth check and records the checked entry', () => {
    const value = surfaceGravity(currentWorld().system);
    useGame.getState().setSheet('g', { value, sigma: .1 });
    const result = requestVerification('g', 'sensors');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.good).toBe(true);
    expect(result.record.facts[0]).toContain('INSIDE');
    expect(result.record.value).toBe(value);
    expect(result.record).not.toHaveProperty('truth');
    useGame.getState().setSheet('g', { value: value * 2, sigma: .01 });
    expect(useGame.getState().verificationHistory[0].value).toBe(value);
    const miss = requestVerification('g', 'sensors');
    expect(miss.ok && miss.record.good).toBe(false);
  });
  it('shares a live allowance between both actions and blocks repeat calls after exhaustion', () => {
    for (let i = 0; i < 5; i++) expect(requestVerification('g', i % 2 ? 'sensors' : 'evidence').ok).toBe(true);
    expect(useGame.getState().checksUsed).toBe(5);
    expect(useGame.getState().penaltyDv).toBe(5 * VERIFICATION_COST);
    expect(requestVerification('g', 'sensors').ok).toBe(false);
    expect(requestVerification('g', 'evidence').ok).toBe(false);
    expect(useGame.getState().verificationHistory).toHaveLength(5);
  });
  it('enforces mode allowances including when the shared action is called directly', () => {
    for (const difficulty of ['astronomer', 'legend'] as const) {
      useGame.setState((s) => ({ settings: { ...s.settings, difficulty } }));
      expect(requestVerification('g', 'evidence').ok).toBe(false);
      expect(requestVerification('g', 'sensors').ok).toBe(false);
    }
    useGame.setState((s) => ({ settings: { ...s.settings, difficulty: 'navigator' } }));
    const concise = requestVerification('g', 'evidence');
    expect(concise.ok && concise.record.next).toEqual([]);
    expect(requestVerification('g', 'sensors').ok).toBe(true);
    expect(requestVerification('g', 'sensors').ok).toBe(false);
    useGame.setState((s) => ({ checksUsed: 0, penaltyDv: 0, settings: { ...s.settings, difficulty: 'stargazer' } }));
    for (let i = 0; i < 6; i++) expect(requestVerification('g', 'sensors').ok).toBe(true);
  });
  it('does not spend fuel or a use on invalid entries, insufficient fuel or a closed flight phase', () => {
    const fuel = currentWorld().system.fuelDv;
    useGame.setState({ penaltyDv: fuel - 39 });
    expect(requestVerification('g', 'sensors').ok).toBe(false);
    expect(useGame.getState().checksUsed).toBe(0);
    expect(useGame.getState().penaltyDv).toBe(fuel - 39);
    useGame.setState({ penaltyDv: 0, sheet: { g: { value: 9.8, sigma: 0 } } });
    expect(requestVerification('g', 'sensors').ok).toBe(false);
    useGame.getState().setSheet('g', { value: 9.8, sigma: .1 });
    useGame.setState({ phase: 'ascent' });
    expect(requestVerification('g', 'sensors').ok).toBe(false);
    expect(useGame.getState().penaltyDv).toBe(0);
  });
});

describe('checkpoint-safe check budgets', () => {
  it('retains paid uses/history/fuel across repeated loads while restoring other expedition fuel', () => {
    expect(saveSlot(0)).toBe(true);
    requestVerification('g', 'evidence');
    requestVerification('g', 'sensors');
    useGame.setState((s) => ({ penaltyDv: s.penaltyDv + 100 }));
    expect(loadSlot(0)).toBe(true);
    expect(useGame.getState().checksUsed).toBe(2);
    expect(useGame.getState().penaltyDv).toBe(80);
    expect(useGame.getState().verificationHistory).toHaveLength(2);
    expect(loadSlot(0)).toBe(true);
    expect(useGame.getState().penaltyDv).toBe(80);
    requestVerification('g', 'sensors');
    expect(saveSlot(1)).toBe(true);
    requestVerification('g', 'sensors');
    loadSlot(0); loadSlot(1);
    expect(useGame.getState().checksUsed).toBe(4);
    expect(useGame.getState().penaltyDv).toBe(160);
  });
  it('does not refund a verification when rewinding a failed flight', () => {
    savePrelaunch();
    requestVerification('g', 'sensors');
    expect(rewindToLaunch()).toBe(true);
    expect(useGame.getState().checksUsed).toBe(1);
    expect(useGame.getState().penaltyDv).toBe(40);
    expect(useGame.getState().rewindsUsed).toBe(1);
  });
});
