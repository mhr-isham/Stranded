/** Near-surface density and a constant scale height for the flight model. */
export interface AtmosphereProfile {
  rho0: number;
  scaleH: number;
}

const EXPEDITION_AIR: AtmosphereProfile = { rho0: 1.1, scaleH: 8500 };
// NASA NSSDCA planet fact sheets. These are nominal profiles rather than local weather.
const MARS_AIR: AtmosphereProfile = { rho0: 0.016, scaleH: 11000 };
const EARTH_AIR: AtmosphereProfile = { rho0: 1.217, scaleH: 8500 };

export function flightAtmosphere(real: boolean, arrival = false): AtmosphereProfile {
  if (!real) return EXPEDITION_AIR;
  return arrival ? EARTH_AIR : MARS_AIR;
}
