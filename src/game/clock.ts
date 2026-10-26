// The game clock lives outside React so canvases can read it every frame
// without causing re-renders. React components subscribe at a low rate.

export interface Warp {
  label: string;
  rate: number; // game seconds per real second
}

export const WARPS: Warp[] = [
  { label: '1×', rate: 1 },
  { label: '1 min/s', rate: 60 },
  { label: '10 min/s', rate: 600 },
  { label: '1 h/s', rate: 3600 },
  { label: '6 h/s', rate: 21600 },
  { label: '1 day/s', rate: 86400 },
  { label: '5 days/s', rate: 432000 },
  { label: '20 days/s', rate: 1728000 },
];

type Listener = () => void;

export const clock = {
  t: 0,
  warpIndex: 3,
  paused: false,
  /** When set, the clock runs at real time regardless of warp (pendulum, stopwatch). */
  realtime: false,
  /** Hard stop: the clock will not advance past this time (e.g. "wait until"). */
  stopAt: Infinity as number,
  listeners: new Set<Listener>(),
  get rate() {
    if (this.paused) return 0;
    return this.realtime ? 1 : WARPS[this.warpIndex].rate;
  },
  emit() {
    this.listeners.forEach((l) => l());
  },
};

export function subscribeClock(l: Listener) {
  clock.listeners.add(l);
  return () => void clock.listeners.delete(l);
}

export function setWarp(i: number) {
  clock.warpIndex = Math.max(0, Math.min(WARPS.length - 1, i));
  clock.paused = false;
  clock.emit();
}

export function togglePause() {
  clock.paused = !clock.paused;
  clock.emit();
}
