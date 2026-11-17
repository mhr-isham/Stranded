import { expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { analyzeYear, yearFitMessage, yearLineAt, yearLineError, yearPoints } from '../src/game/yearObservations';
import { generateSystem } from '../src/engine/system';
import { meridianAngle } from '../src/engine/sky';
import { useGame, type TimedValue } from '../src/game/store';
import { doStarLog, sendYearFromLogs } from '../src/game/tutorial';

const observation = (day: number, degrees: number): TimedValue => ({ at: day * DAY, v: degrees * DEG });

it('requires different observing dates and the existing half-day baseline', () => {
  expect(analyzeYear([]).status).toBe('empty');
  expect(analyzeYear([observation(1, 20)]).status).toBe('dates');
  const same = analyzeYear([observation(1, 20), observation(1, 21)]);
  expect(same.fit).toBeNull(); expect(same.duplicate).toBe(1);
  expect(analyzeYear([observation(1, 20), observation(1.1, 20.1)]).status).toBe('baseline');
  const early = analyzeYear([observation(1, 20), observation(2, 21)]);
  expect(early.status).toBe('provisional');
  expect(early.fit!.yearDays).toBeCloseTo(360);
  expect(early.fit!.slopeSigma).toBeUndefined();
  expect(yearFitMessage(early)).toContain('cannot establish scatter');
});

it('recovers the year from the recorded drift without inventing zero uncertainty', () => {
  const a = analyzeYear([observation(1, 20), observation(6, 25), observation(11, 30)]);
  expect(a.fit!.yearDays).toBeCloseTo(360);
  expect(a.fit!.slope).toBeCloseTo(1);
  expect(yearLineAt(a.fit!, 16)).toBeCloseTo(35);
  expect(a.fit!.yearSigma).toBeUndefined();
});

it('sorts and unwraps angle crossings while same-time repeats do not change the fit', () => {
  const ordered = [observation(0, 359), observation(2, 1), observation(4, 3)];
  expect(yearPoints([ordered[2], ordered[0], ordered[1]]).map((p) => p.y)).toEqual([359, 361, 363]);
  const repeated = analyzeYear([ordered[0], observation(0, 180), ordered[1], observation(2, 170), ordered[2]]);
  expect(repeated.used).toHaveLength(3);
  expect(repeated.duplicate).toBe(2);
  expect(repeated.fit!.yearDays).toBeCloseTo(360);
});

it('reduces rate uncertainty with a wider baseline under the same positional scatter', () => {
  const make = (scale: number) => [0, 1, 2].map((d, i) => observation(d * scale, 20 + d * scale + [.1, -.1, .1][i]));
  const close = analyzeYear(make(1)).fit!, wide = analyzeYear(make(10)).fit!;
  expect(wide.slopeSigma!).toBeCloseTo(close.slopeSigma! / 10);
  expect(wide.yearSigma!).toBeLessThan(close.yearSigma!);
  expect(yearLineError(wide, wide.meanX, 3)!).toBeLessThan(yearLineError(wide, wide.meanX + 30, 3)!);
});

it('allows a new rough observation to worsen scatter rather than guaranteeing improvement', () => {
  const good = [observation(0, 20), observation(10, 30.01), observation(20, 40)];
  const before = analyzeYear(good).fit!, after = analyzeYear([...good, observation(30, 55)]).fit!;
  expect(after.slopeSigma!).toBeGreaterThan(before.slopeSigma!);
  expect(after.yearDays).not.toBeCloseTo(before.yearDays, 0);
});

it('rejects non-positive or nonfinite fits and preserves invalid records outside the plot', () => {
  expect(analyzeYear([observation(0, 20), observation(1, 20)]).status).toBe('direction');
  expect(analyzeYear([observation(0, 20), observation(1, 19)]).fit).toBeNull();
  const a = analyzeYear([observation(0, 20), { at: NaN, v: 0 }, { at: DAY, v: Infinity }, observation(1, 21)]);
  expect(a.invalid).toBe(2); expect(a.fit!.yearDays).toBeCloseTo(360);
  expect(analyzeYear([observation(0, 0), { at: 1e308, v: 1 }]).status).toBe('invalid');
});

it('fits only selected dates and keeps excluded data available', () => {
  const observations = [observation(0, 20), observation(1, 21), observation(20, 45)];
  const a = analyzeYear(observations, [0, 1]);
  expect(a.points).toHaveLength(3); expect(a.used).toHaveLength(2);
  expect(a.baseline).toBe(1); expect(a.fit!.yearDays).toBeCloseTo(360);
  expect(analyzeYear(observations, [50, 60]).fit).toBeNull();
  expect(analyzeYear(observations, [10, 0]).fit).toBeNull();
});

it('recovers a locked world year from the actual background sky turn', () => {
  const sys = generateSystem(316, 'cadet', 6);
  const observations = [0, .03, .1, .2].map((fraction) => ({ at: sys.home.period * fraction, v: meridianAngle(sys, sys.home.period * fraction, sys.site) }));
  expect(sys.features.locked).toBe(true);
  expect(analyzeYear(observations).fit!.yearDays * DAY).toBeCloseTo(sys.home.period, 4);
});

it('does not let the ECHO worksheet fill invalid or manual-fit year estimates', async () => {
  const { clock } = await import('../src/game/clock');
  useGame.getState().newGame(316, { difficulty: 'cadet', sound: false, survival: false, formulas: true });
  useGame.setState({ starObs: [observation(1, 20), observation(1, 21)] });
  sendYearFromLogs(); expect(useGame.getState().sheet.P1).toBeUndefined();
  useGame.setState({ starObs: [observation(1, 20), observation(6, 25), observation(11, 30)] });
  sendYearFromLogs();
  expect(useGame.getState().sheet.P1!.value).toBeCloseTo(360 * DAY);
  expect(useGame.getState().tutorial.note?.[0]).toContain('illustrative 1%');
  useGame.setState((s) => ({ settings: { ...s.settings, challenges: ['handFit'] }, sheet: {} }));
  sendYearFromLogs(); expect(useGame.getState().sheet.P1).toBeUndefined();
  clock.t = 11 * DAY; doStarLog(); expect(useGame.getState().starObs).toHaveLength(3);
  clock.t += DAY; doStarLog(); expect(useGame.getState().starObs.at(-1)!.source).toBe('echo');
});

it('starts focused year practice at the instrument without supplying its observations or answer', async () => {
  const { prepareExercise } = await import('../src/ui/tutorial/schoolPractice');
  useGame.getState().newGame(316, { difficulty: 'cadet', sound: false, survival: false, formulas: true });
  prepareExercise('year');
  const s = useGame.getState();
  expect(s.screen).toBe('observatory');
  expect(s.starObs).toEqual([]);
  expect(s.sheet.P1).toBeUndefined();
  expect(s.trackOn).toBe(false);
});

it('does not give a narrow ECHO example error when the rate is poorly constrained', () => {
  useGame.getState().newGame(316, { difficulty: 'cadet', sound: false, survival: false, formulas: true });
  useGame.setState({ starObs: [observation(0, 20), observation(1, 50), observation(2, 22)] });
  const f = analyzeYear(useGame.getState().starObs).fit!;
  expect(f.slopeSigma! / f.slope).toBeGreaterThan(.25);
  sendYearFromLogs();
  expect(useGame.getState().sheet.P1).toBeUndefined();
  expect(useGame.getState().tutorial.note?.[0]).toContain('too uncertain');
});
