import { describe, expect, it } from 'vitest';
import { makeTerrain, siteAt, type DescentParams, type DescentState } from '../src/engine/descent';
import { surveyLandingSites } from '../src/engine/landingScan';

const params: DescentParams = {
  g: 9.8, rho0: 1.1, scaleH: 8500, thrust: 2.6 * 9.8, bodyCdA: 0.0025, chuteCdA: 0.1,
  chuteMaxQ: 1.6 * 9.8 / 0.0025, turnAccel: 1.4, assist: true,
};
const approach: DescentState = {
  x: -3500, y: 8000, vx: 120, vy: -100, th: 0, om: 0, fuel: 1300, chute: 'stowed', t: 0,
};
const terrain = makeTerrain(316, 850);

describe('opening landing survey', () => {
  it('finds viable targets along the actual terrain without altering the ship', () => {
    const ship = { ...approach };
    const sites = surveyLandingSites(params, ship, terrain, 1);
    expect(sites.map(({ kind }) => kind)).toEqual(['ice', 'flat', 'hill']);
    expect(sites.map(({ x }) => x)).toEqual(sites.map(({ x }) => x).sort((a, b) => a - b));
    expect(siteAt(terrain, sites[1].x)).toBe('flat');
    expect(siteAt(terrain, sites[2].x)).toBe('hill');
    expect(ship).toEqual(approach);
  });

  it('omits pads without a sampled approach with fuel remaining', () => {
    const sites = surveyLandingSites(params, { ...approach, fuel: 650 }, terrain, 1);
    expect(sites.map(({ kind }) => kind)).not.toContain('hill');
    expect(surveyLandingSites(params, { ...approach, fuel: 0 }, terrain, 1)).toEqual([]);
    expect(surveyLandingSites(params, { ...approach, y: terrain.height(approach.x) }, terrain, 1)).toEqual([]);
  });
});
