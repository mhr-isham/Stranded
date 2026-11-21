// Manual checkpoints and the automatic pre-launch save behind "rewind".
// Saved separately from the main save so they survive autosaves. Per-run
// counters and earned investigation credit, and progress that
// belongs to the player rather than the run (codex, achievements, lessons) are
// never rolled back.

import { clock } from './clock';
import { useGame, type GameState } from './store';
import { VERIFICATION_COST } from './verification';
import { modeOf } from './modes';

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

const KEEP: (keyof GameState)[] = ['codex', 'achievements', 'atlas', 'logs', 'campaign', 'tutorial', 'training', 'schoolRewards', 'radiusFieldNote', 'radiusDiscoveries', 'checkpointsUsed', 'rewindsUsed', 'debriefSeen', 'runId', 'cadetHelp', 'piloting', 'pendulumMilestones', 'sharpEyeAwards', 'sharpEyeNotified'];

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
  const current = useGame.getState();
  const savedChecks = snap.state.checksUsed ?? 0;
  const checksUsed = Math.max(current.checksUsed, savedChecks);
  const spentSinceSave = Math.max(0, checksUsed - savedChecks) * VERIFICATION_COST;
  const hintsSeen = { ...snap.state.hintsSeen, ...current.hintsSeen };
  for (const key of Object.keys(hintsSeen)) hintsSeen[key] = Math.max(current.hintsSeen?.[key] ?? 0, snap.state.hintsSeen?.[key] ?? 0);
  const paid = modeOf((snap.state.settings ?? current.settings).difficulty).hintsCost;
  // Legacy slots can contain different branches of unlocked hints. Preserve
  // their union and at least one paid use per unlocked level, without refunds.
  const paidLevels = paid ? Object.values(hintsSeen).reduce<number>((total, level) => total + (level ?? 0), 0) : 0;
  const hintsUsed = Math.max(current.hintsUsed, snap.state.hintsUsed ?? 0, paidLevels);
  clock.t = snap.t;
  clock.stopAt = Infinity;
  clock.paused = true;
  useGame.setState({ ...snap.state, sharpEyeAwards: current.sharpEyeAwards ?? {}, sharpEyeNotified: current.sharpEyeNotified ?? [], moonStudies: snap.state.moonStudies ?? [], parallaxPair: snap.state.parallaxPair ?? null, parallaxInvestigations: snap.state.parallaxInvestigations ?? [], hintsSeen, hintsUsed, checksUsed, verificationHistory: current.verificationHistory ?? [], penaltyDv: (snap.state.penaltyDv ?? 0) + spentSinceSave, phase: 'play', outcome: null, savedT: snap.t });
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
