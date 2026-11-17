import { useState } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { clock } from '../../game/clock';
import { useGame, type TimedValue } from '../../game/store';
import { analyzeYear } from '../../game/yearObservations';
import { emitTut, jumpTo, nextDusk } from '../../game/tutorial';
import { EarlyYearComparison, YearFitDetails, YearPlot } from '../tools/YearAnalysis';

/** Optional companion to actual instrument practice; never supplies observations. */
export function YearInvestigation({ observations, locked, manual }: { observations: TimedValue[]; locked: boolean; manual: boolean }) {
  const s = useGame(), [reflection, setReflection] = useState(false);
  if (!s.tutorial.active || !s.settings.freeRoam || !['basic', 'year'].includes(s.schoolSession?.id ?? '') || manual) return null;
  const a = analyzeYear(observations);
  const advance = (days: number) => {
    jumpTo(locked ? clock.t + days * DAY : nextDusk(clock.t + days * DAY));
    if (!locked) emitTut('scope-star');
  };
  return <section className="panel panel-pad stack year-investigation" data-tut="year-investigation" aria-label="Flight School year investigation">
    <div className="meter-label">Optional investigation · unscored</div>
    <h3>How much can another night tell you?</h3>
    <p>Log a first position, return on the next observing day for an early line, then choose a longer gap. Re-centre and log each sighting yourself.</p>
    <div className="row year-choices">{[0, 1, 10, 25].map((days) => <button key={days} className="btn small" onClick={() => advance(days)}>{days ? `Return after ${days} day${days > 1 ? 's' : ''}` : 'Find an observing time'}</button>)}</div>
    <EarlyYearComparison observations={observations} />
    {a.used.length >= 3 && <><button className="btn small" onClick={() => setReflection(!reflection)}>What did the extra date change?</button>{reflection && <div className="hint" role="status">Compare the first-two-date estimate with the longer record and the scatter around the line. More time coverage often constrains a rate better; a rough observation or curved motion may widen the scatter or change the estimate. Two dates alone could not test that line. Neither a narrow fit nor three dates proves the year is correct.</div>}</>}
    <div className="faint">Time buttons advance only this practice expedition and point the scope; they never take a reading. You can skip this comparison and complete the ordinary exercise. Your original expedition is restored when practice ends.</div>
  </section>;
}

/** Labeled teaching model, separate from expedition observations and scores. */
export function YearBaselineLab({ yearDays, locked = false }: { yearDays: number; locked?: boolean }) {
  const [observations, setObservations] = useState<TimedValue[]>([{ at: 0, v: 20.08 * DEG }]);
  const [rough, setRough] = useState(false), [message, setMessage] = useState('One sighting is a starting point, not a rate. Choose when to return.');
  const a = analyzeYear(observations), lastDay = observations.at(-1)!.at / DAY;
  const observe = (gap: number) => {
    const day = lastDay + gap, offsets = [.08, -.06, .04, -.1, .07], error = rough ? 3 : offsets[observations.length % offsets.length];
    setObservations([...observations, { at: day * DAY, v: ((20 + day * 360 / yearDays + error) % 360) * DEG }]);
    setMessage(gap === 0 ? 'The new reading has the same timestamp. It can check centring, but adds no baseline and is not another independent date in the fit.' : rough ? 'This deliberately offset observation may increase scatter or bias the line. More data are useful evidence, not a guaranteed improvement.' : `You returned ${gap} day${gap === 1 ? '' : 's'} later. Compare the rate, baseline and scatter with your first look.`);
  };
  return <section className="stack year-investigation year-lab" aria-label="Year baseline mini expedition">
    <h3>{locked ? 'Try a locked-world sky-turn expedition' : 'Try a miniature observing expedition'}</h3>
    <p>{locked ? 'This separate teaching log uses one rotation per 60-day orbit. You measure the background sky’s turn while the local star stays fixed.' : 'Explore the year selected above using a miniature log with small centring offsets.'} Teaching data stay separate from your game observations. Changing the teaching year resets this mini log.</p>
    <div className="row year-choices"><button className="btn small" onClick={() => observe(0)}>Observe again now</button>{[1, 10, 25].map((d) => <button className="btn small" key={d} onClick={() => observe(d)}>Observe {d} {d === 1 ? 'day' : 'days'} later</button>)}</div>
    <label className="row"><input type="checkbox" checked={rough} onChange={(e) => setRough(e.target.checked)} />Make the next teaching sighting rough (+3° offset)</label>
    <div className="hint" role="status">{message}</div>
    <YearPlot analysis={a} teaching label="Mini expedition recorded positions and fitted drift" />
    <YearFitDetails analysis={a} teaching />
    <EarlyYearComparison observations={observations} />
    <button className="btn small ghost" onClick={() => { setObservations([{ at: 0, v: 20.08 * DEG }]); setRough(false); setMessage('Fresh mini log: choose your next observing date.'); }}>Start mini expedition again</button>
  </section>;
}
