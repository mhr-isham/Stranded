import type { SkyLight } from './skyObservation';

export interface SketchStar { x: number; y: number; tint: SkyLight['tint'] }
export type SketchLink = [number, number];
export interface SketchField { at: number; view: string; stars: SketchStar[] }
export interface ConstellationSketch extends SketchField {
  id: string;
  name: string;
  links: SketchLink[];
}

export const SKETCH_LIMIT = 6;

export function sketchStars(lights: SkyLight[], width: number, height: number): SketchStar[] {
  return lights.filter(light => light.ref.kind === 'catalog' && light.x >= 0 && light.x <= width && light.y >= 0 && light.y <= height)
    .slice(0, 24).map(light => ({ x: light.x / width, y: light.y / height, tint: light.tint }));
}

export function connectStars(links: SketchLink[], first: number, second: number, count: number): SketchLink[] {
  if (![first, second].every(index => Number.isInteger(index) && index >= 0 && index < count) || first === second) return links;
  const a = Math.min(first, second), b = Math.max(first, second);
  return links.some(([x, y]) => x === a && y === b) ? links : [...links, [a, b]];
}
