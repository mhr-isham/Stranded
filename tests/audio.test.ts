import { describe, expect, it } from 'vitest';
import { sceneFor, scoreStep, STEP_SECONDS, type AudioScene } from '../src/game/score';

describe('audio direction', () => {
  const state = { phase: 'play', screen: 'hub', storyQueue: [], outcome: null };
  it('selects music from the activity and outcome, including story ducking', () => {
    expect(sceneFor(state)).toBe('explore');
    expect(sceneFor({ ...state, screen: 'pendulum' })).toBe('focus');
    expect(sceneFor({ ...state, screen: 'launch' })).toBe('planning');
    for (const phase of ['prologue', 'ascent', 'flight', 'landing', 'hop']) expect(sceneFor({ ...state, phase })).toBe('flight');
    expect(sceneFor({ ...state, phase: 'results', outcome: { result: { outcome: 'success' } } })).toBe('success');
    expect(sceneFor({ ...state, phase: 'results', outcome: { result: { outcome: 'flyby' } } })).toBe('failure');
    expect(sceneFor({ ...state, storyQueue: ['relay'] })).toBe('story');
  });
  it('keeps rhythm out of precision measurements and story while flight gains energy', () => {
    const phrase = (scene: AudioScene) => Array.from({ length: 128 }, (_, i) => scoreStep(scene, i)).flat();
    const drums = (scene: AudioScene) => phrase(scene).filter((n) => ['kick', 'snare', 'hat'].includes(n.instrument)).length;
    expect(drums('focus')).toBe(0);
    expect(drums('story')).toBe(0);
    expect(drums('failure')).toBe(0);
    expect(drums('explore')).toBeGreaterThan(0);
    expect(drums('flight')).toBeGreaterThan(drums('explore'));
  });
  it('has finite, bounded notes over multiple complete phrases', () => {
    expect(STEP_SECONDS).toBeGreaterThan(0);
    for (const scene of ['title', 'explore', 'focus', 'planning', 'flight', 'story', 'success', 'failure'] as const) {
      for (let step = 0; step < 512; step++)
        for (const n of scoreStep(scene, step)) {
          expect(Number.isFinite(n.midi)).toBe(true);
          expect(n.midi).toBeGreaterThanOrEqual(24);
          expect(n.midi).toBeLessThanOrEqual(110);
          expect(n.duration).toBeGreaterThan(0);
          expect(n.velocity).toBeGreaterThan(0);
          expect(n.velocity).toBeLessThanOrEqual(1);
          expect(Math.abs(n.pan ?? 0)).toBeLessThanOrEqual(1);
        }
    }
  });
});
