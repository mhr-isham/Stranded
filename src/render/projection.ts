// Stereographic camera for the sky. Directions are given in the local horizon
// frame as (east, north, up) unit vectors.

export type Dir = [number, number, number];

export interface Camera {
  az: number; // view centre azimuth (rad, from north towards east)
  alt: number; // view centre altitude (rad)
  fov: number; // horizontal field of view (rad)
  w: number;
  h: number;
}

export const dirFromAltAz = (alt: number, az: number): Dir => {
  const c = Math.cos(alt);
  return [c * Math.sin(az), c * Math.cos(az), Math.sin(alt)];
};

export const altAzFromDir = (d: Dir) => ({
  alt: Math.asin(Math.max(-1, Math.min(1, d[2]))),
  az: Math.atan2(d[0], d[1]),
});

export interface Projector {
  /** Screen position, or null when behind the camera. */
  project(d: Dir): { x: number; y: number; z: number } | null;
  unproject(x: number, y: number): Dir;
  /** Allocation-free projection for hot loops: writes into out, returns false if behind. */
  projectXYZ(dx: number, dy: number, dz: number, out: { x: number; y: number }): boolean;
  scale: number; // pixels per radian at the centre
}

export function makeProjector(cam: Camera): Projector {
  const f = dirFromAltAz(cam.alt, cam.az);
  // right = f x up(0,0,1), normalised; camUp = right x f
  let r: Dir = [f[1], -f[0], 0];
  const rn = Math.hypot(r[0], r[1]) || 1;
  r = [r[0] / rn, r[1] / rn, 0];
  const u: Dir = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const k = cam.w / 2 / (2 * Math.tan(cam.fov / 4));
  const cx = cam.w / 2;
  const cy = cam.h / 2;
  return {
    scale: k,
    project(d) {
      const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
      if (z < -0.3) return null;
      const s = (2 * k) / (1 + z);
      const x = d[0] * r[0] + d[1] * r[1] + d[2] * r[2];
      const y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
      return { x: cx + x * s, y: cy - y * s, z };
    },
    projectXYZ(dx, dy, dz, out) {
      const z = dx * f[0] + dy * f[1] + dz * f[2];
      if (z < -0.3) return false;
      const s = (2 * k) / (1 + z);
      out.x = cx + (dx * r[0] + dy * r[1] + dz * r[2]) * s;
      out.y = cy - (dx * u[0] + dy * u[1] + dz * u[2]) * s;
      return true;
    },
    unproject(px, py) {
      const X = (px - cx) / (2 * k);
      const Y = -(py - cy) / (2 * k);
      const rho2 = X * X + Y * Y;
      const z = (1 - rho2) / (1 + rho2);
      const sxy = 2 / (1 + rho2);
      const x = X * sxy;
      const y = Y * sxy;
      return [f[0] * z + r[0] * x + u[0] * y, f[1] * z + r[1] * x + u[1] * y, f[2] * z + r[2] * x + u[2] * y];
    },
  };
}
