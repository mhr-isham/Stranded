import { expect, it } from 'vitest';
import { expeditionTimeline, scheduledEvents } from '../src/game/scheduledEvents';
import type { RoverOuting } from '../src/game/roverOuting';
import type { GameState } from '../src/game/store';

function schedule() {
  const outing: RoverOuting = { start: 180, end: 220, at: 200, localHour: 22, distance: 500_000,
    lowerAltitude: .5, margin: .02, observations: 3, observedFrom: 1, observedTo: 30 };
  return {
    rover: { dist: 0, target: 500_000, departAt: 0, arriveAt: 80 },
    northTrip: { dist: 0, arriveAt: 0 },
    surface: { task: { kind: 'process', done: 105 } } as GameState['surface'],
    roverOuting: outing,
  };
}

it('lists only public schedules in time order and keeps forecast provenance', () => {
  const state = Object.defineProperty(schedule(), 'predictions', { get() { throw new Error('prediction state is private to this menu'); } });
  expect(scheduledEvents(state, 10).map(e => [e.id, e.at, e.source])).toEqual([
    ['camera-rover', 80, 'Rover route'],
    ['surface-task', 105, 'Surface job schedule'],
    ['camera-plan', 200, 'Your track estimate'],
  ]);
});

it('omits completed, expired and invalid schedules', () => {
  const state = schedule();
  state.northTrip.arriveAt = Infinity;
  state.roverOuting.capturedAt = 195;
  expect(scheduledEvents(state, 105)).toEqual([]);
});

it('orders the modeled departure with known schedules and identifies a rover conflict', () => {
  const state = schedule();
  state.rover.arriveAt = 240;
  const entries = expeditionTimeline(state, 10, 130);
  expect(entries.map(e => [e.id, e.kind, e.screen])).toEqual([
    ['surface-task', 'Scheduled', 'map'],
    ['launch-window', 'Estimated', 'launch'],
    ['camera-plan', 'Saved', 'rover'],
    ['camera-rover', 'Scheduled', 'rover'],
  ]);
  expect(entries.find(e => e.id === 'camera-plan')?.roverBusy).toBe(true);
  state.rover.arriveAt = 150;
  state.surface.task = { kind: 'process', done: 250 };
  expect(expeditionTimeline(state, 10, NaN).find(e => e.id === 'camera-plan')?.roverBusy).toBe(false);
});
