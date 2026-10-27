// Plays queued story scenes one line at a time. Tap to advance; Skip closes
// the scene (it stays in the Codex under Logs).

import { useEffect, useState } from 'react';
import { clock } from '../game/clock';
import { LOGS, SPEAKER, type StoryLog } from '../game/story';
import { useGame } from '../game/store';
import { useTypewriter } from './Intro';

export function StoryHost() {
  const queue = useGame((s) => s.storyQueue);
  const id = queue[0];
  const log = id ? LOGS[id] : null;
  useEffect(() => {
    if (!log) return;
    const was = clock.paused;
    clock.paused = true;
    clock.emit();
    return () => {
      clock.paused = was;
      clock.emit();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!log) return null;
  return <StoryScene key={id} log={log} onClose={() => useGame.setState((s) => ({ storyQueue: s.storyQueue.slice(1) }))} />;
}

export function StoryScene({ log, onClose }: { log: StoryLog; onClose: () => void }) {
  const [i, setI] = useState(0);
  const line = log.lines[i];
  const tw = useTypewriter(line.text, 60);
  const sp = SPEAKER[line.who];
  const next = () => {
    if (!tw.done) return tw.finish();
    if (i < log.lines.length - 1) setI(i + 1);
    else onClose();
  };
  return (
    <div className="modal-back story-back" onClick={next}>
      <div className={`panel story-card ${log.kind}`} onClick={(e) => (e.stopPropagation(), next())}>
        <div className="row between">
          <span className="meter-label">{log.kind === 'journal' ? 'Found · journal page' : log.kind === 'discovery' ? 'Discovery' : 'Log'}</span>
          <div className="progress-dots">
            {log.lines.map((_, k) => (
              <i key={k} className={k <= i ? 'on' : ''} />
            ))}
          </div>
        </div>
        <h2>{log.title}</h2>
        {sp.name && <div className={`story-who ${sp.cls}`}>{sp.name}</div>}
        <p className={line.who === 'note' ? 'story-note' : line.who === 'mira' ? 'story-journal' : ''}>{tw.shown}</p>
        <div className="row between">
          <button className="btn ghost small" onClick={(e) => (e.stopPropagation(), onClose())}>
            Skip
          </button>
          <button className="btn primary" onClick={(e) => (e.stopPropagation(), next())}>
            {i < log.lines.length - 1 ? 'Next' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
