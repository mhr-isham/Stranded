import { describe, expect, it } from 'vitest';
import { CHAPTERS, expeditionChapters, countsForCampaign, chapterUnlocked } from '../src/game/campaign';
import { effectiveMode } from '../src/game/modes';
import type { Settings } from '../src/game/store';
const settings: Settings = { difficulty: 'cadet', survival: false, formulas: true, sound: false };

describe('entry point boundaries', () => {
  it('offers only completed variations in expeditions while the original is always available', () => {
    expect(expeditionChapters({ campaign: {} }).map((c) => c.n)).toEqual([1]);
    expect(expeditionChapters({ campaign: { 2: { done: true, best: {} }, 3: { done: false, best: {} } } }).map((c) => c.n)).toEqual([1, 2]);
    expect(CHAPTERS.filter((c) => c.ready)).toHaveLength(9);
  });
  it('keeps independent and sandbox runs out of campaign progression', () => {
    const tutorial = { active: false } as Parameters<typeof countsForCampaign>[0]['tutorial'];
    expect(countsForCampaign({ settings: { ...settings, campaignRun: false }, tutorial })).toBe(false);
    expect(countsForCampaign({ settings: { ...settings, campaignRun: true }, tutorial })).toBe(true);
    expect(countsForCampaign({ settings: { ...settings, campaignRun: true, freeRoam: true }, tutorial })).toBe(false);
    expect(countsForCampaign({ settings, tutorial })).toBe(true); // old saves preserve their contract
    expect(countsForCampaign({ settings, tutorial: { ...tutorial, active: true } })).toBe(false);
    expect(chapterUnlocked({ campaign: {} }, 2)).toBe(false);
  });
  it('makes sandbox guidance optional without changing the underlying mode', () => {
    expect(effectiveMode({ ...settings, freeRoam: true }).missions).toBe('off');
    expect(effectiveMode({ ...settings, freeRoam: true }).coaching).toBe(false);
    expect(effectiveMode({ ...settings, freeRoam: true, freeRoamGuidance: true }).missions).toBe('coach');
    expect(effectiveMode(settings).coaching).toBe(true);
    expect(effectiveMode({ ...settings, difficulty: 'legend' }).formulasLocked).toBe(true);
  });
});
