import { describe, expect, it } from 'vitest';
import { DEG } from '../src/engine/constants';
import { captureRelayTag, relayMotion } from '../src/game/relayObservation';
import { makeSkySighting } from '../src/game/skyObservation';

function sighting(at: number, lon: number, instrument: 'wide' | 'scope' = 'scope') {
  return { ...makeSkySighting('relay', 'Light N', at, [Math.cos(lon * DEG), Math.sin(lon * DEG), 0], instrument)!, relayPrecision: 0.055 };
}

describe('relay watch evidence', () => {
  it('finds a moving arc from distinct, centred telescope sightings, including across zero longitude', () => {
    const notes = [sighting(20, 359.1), sighting(65, 0.1), sighting(110, 0.9)];
    expect(relayMotion(notes)).toMatchObject({ motion: true, span: 90, total: 3 });
    expect(relayMotion(notes).shift).toBeCloseTo(1.8);
  });

  it('does not infer motion from tiny changes, duplicate times, older passes, or wide views', () => {
    expect(relayMotion([sighting(0, 6), sighting(45, 6.04), sighting(90, 6.08)]).motion).toBe(false);
    expect(relayMotion([sighting(0, 6), sighting(0, 8), sighting(90, 10)]).motion).toBe(false);
    expect(relayMotion([sighting(0, 6), sighting(45, 8), sighting(1000, 10)]).motion).toBe(false);
    expect(relayMotion([sighting(0, 6), sighting(45, 8, 'wide'), sighting(90, 10)]).motion).toBe(false);
  });

  it('decodes the optical marker only when the simulated contrast is usable', () => {
    const capture = captureRelayTag(1234, 1.5);
    expect(capture).toMatchObject({ at: 1234, mark: 'HALCYON' });
    expect(capture!.signal).toHaveLength(112);
    expect(captureRelayTag(1234, 5)).toBeNull();
  });
});
