// Manual checkpoints and the automatic pre-launch save behind "rewind".
// Saved separately from the main save so they survive autosaves. Per-run
// counters (checkpointsUsed, rewindsUsed, debriefSeen) and progress that
// belongs to the player rather than the run (codex, achievements, lessons) are
// never rolled back.

import { clock } from './clock';
import { useGame, type GameState } from './store';

const KEY = 'stranded-checkpoints-v1';
export const SLOTS = 3;

interface Snapshot {
  t: number;
  savedAt: number;
  state: Partial<GameState>;
}

interface Store {
  runId: number;
  slots: (Snapshot | null)[];
  prelaunch: Snapshot | null;
}

const KEEP: (keyof GameState)[] = ['codex', 'achievements', 'atlas', 'logs', 'campaign', 'tutorial', 'checkpointsUsed', 'rewindsUsed', 'debriefSeen', 'runId'];

function read(): Store {
  const runId = useGame.getState().runId;
  try {
    const raw = localStorage.getItem(KEY);
    const st = raw ? (JSON.parse(raw) as Store) : null;
    if (st && st.runId === runId) return st;
  } catch {
    /* storage blocked or corrupt: start empty */
  }
  return { runId, slots: Array(SLOTS).fill(null), prelaunch: null };
}

function write(st: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
    return true;
  } catch {
    return false;
  }
}

function snapshot(): Snapshot {
  const s = useGame.getState();
  const state: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (typeof v !== 'function' && !KEEP.includes(k as keyof GameState)) state[k] = v;
  return { t: clock.t, savedAt: Date.now(), state: JSON.parse(JSON.stringify(state)) };
}

function restore(snap: Snapshot) {
  clock.t = snap.t;
  clock.stopAt = Infinity;
  clock.paused = true;
  useGame.setState({ ...snap.state, phase: 'play', outcome: null, savedT: snap.t });
}

export const listSlots = () => read().slots;

export function saveSlot(i: number) {
  const st = read();
  st.slots[i] = snapshot();
  if (!write(st)) return false;
  const s = useGame.getState();
  useGame.setState({ checkpointsUsed: s.checkpointsUsed + 1 });
  return true;
}

export function loadSlot(i: number) {
  const snap = read().slots[i];
  if (snap) restore(snap);
  return !!snap;
}

/** Called right before a launch; the snapshot sits at the launch planner. */
export function savePrelaunch() {
  const st = read();
  st.prelaunch = snapshot();
  write(st);
}

export const hasPrelaunch = () => !!read().prelaunch;

export function rewindToLaunch() {
  const snap = read().prelaunch;
  if (!snap) return false;
  const s = useGame.getState();
  useGame.setState({ rewindsUsed: s.rewindsUsed + 1 });
  restore(snap);
  useGame.setState({ screen: 'launch' });
  return true;
}

export function clearCheckpoints() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
