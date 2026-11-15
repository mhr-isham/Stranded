export type FlightAction = 'left' | 'right' | 'thrust';

/** Aggregate keyboard and multiple pointers; releasing one source keeps others held. */
export function createFlightInput() {
  const sources: Record<FlightAction, Set<string>> = { left: new Set(), right: new Set(), thrust: new Set() };
  const held = { left: false, right: false, thrust: false };
  return {
    held,
    set(action: FlightAction, source: string, on: boolean) {
      if (on) sources[action].add(source);
      else sources[action].delete(source);
      const next = sources[action].size > 0;
      const changed = held[action] !== next;
      held[action] = next;
      return changed;
    },
    clear() {
      for (const action of ['left', 'right', 'thrust'] as const) {
        sources[action].clear();
        held[action] = false;
      }
    },
  };
}

export const flightSensitivity = (value?: number) => Number.isFinite(value) ? Math.max(0.5, Math.min(1.5, value!)) : 1;
