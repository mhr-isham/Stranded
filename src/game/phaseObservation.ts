import { DEG } from '../engine/constants';
import type { PlanetPhase } from '../engine/planetPhase';

export interface PhaseSighting {
  at: number;
  phase: PlanetPhase;
  separation: number;
  seeing: number;
  note: string;
}

export type PhaseView = { sighting: Omit<PhaseSighting, 'note'> | null; reason: string };
export const phaseElongation = (radians: number) => Math.round(radians / DEG * 2) / 2;
