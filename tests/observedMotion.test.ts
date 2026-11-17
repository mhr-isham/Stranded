import { expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { motionDirection, observedMotion, resolveMotionPrediction, savedSkyDirection } from '../src/game/observedMotion';

it('replays chronological saved samples, preserving wrap and missing-night gaps', () => {
  const points = observedMotion([{at:4*DAY,v:3*DEG},{at:0,v:359*DEG},{at:DAY,v:0},{at:DAY,v:0},{at:NaN,v:0}],DAY);
  expect(points.map(p=>p.y)).toEqual([359,360,363]);
  expect(points.map(p=>p.gap)).toEqual([false,false,true]);
  expect(points.map(p=>p.at)).toEqual([0,DAY,4*DAY]);
});
it('compares a prediction only with a later saved observation, without a true path', () => {
  const study = {anchorAt:DAY,anchorValue:1*DEG,prediction:'east' as const};
  expect(resolveMotionPrediction(study,[{at:DAY,v:2*DEG}])).toBe(study);
  const result = resolveMotionPrediction(study,[{at:2*DAY,v:.5*DEG}]);
  expect(result.result!.direction).toBe('west');
  expect(result.result!.delta).toBeCloseTo(-.5);
  expect(resolveMotionPrediction(result,[{at:3*DAY,v:5*DEG}])).toBe(result);
});
it('keeps unresolved readout steps distinct from a confident direction', () => {
  expect(motionDirection(.01)).toBe('unresolved');
  expect(motionDirection(-.02)).toBe('west');
  expect(motionDirection(.02)).toBe('east');
});
it('places only sightings with actually saved sky latitude on the wide sky', () => {
  expect(savedSkyDirection({at:0,v:0})).toBeNull();
  expect(savedSkyDirection({at:0,v:0,skyLatitude:NaN})).toBeNull();
  expect(savedSkyDirection({at:0,v:0,skyLatitude:0})).toEqual([1,0,0]);
  expect(savedSkyDirection({at:0,v:Math.PI/2,skyLatitude:0})![1]).toBeCloseTo(1);
});
