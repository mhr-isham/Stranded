import { describe, expect, it } from 'vitest';
import { DAY, HOUR } from '../src/engine/constants';
import { createProbeWindow, presetProbeWindows, receivedProbeAltitude, receivedProbeSamples } from '../src/game/probeListening';
import { launchProbe } from '../src/game/probeState';
import { useGame } from '../src/game/store';
import { world } from '../src/game/world';

const { system } = world(316, 'navigator', 2);
const probe = launchProbe(system, useGame.getState(), 3 * system.target.radius, 123).probe!;

describe('probe receiver', () => {
  it('only releases due readings and keeps them stable as the pass continues', () => {
    const a = probe.windows![0].start;
    expect(probe.windows!.length).toBe(3);
    expect(receivedProbeSamples(system, probe, a - 1)).toEqual([]);
    const early = receivedProbeSamples(system, probe, a + 12 * HOUR);
    expect(early).toHaveLength(2);
    const inbound = receivedProbeSamples(system, probe, probe.arriveAt - 1);
    expect(inbound.every((sample) => sample.hours < 0)).toBe(true);
    expect(inbound.slice(0, 2)).toEqual(early);
    expect(receivedProbeAltitude(system, probe, probe.arriveAt - 1)).toBeNull();
    expect(receivedProbeAltitude(system, probe, probe.arriveAt)).toBeGreaterThan(0);
  });

  it('validates manual windows and deduplicates overlapping readings', () => {
    const accepted = createProbeWindow(probe, probe.launchedAt, -2, 2, 120);
    expect(accepted.window).toBeDefined();
    const revised = { ...probe, windows: [...probe.windows!, accepted.window!] };
    const then = probe.arriveAt + DAY;
    expect(receivedProbeSamples(system, revised, then)).toEqual(receivedProbeSamples(system, probe, then));
    expect(createProbeWindow(probe, probe.arriveAt, -2, 2, 120).window).toBeUndefined();
    expect(createProbeWindow(probe, probe.launchedAt, -12, 12, 120).window).toBeUndefined();
    expect(createProbeWindow(probe, probe.launchedAt, 1, 1, 120).window).toBeUndefined();
    expect(createProbeWindow(revised, probe.launchedAt, -2, 2, 120).window).toBeUndefined();
  });

  it('keeps pre-encounter telemetry when the signal is lost', () => {
    const crash = launchProbe(system, useGame.getState(), 0.8 * system.target.radius, 123).probe!;
    expect(crash.crashed).toBe(true);
    const before = receivedProbeSamples(system, crash, crash.arriveAt - 1);
    expect(before.length).toBeGreaterThan(0);
    expect(receivedProbeSamples(system, crash, crash.arriveAt + DAY)).toEqual(before);
    expect(receivedProbeAltitude(system, crash, crash.arriveAt + DAY)).toBeNull();
  });

  it('preserves the old automatic archive and clips preset listening to launch time', () => {
    const legacy = { ...probe, windows: undefined };
    expect(receivedProbeSamples(system, legacy, legacy.arriveAt - 1)).toEqual([]);
    const archive = receivedProbeSamples(system, legacy, legacy.arriveAt);
    expect(archive).toHaveLength(495);
    expect(receivedProbeSamples(system, legacy, legacy.arriveAt + DAY)).toEqual(archive);
    const shortPass = presetProbeWindows(10 * DAY, 11 * DAY);
    expect(shortPass.every(({ start }) => start >= 10 * DAY)).toBe(true);
  });
});
