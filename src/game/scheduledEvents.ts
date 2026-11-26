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
