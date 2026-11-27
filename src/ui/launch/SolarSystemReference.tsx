import { QUANTITY_INFO, type Estimate, type QuantityKey } from '../../engine/chain';
import { toDisplay, sig } from '../../game/format';

type Datum = { key: QuantityKey; label: string; published: number };

const sources = {
  mars: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
  earth: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
  orbits: 'https://ssd.jpl.nasa.gov/planets/approx_pos.html',
};

const tables: { body: 'Mars' | 'Earth'; data: Datum[] }[] = [
  { body: 'Mars', data: [
    { key: 'R1', label: 'Mean radius', published: 3389.5 },
    { key: 'g', label: 'Mean surface gravity', published: 3.73 },
    { key: 'M1', label: 'Mass', published: 0.64169 },
    { key: 'P1', label: 'Sidereal year', published: 686.980 },
    { key: 'a1', label: 'Orbital semi-major axis', published: 227.956 },
  ] },
  { body: 'Earth', data: [
    { key: 'R2', label: 'Mean radius', published: 6371 },
    { key: 'M2', label: 'Mass', published: 5.9722 },
    { key: 'P2', label: 'Sidereal year', published: 365.256 },
    { key: 'a2', label: 'Orbital semi-major axis', published: 149.598 },
  ] },
];

function compare(estimate: Estimate | undefined, datum: Datum) {
  if (!estimate || !Number.isFinite(estimate.value) || !Number.isFinite(estimate.sigma) || estimate.sigma < 0) return null;
  const value = toDisplay(datum.key, estimate.value);
  const uncertainty = toDisplay(datum.key, estimate.sigma);
  const offset = Math.abs(value - datum.published);
  const percent = offset / datum.published * 100;
  return { value, uncertainty, inside: offset <= uncertainty, difference: percent < .005 ? '<0.005%' : `${sig(percent, 3)}%` };
}

export function SolarSystemReference({ rows }: { rows: { k: QuantityKey; e?: Estimate }[] }) {
  const readings = new Map(rows.map(({ k, e }) => [k, e]));
  return <section className="panel panel-pad stack solar-reference" aria-label="Mars and Earth reference comparison">
    <h2>Compare with NASA’s Mars and Earth values</h2>
    <p className="muted">See how far your estimates are from the published values and whether each falls inside your stated uncertainty.</p>
    <div className="solar-reference-grid">
      {tables.map(table => <section className="panel-inset solar-reference-body" aria-label={`${table.body} reference values`} key={table.body}>
        <h3>{table.body}</h3>
        <dl className="solar-reference-rows">
          {table.data.map(datum => {
            const reading = compare(readings.get(datum.key), datum);
            const unit = QUANTITY_INFO[datum.key].unit;
            return <div className="solar-reference-row" key={datum.key}>
              <dt>{datum.label} <small>({unit})</small></dt>
              <dd>
                <span><b>NASA</b> <span className="mono">{datum.published.toLocaleString('en-US', { maximumFractionDigits: 6 })}</span></span>
                {reading ? <><span><b>You</b> <span className="mono">{sig(reading.value, 6)} ± {sig(reading.uncertainty, 3)}</span></span>
                  <span className={reading.inside ? 'green' : 'amber'}>{reading.difference} away · {reading.inside ? 'inside your range' : 'outside your range'}</span>
                </> : <span className="faint">No usable estimate logged</span>}
              </dd>
            </div>;
          })}
        </dl>
      </section>)}
    </div>
    <details className="measurement-help">
      <summary>Why the mission and the reference can differ</summary>
      <p>The game uses circular, coplanar orbits and a simulated arrival phase. Mars and Earth have eccentric, mutually inclined orbits. The dates and changing separations shown in the mission belong to that simulation. In the real Solar System an inferior conjunction can pass above or below the Sun.</p>
      <p>NASA gives mean radii and gravity, plus sidereal periods and orbital sizes. JPL describes its approximate orbital elements relative to J2000. The mission uses elapsed days from arrival and does not evaluate ephemerides at that epoch.</p>
      <p>Atmospheric braking uses nominal surface densities and a constant scale height for each planet. It omits local weather and seasonal density changes. The entry corridor is simplified. Mission scores use the simulated system values below.</p>
      <div className="row solar-reference-links">
        <a href={sources.mars} target="_blank" rel="noreferrer">NASA Mars Fact Sheet</a>
        <a href={sources.earth} target="_blank" rel="noreferrer">NASA Earth Fact Sheet</a>
        <a href={sources.orbits} target="_blank" rel="noreferrer">JPL orbital elements</a>
      </div>
    </details>
  </section>;
}
