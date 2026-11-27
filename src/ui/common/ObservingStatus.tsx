import { GLARE_NOTICE } from '../../engine/solarGlare';
import { DEG } from '../../engine/constants';
import type { OpticalStatus } from '../../game/observing';

/** A small status line, with method details only when requested. */
export function ObservingStatus({ status, site }: { status: OpticalStatus; site?: string }) {
  const { limits } = status;
  return <div className="stack" style={{ gap: 5 }} aria-label="Observing availability">
    <div className={status.ok ? 'muted' : 'amber'} style={{ fontSize: 12 }}>{site ? `${site}: ` : ''}{status.reason}</div>
    <details className="measurement-help"><summary>View details</summary>
      <p>Sun altitude {Number.isFinite(status.sunAlt) ? (status.sunAlt / DEG).toFixed(1) : 'unavailable'}°{status.alt !== undefined && Number.isFinite(status.alt) ? ` · target altitude ${(status.alt / DEG).toFixed(1)}°` : ''}. {status.seeing > 1.5 ? 'Turbulent image; usable views can still be measured with appropriate uncertainty.' : 'Steadier image; allow for remaining blur and alignment error.'}</p>
      {limits.minAlt !== undefined && <p>This method needs the target above {(limits.minAlt / DEG).toFixed(1)}°{limits.minAlt === 0 ? ' and the local horizon' : ''}.</p>}
      {limits.maxSun !== undefined && <p>Sun altitude must be below {(limits.maxSun / DEG).toFixed(1)}°{limits.minSun !== undefined ? ` and above ${(limits.minSun / DEG).toFixed(1)}°` : ''}.</p>}
      {!limits.filtered && (status.solarGlare ?? 0) >= GLARE_NOTICE && <p>Light from the nearby stellar disk scatters inside the unfiltered telescope and washes out fine detail. Wait for more separation or switch to another instrument. The amount of glare is an approximation for this telescope.</p>}
      {limits.filtered && <p>This method uses the fitted solar filter and its daylight/twilight model. It does not require an ordinary dark-sky scan.</p>}
      {limits.references && <p>A usable reference field is required. The model checks bright catalogue stars above the local horizon and the sky-brightness limit; it does not simulate a full sensor or certify individual centring.</p>}
      <p>Clouds or flare glare can block a new observation. Rough seeing changes quality without automatically blocking it. Recorded charts and frozen exposures keep their original values and remain available.</p>
    </details>
  </div>;
}
