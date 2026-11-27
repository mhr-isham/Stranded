import { clock } from './clock';
import { samplePacing, type PacingRecord } from './pacing';
import { useGame } from './store';

let draft: PacingRecord | null = null, runId = 0, dirty = false;
let lastInput = 0;
let showReport = false;

export function pacingInput(now: number) {
  if (useGame.getState().pacingRecord) lastInput = now;
}

export function pausePacingReport(open: boolean) {
  showReport = open;
}

export function tickPacing(now: number, dtSeconds: number, visible: boolean) {
  const state = useGame.getState(), record = state.pacingRecord;
  if (!record || record.stopped || runId !== state.runId) {
    draft = null;
    dirty = false;
    runId = state.runId;
    lastInput = now;
  }
  if (!record || record.stopped || showReport || !visible) return;
  draft ??= structuredClone(record);
  if (draft.milestones.debrief !== undefined) return;
  dirty = samplePacing(draft, state, dtSeconds * 1000, now - lastInput, clock.rate, Number.isFinite(clock.stopAt)) || dirty;
}

// Fold the buffer into the game's existing save. Replacing a run never
// writes stale seconds back into its successor.
export function flushPacing() {
  const current = useGame.getState();
  if (!dirty || !draft || current.runId !== runId || !current.pacingRecord || current.pacingRecord.stopped) return false;
  useGame.setState({ pacingRecord: structuredClone(draft), savedT: clock.t });
  dirty = false;
  return true;
}
