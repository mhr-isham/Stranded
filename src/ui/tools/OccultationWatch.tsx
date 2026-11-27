import { useEffect, useMemo, useRef, useState } from 'react';
import { DAY, HOUR } from '../../engine/constants';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { hasChallenge } from '../../game/challenges';
import { fmt } from '../../game/format';
import { alignmentWindow, contactBounds, recordOccultation, repeatInterval, type MoonFrame, type MoonImage, type OccultationRecord } from '../../game/occultationWatch';
import { currentWorld, fastForward } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber } from '../../game/time';
import { Formula } from '../common/sheetBits';
import { useClockState, useGameTime } from '../common/widgets';

export interface WatchView { image: MoonImage | null; reason: string }

const VIEWS: Record<MoonImage, string> = {
  visible: 'Moonlight visible in the eyepiece.',
  fading: 'A faint sliver at the limb.',
  dark: 'No moonlight beside the disk.',
};
const timeLabel = (at: number) => {
  const seconds = Math.floor(at % DAY);
  const hhmmss = [Math.floor(seconds / HOUR), Math.floor(seconds / 60) % 60, seconds % 60].map((n) => String(n).padStart(2, '0')).join(':');
  return `Day ${dayNumber(at)} · ${hhmmss}`;
};

export function OccultationWatch({ read, onCentre, onWiden, onClose }: { read: (at: number) => WatchView; onCentre: () => void; onWiden: () => void; onClose: () => void }) {
  const s = useGame();
  const t = useGameTime(5);
  useClockState();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  const [draft, setDraft] = useState<Pick<OccultationRecord, 'visible' | 'hidden' | 'stillHidden'> | null>(null);
  const [lastVisible, setLastVisible] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const view = read(t);
  const records = s.occultations ?? [];
  const watchHour = Math.floor(t / HOUR) * HOUR;
  const period = s.sheet.Pm?.value;
  const window = useMemo(() => alignmentWindow(s.moonTrack, period ?? NaN, watchHour), [s.moonTrack, period, watchHour]);
  const canStep = !clock.realtime && !Number.isFinite(clock.stopAt);
  const label = draft ? view.image === 'dark' ? 'Mark still hidden' : 'Mark return' : view.image === 'dark' ? 'Mark disappearance' : 'Mark visible';
  const timingSpeed = clock.rate <= 60;
  const ready = view.image === 'visible' || view.image === 'dark' && lastVisible !== null;
  const { system } = currentWorld();

  function waitUntil(at: number) {
    const current = useGame.getState();
    if (current.phase !== 'play' || clock.realtime || Number.isFinite(clock.stopAt) || at <= clock.t) return;
    if (at >= lifeSupportEnd(current, system)) { setNotice('Supplies run out before this wait ends.'); return; }
    clock.paused = true;
    fastForward(at);
  }

  function mark() {
    const at = clock.t;
    const live = read(at);
    if (clock.rate > 60 || !live.image || live.image === 'fading') return;
    if (!draft) {
      if (live.image === 'visible') {
        setLastVisible(at);
        setNotice('Visible frame kept. Mark again when the light disappears.');
      } else if (lastVisible !== null && at > lastVisible && at - lastVisible <= HOUR) {
        setDraft({ visible: lastVisible, hidden: at, stillHidden: at });
        setNotice('Disappearance bracket kept. Keep marking hidden frames until the light returns.');
      } else {
        setNotice('Start with a visible frame within an hour of disappearance.');
        return;
      }
    } else if (live.image === 'dark') {
      if (at <= draft.stillHidden) return;
      setDraft({ ...draft, stillHidden: at });
      setNotice('Latest hidden frame kept. Mark the next visible frame.');
    } else {
      const frames: MoonFrame[] = [
        { at: draft.visible, image: 'visible' }, { at: draft.hidden, image: 'dark' },
        { at: draft.stillHidden, image: 'dark' }, { at, image: 'visible' },
      ];
      const record = recordOccultation(frames);
      if (!record) { setNotice('The return needs a hidden frame within the previous hour, during the same watch.'); return; }
      const current = useGame.getState();
      const existing = current.occultations ?? [];
      if (existing.some((r) => record.visible <= r.returned && r.visible <= record.returned)) {
        setNotice('A watch covering this passage is already in your log.');
        return;
      }
      useGame.setState({ occultations: [...existing, record].sort((a, b) => a.visible - b.visible) });
      setDraft(null);
      setLastVisible(at);
      setNotice('Occultation kept in your watch log.');
    }
    sfx('shutter');
  }

  return <section ref={panel} tabIndex={-1} className="panel panel-pad stack moon-watch" aria-label="Moon occultation watch">
    <div className="row between"><b>Moon occultation watch</b><button className="btn small" onClick={onClose}>Back to moon chart</button></div>
    <div aria-label="Live moon image" className="panel-inset">
      <b role="status">{view.image ? VIEWS[view.image] : view.reason}</b>
      <div className="mono muted">{timeLabel(t)}</div>
    </div>
    <div className="row moon-watch-controls">
      <button className="btn primary" disabled={!ready || !timingSpeed} onClick={mark}>{label}</button>
      <div className="row" role="group" aria-label="Step observing time">
        {[1, 10, 60].map((minutes) => <button key={minutes} className="btn small" disabled={!canStep} onClick={() => waitUntil(clock.t + minutes * 60)}>+{minutes} min</button>)}
      </div>
    </div>
    {!canStep && <div className="faint">Finish or cancel the current clock stop to step through this watch.</div>}
    <div className="row">
      <button className="btn small" onClick={onCentre}>Centre on the planet</button>
      <button className="btn small" onClick={onWiden}>Widen field</button>
      {!clock.paused && <button className="btn small" onClick={() => { clock.paused = true; clock.emit(); }}>Hold this view</button>}
    </div>
    <div aria-live="polite" className="muted">{!timingSpeed ? 'Hold the view or slow the clock to mark a frame.' : notice || 'Watch the light by the limb. Mark a clear visible frame, a hidden frame, then the return.'}</div>
    {(draft || lastVisible !== null) && <div className="row between">
      <span className="faint">{draft ? `Last hidden · ${timeLabel(draft.stillHidden)}` : `Last visible · ${timeLabel(lastVisible!)}`}</span>
      <button className="btn small ghost" onClick={() => { setDraft(null); setLastVisible(null); setNotice(''); }}>Reset marks</button>
    </div>}
    <details className="measurement-help"><summary>Plan a watch</summary>
      {window ? <>
        <p>Your log and entered period suggest an alignment between <b>{timeLabel(window.from)}</b> and <b>{timeLabel(window.to)}</b>. Try the eyepiece around this time. The moon may be in front, or clouds or daylight may hide the view.</p>
        {window.from > t && <button className="btn small" disabled={!canStep} onClick={() => waitUntil(window.from)}>Wait to estimated window</button>}
      </> : <p>Use the tracker to look for the moon passing through zero east–west offset. A fresh recorded crossing and a period on your progress sheet let the watch estimate a broad window.</p>}
      <p>Step forward in larger jumps while scouting and use small steps near the limb. Each mark records the current frame. Keep a visible and hidden frame within one hour on each side of the same event. Normal expedition time and supplies pass as you step.</p>
    </details>
    <WatchLog records={records} manual={hasChallenge(s, 'handFit')} sheetPeriod={s.sheet.Pm?.value} />
  </section>;
}

function WatchLog({ records, manual, sheetPeriod }: { records: OccultationRecord[]; manual: boolean; sheetPeriod?: number }) {
  const [earlier, setEarlier] = useState<number | null>(null), [later, setLater] = useState<number | null>(null);
  const [cycles, setCycles] = useState('1');
  if (!records.length) return null;
  const a = records.find((r) => r.visible === earlier) ?? records.at(-2);
  const b = records.find((r) => r.visible === later) ?? records.at(-1);
  const interval = !manual && a && b ? repeatInterval(a, b, Number(cycles)) : null;
  return <details className="measurement-help"><summary>Watch log ({records.length})</summary>
    <div className="stack">
      {records.slice().reverse().map((r) => <div key={r.visible} className="panel-inset stack">
        <b>{timeLabel(contactBounds(r).midpoint)} · estimated centre of watch</b>
        <span>Disappearance between {timeLabel(r.visible)} and {timeLabel(r.hidden)}</span>
        <span>Return between {timeLabel(r.stillHidden)} and {timeLabel(r.returned)}</span>
      </div>)}
      {records.length > 1 && <>
        <b>Compare passages</b>
        <p>Compare the elapsed time between watch centres to your moon period. Divide by the number of cycles you think passed. The viewing direction changes between dates, and missed passes can make the count ambiguous.</p>
        <Formula>apparent repeat interval = time between watch centres / cycles</Formula>
        {!manual && <>
          <label className="field">Earlier watch<select className="input" value={a?.visible} onChange={(e) => setEarlier(Number(e.target.value))}>
            {records.map((r) => <option key={r.visible} value={r.visible}>{timeLabel(contactBounds(r).midpoint)}</option>)}
          </select></label>
          <label className="field">Later watch<select className="input" value={b?.visible} onChange={(e) => setLater(Number(e.target.value))}>
            {records.map((r) => <option key={r.visible} value={r.visible}>{timeLabel(contactBounds(r).midpoint)}</option>)}
          </select></label>
          <label className="field">Cycles between watches<input className="input" type="number" min="1" step="1" value={cycles} onChange={(e) => setCycles(e.target.value)} /></label>
          {interval ? <div className="callout tip">
            <b>{fmt(interval.seconds / DAY, 4)} days per apparent cycle</b>
            <div>Timing brackets alone give ±{fmt(interval.timing / 60, 1)} min. Allow separately for viewing geometry and the cycle count.</div>
            {sheetPeriod !== undefined && <div>Progress sheet period · {fmt(sheetPeriod / DAY, 4)} days</div>}
          </div> : <div className="muted">Choose watches in date order and enter a positive whole cycle count.</div>}
        </>}
      </>}
    </div>
  </details>;
}
