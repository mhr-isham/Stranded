import type { GameState } from './store';

type PublicSchedule = Pick<GameState, 'rover' | 'northTrip' | 'surface' | 'roverOuting'>;
export interface ScheduledEvent {
  id: 'camera-rover' | 'shadow-rover' | 'surface-task' | 'camera-plan';
  label: string;
  source: string;
  at: number;
}

const surfaceLabels = {
  drive: 'Surface rover arrival',
  tow: 'Camp tow complete',
  haul: 'Ice haul returns',
  process: 'Ice processing complete',
};

/** An allowlist of schedules already available to the player. This layer has
 * no access to predictions, their reveal times, or generated sky events. */
export function scheduledEvents(schedule: PublicSchedule, now: number): ScheduledEvent[] {
  const events: ScheduledEvent[] = [
    { id: 'camera-rover', label: 'Camera rover arrival', source: 'Rover route', at: schedule.rover.arriveAt },
    { id: 'shadow-rover', label: 'Shadow rover arrival', source: 'Northward survey route', at: schedule.northTrip.arriveAt },
  ];
  const task = schedule.surface.task;
  if (task && surfaceLabels[task.kind]) {
    events.push({ id: 'surface-task', label: surfaceLabels[task.kind], source: 'Surface job schedule', at: task.done });
  }
  const plan = schedule.roverOuting;
  if (plan && plan.capturedAt === undefined) {
    events.push({ id: 'camera-plan', label: 'Saved camera outing', source: 'Your track estimate', at: plan.at });
  }
  return events.filter(event => Number.isFinite(event.at) && event.at > now).sort((a, b) => a.at - b.at);
}

type EventTool = 'rover' | 'gnomon' | 'map';
const eventTools: Record<ScheduledEvent['id'], { screen: EventTool; action: string }> = {
  'camera-rover': { screen: 'rover', action: 'Open rover camera' },
  'shadow-rover': { screen: 'gnomon', action: 'Open shadow survey' },
  'surface-task': { screen: 'map', action: 'Open surface map' },
  'camera-plan': { screen: 'rover', action: 'Open rover camera' },
};

export interface TimelineEntry {
  id: ScheduledEvent['id'] | 'launch-window';
  label: string;
  at: number;
  kind: 'Scheduled' | 'Saved' | 'Estimated';
  source: string;
  screen: EventTool | 'launch';
  action: string;
  roverBusy?: boolean;
}

/** The launch date comes from the same player model already exposed in the HUD. */
export function expeditionTimeline(schedule: PublicSchedule, now: number, launchWindow?: number): TimelineEntry[] {
  const entries = scheduledEvents(schedule, now).map((event): TimelineEntry => {
    const saved = event.id === 'camera-plan';
    const task = schedule.surface.task;
    return {
      id: event.id,
      label: event.label,
      at: event.at,
      kind: saved ? 'Saved' : 'Scheduled',
      source: saved ? 'Track estimate you chose to keep' : event.source,
      ...eventTools[event.id],
      roverBusy: saved && (schedule.rover.arriveAt > event.at || schedule.northTrip.arriveAt > event.at ||
        !!task && task.kind !== 'process' && task.done > event.at),
    };
  });
  if (launchWindow !== undefined && Number.isFinite(launchWindow) && launchWindow >= now) {
    entries.push({ id: 'launch-window', label: 'Launch window', at: launchWindow, kind: 'Estimated',
      source: 'From your navigation sheet', screen: 'launch', action: 'Open launch planner' });
  }
  return entries.sort((a, b) => a.at - b.at);
}
