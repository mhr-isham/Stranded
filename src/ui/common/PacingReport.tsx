import { useEffect, useState } from 'react';
import { PACING_ACTS, PACING_MILESTONES, totalForeground, type PacingRecord } from '../../game/pacing';
import { flushPacing, pausePacingReport } from '../../game/pacingRecorder';
import { useGame } from '../../game/store';
import { Modal } from './widgets';

const duration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
const activityName = (key: string) => ({ hub: 'Camp', observatory: 'Observatory', rover: 'Rover cameras',
  drive: 'Rover driving', map: 'Surface map', launch: 'Launch planner', sheet: 'Progress sheet',
  pendulum: 'Pendulum', hill: 'Hill survey', gnomon: 'Shadow survey', workshop: 'Workshop',
  probe: 'Probe bay', codex: 'Codex' })[key] ?? key;

function saveReport(record: PacingRecord, note: string) {
  const lines = [
    '# Stranded pacing playtest', '', `System seed ${record.seed} · ${record.mode} · survival ${record.survival ? 'on' : 'off'}`,
    `Recorded foreground time: ${duration(totalForeground(record))}`,
    `Record state: ${record.stopped ? 'stopped early' : record.milestones.debrief !== undefined ? 'debrief reached' : 'in progress'}`, '',
    '| Act | Foreground | Scheduled waits | Other warp | After 60s without input |', '|---|---:|---:|---:|---:|',
  ];
  for (const act of PACING_ACTS) {
    const row = record.buckets[act];
    if (!row) continue;
    lines.push(`| ${act} | ${duration(row.foregroundMs)} | ${duration(row.scheduledMs)} | ${duration(row.warpMs)} | ${duration(row.noInputMs)} |`);
  }
  lines.push('', '## Milestones', '');
  for (const [key, name] of PACING_MILESTONES) {
    const at = record.milestones[key];
    if (at !== undefined) lines.push(`- ${name} at ${duration(at)} foreground time`);
  }
  lines.push('', '## Time by screen or activity', '');
  for (const act of PACING_ACTS) {
    const row = record.buckets[act];
    if (!row) continue;
    lines.push(`### ${act}`, '');
    for (const [key, ms] of Object.entries(row.activities).sort((a, b) => b[1] - a[1])) lines.push(`- ${activityName(key)} · ${duration(ms)}`);
    lines.push('');
  }
  lines.push('Scheduled waits and other warp are parts of foreground time. Time without input can overlap either. Screen time measures where the player was. Deliberate watching, confusion, and idle time need player or observer notes.');
  if (note.trim()) lines.push('', '## Player note', '', note.trim());
  const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/markdown;charset=utf-8' }));
  const save = document.createElement('a');
  save.href = url;
  save.download = `stranded-pacing-${record.mode}-${record.seed}.md`;
  save.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PacingReportButton({ top = false }: { top?: boolean }) {
  const record = useGame((s) => s.pacingRecord);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    pausePacingReport(true);
    return () => pausePacingReport(false);
  }, [open]);
  if (!record) return null;
  const stopped = record.stopped || record.milestones.debrief !== undefined;
  return <>
    <button className="btn small" onClick={() => { flushPacing(); setOpen(true); }}>Open local pacing report</button>
    {open && <Modal top={top} onClose={() => setOpen(false)} className="pacing-report-dialog">
      <section className="stack" aria-label="Local pacing report">
        <h2>Local pacing report</h2>
        <div className="muted">{record.stopped ? 'Recording stopped' : stopped ? 'Debrief reached' : 'Recording resumes when you close this report'} · {duration(totalForeground(record))} foreground</div>
        <div className="pacing-table">
          <table className="log">
            <thead><tr><th>Act</th><th>Foreground</th><th>Scheduled</th><th>Other warp</th></tr></thead>
            <tbody>{PACING_ACTS.map((act) => {
              const row = record.buckets[act];
              return row && <tr key={act}><th scope="row">{act}</th><td>{duration(row.foregroundMs)}</td><td>{duration(row.scheduledMs)}</td><td>{duration(row.warpMs)}</td></tr>;
            })}</tbody>
          </table>
        </div>
        <p className="faint">The download includes time by tool or screen, milestones, and time after 60 seconds without input. Watching the sky can also be quiet, so use a note if it helps explain a long stretch.</p>
        <PacingDownload record={record} />
        {!stopped && <button className="btn small ghost" onClick={() => {
          flushPacing();
          const latest = useGame.getState().pacingRecord;
          if (latest) useGame.setState({ pacingRecord: { ...latest, stopped: true } });
        }}>Stop recording for this run</button>}
      </section>
    </Modal>}
  </>;
}

function PacingDownload({ record }: { record: PacingRecord }) {
  const [note, setNote] = useState('');
  return <div className="stack">
    <label className="field">What slowed you down or kept you exploring? <span className="faint">(optional)</span>
      <textarea className="input" value={note} maxLength={1200} onChange={(e) => setNote(e.target.value)} rows={3} />
    </label>
    <button className="btn primary" onClick={() => { flushPacing(); saveReport(useGame.getState().pacingRecord ?? record, note); }}>Download pacing report</button>
  </div>;
}
