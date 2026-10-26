// Minimal 3-vector helpers on plain tuples (allocation-light, no classes).

export type Vec3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: Vec3): Vec3 => {
  const n = norm(a);
  return n === 0 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
};
/** Angle between two vectors, numerically stable for tiny angles. */
export const angleBetween = (a: Vec3, b: Vec3) => Math.atan2(norm(cross(a, b)), dot(a, b));

/** Rotate about the x axis (ecliptic <-> equatorial uses this with the obliquity). */
export const rotX = (a: Vec3, ang: number): Vec3 => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [a[0], a[1] * c - a[2] * s, a[1] * s + a[2] * c];
};
