import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFlightInput, flightSensitivity } from '../src/game/flightInput';
import { assistedFlight, completeManualFlight, manualFlightRequired, markFlightAssisted } from '../src/game/piloting';
import { useGame, type Outcome } from '../src/game/store';
import { challengesUnlocked } from '../src/game/challenges';
import type { AtlasCard } from '../src/game/atlas';
import { loadSlot, saveSlot } from '../src/game/checkpoints';
import { ascentStart, autopilot, autopilotDv, inOrbit, stepAscent } from '../src/engine/ascent';

beforeEach(() => useGame.getState().newGame(316, { difficulty: 'astronomer', survival: false, formulas: false, sound: false }));
afterEach(() => vi.unstubAllGlobals());

describe('flight input', () => {
  it('can reach parking orbit with the manual steering rate and binary engine control', () => {
    const params = { mu: 3.986e14, R: 6.371e6, rho0: 1.1, scaleH: 8500, thrust: 21.6, cda: 0.0004, orbitAlt: 200e3 };
    let state = ascentStart(params);
    for (let i = 0; i < 120000 && !inOrbit(params, state); i++) {
      const desired = autopilot(params, state);
      state = stepAscent(params, state, { pitchRate: Math.max(-0.02, Math.min(0.02, desired.pitchRate)), throttle: desired.throttle > 0.5 ? 1 : 0 }, 0.05);
    }
    expect(inOrbit(params, state)).toBe(true);
    expect(state.dv - autopilotDv(params)).toBeLessThan(1000);
  });
  it('supports simultaneous controls and independent keyboard/pointer releases', () => {
    const input = createFlightInput();
    input.set('left', 'touch-1', true);
    input.set('thrust', 'touch-2', true);
    input.set('thrust', 'key-w', true);
    input.set('thrust', 'touch-2', false);
    expect(input.held).toEqual({ left: true, right: false, thrust: true });
    input.set('thrust', 'key-w', false);
    expect(input.held.thrust).toBe(false);
    input.clear();
    expect(input.held).toEqual({ left: false, right: false, thrust: false });
    expect(flightSensitivity(NaN)).toBe(1);
    expect(flightSensitivity(0)).toBe(0.5);
    expect(flightSensitivity(9)).toBe(1.5);
  });
});

describe('required manual flight', () => {
  it('applies to new hard expeditions, with practice, sandbox, easier and legacy exceptions', () => {
    const s = useGame.getState();
    expect(manualFlightRequired(s)).toBe(true);
    expect(manualFlightRequired({ ...s, settings: { ...s.settings, difficulty: 'legend' } })).toBe(true);
    for (const difficulty of ['stargazer', 'cadet', 'navigator'] as const) expect(manualFlightRequired({ ...s, settings: { ...s.settings, difficulty } })).toBe(false);
    expect(manualFlightRequired({ ...s, settings: { ...s.settings, freeRoam: true } })).toBe(false);
    expect(manualFlightRequired({ ...s, settings: { ...s.settings, rulesetVersion: undefined } })).toBe(false);
    expect(manualFlightRequired({ ...s, tutorial: { ...s.tutorial, active: true } })).toBe(false);
  });

  it('never upgrades a rescued leg to manual and preserves the measurements', () => {
    useGame.getState().setSheet('g', { value: 9.8, sigma: 0.2 });
    markFlightAssisted('ascent');
    completeManualFlight('ascent');
    completeManualFlight('landing');
    expect(assistedFlight(useGame.getState())).toBe(true);
    expect(useGame.getState().piloting.ascent).toBeUndefined();
    expect(useGame.getState().piloting.landing).toBe('manual');
    expect(useGame.getState().sheet.g?.value).toBe(9.8);
  });

  it('requires proof of both legs before a successful hard-mode debrief can be scored', () => {
    useGame.setState({ phase: 'results', outcome: { result: { outcome: 'success' } } as Outcome });
    expect(assistedFlight(useGame.getState())).toBe(true);
    completeManualFlight('ascent');
    expect(assistedFlight(useGame.getState())).toBe(true);
    completeManualFlight('landing');
    expect(assistedFlight(useGame.getState())).toBe(false);
  });

  it('cannot erase assistance by restoring a checkpoint', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    saveSlot(0);
    markFlightAssisted('ascent');
    loadSlot(0);
    expect(assistedFlight(useGame.getState())).toBe(true);
  });

  it('keeps assisted journeys out of expert challenge unlocks', () => {
    const card = { outcome: 'success', mode: 'astronomer', assisted: true } as AtlasCard;
    expect(challengesUnlocked({ atlas: [card] })).toBe(false);
    expect(challengesUnlocked({ atlas: [{ ...card, assisted: false }] })).toBe(true);
  });
});
