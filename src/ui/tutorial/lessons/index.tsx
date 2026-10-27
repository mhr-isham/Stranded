// Registry of interactive lessons, used by Flight School and the Codex.

import type { ComponentType } from 'react';
import { DeltaVLesson, HonestyLesson, MeasureLesson, PropagationLesson } from './basics';
import { AngularLesson, MoonLesson, ParallaxLesson } from './distance';
import { HohmannLesson } from './flight';
import { EstimateLesson } from './estimate';
import { EllipseLesson, FlybyLesson, InnerLesson, LockedLesson, RefractionLesson, SlingshotLesson, StellarLesson } from './chapters';
import { HorizonLesson, MassLesson, PendulumLesson } from './ground';
import { KeplerLesson, RetrogradeLesson, SynodicLesson, TwinkleLesson, YearLesson } from './sky';

export const LESSONS = {
  measure: { title: 'Every measurement has an error', icon: '📏', C: MeasureLesson },
  honesty: { title: 'Error bars and your score', icon: '⚖️', C: HonestyLesson },
  pendulum: { title: 'A pendulum is a gravity meter', icon: '⏱', C: PendulumLesson },
  horizon: { title: 'The horizon dip measures the planet', icon: '⛰', C: HorizonLesson },
  mass: { title: 'Weighing a planet', icon: '🌍', C: MassLesson },
  propagation: { title: 'How errors grow along the chain', icon: '🔗', C: PropagationLesson },
  twinkle: { title: 'Stars twinkle, planets don’t', icon: '✨', C: TwinkleLesson },
  year: { title: 'Measuring the year', icon: '📅', C: YearLesson },
  retrograde: { title: 'Retrograde loops and opposition', icon: '➰', C: RetrogradeLesson },
  synodic: { title: 'The synodic period', icon: '🏃', C: SynodicLesson },
  kepler: { title: 'Kepler’s third law', icon: '🪐', C: KeplerLesson },
  parallax: { title: 'Parallax: the distance scale', icon: '👁', C: ParallaxLesson },
  angular: { title: 'Angular size', icon: '🔭', C: AngularLesson },
  moon: { title: 'Weighing a planet with its moon', icon: '🌙', C: MoonLesson },
  hohmann: { title: 'The Hohmann transfer', icon: '🚀', C: HohmannLesson },
  deltav: { title: 'Fuel is Δv', icon: '⛽', C: DeltaVLesson },
  estimate: { title: 'Making a good estimate', icon: '🎯', C: EstimateLesson },
  flyby: { title: 'Weighing a planet with a flyby', icon: '🛰', C: FlybyLesson },
  refraction: { title: 'Light bends in air · Eratosthenes', icon: '🌅', C: RefractionLesson },
  inner: { title: 'Inner planets and transits', icon: '🌗', C: InnerLesson },
  ellipse: { title: 'Kepler’s laws: ellipses', icon: '🥚', C: EllipseLesson },
  locked: { title: 'Tidal locking and flares', icon: '🔴', C: LockedLesson },
  slingshot: { title: 'Gravity assists', icon: '☄️', C: SlingshotLesson },
  stellar: { title: 'The distances of the stars', icon: '✨', C: StellarLesson },
} satisfies Record<string, { title: string; icon: string; C: ComponentType }>;

export type LessonId = keyof typeof LESSONS;
export const LESSON_IDS = Object.keys(LESSONS) as LessonId[];
