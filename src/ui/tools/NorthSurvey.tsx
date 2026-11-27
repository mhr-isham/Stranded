import { DAY, HOUR } from '../../engine/constants';
import { fmt } from '../../game/format';
import type { northSurveyRoute } from '../../game/northSurvey';
import { dayNumber, hhmm } from '../../game/time';
import { CanvasView } from '../common/CanvasView';

type Route = ReturnType<typeof northSurveyRoute>;
const km = (distance: number) => fmt(distance / 1000, 1);
const missionTime = (at: number) => `Day ${dayNumber(at)} · ${hhmm((at % DAY) / HOUR)} expedition`;
const solarTime = (hours: number) => hhmm((Math.round(hours * 60) % (24 * 60)) / 60 + 1e-7);

export function NorthSurveyGraphic({ route }: { route: Route }) {
  return <div className="north-survey-graphic">
    <CanvasView role="img" aria-label={`Camp to north station, ${km(route.station)} kilometres. Rover ${km(route.distance)} kilometres north of camp.`}
      draw={({ ctx, w, h, dpr }) => {
        const left = 24 * dpr, right = w - left, horizon = h * 0.53;
        const extent = Math.max(route.station, route.distance, route.moving ? route.from : 0, 1);
        const X = (distance: number) => left + (right - left) * distance / extent;
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, '#142637'); bg.addColorStop(1, '#080f1c');
        ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#29475a'; ctx.lineWidth = dpr;
        for (const fraction of [0.25, 0.4, 0.68, 0.8]) {
          ctx.beginPath(); ctx.moveTo(left, fraction * h); ctx.lineTo(right, fraction * h); ctx.stroke();
        }
        ctx.beginPath(); ctx.strokeStyle = '#7599ac'; ctx.setLineDash([5 * dpr, 5 * dpr]);
        ctx.moveTo(left, horizon); ctx.lineTo(X(route.station), horizon); ctx.stroke(); ctx.setLineDash([]);
        const pins = [
          { x: left, title: 'CAMP', color: '#6cc4ff', align: 'left' },
          { x: X(route.station), title: route.planned ? 'PLANNED STATION' : 'NORTH STATION', color: '#ffc46b',
            align: X(route.station) > w / 2 ? 'right' : 'left' },
        ] as const;
        ctx.font = `600 ${12 * dpr}px Inter`;
        for (const pin of pins) {
          ctx.fillStyle = pin.color; ctx.textAlign = pin.align;
          ctx.fillText(pin.title, pin.x, horizon - (pin.x !== left && pin.x < left + 96 * dpr ? 32 : 16) * dpr);
          ctx.beginPath(); ctx.arc(pin.x, horizon, 4 * dpr, 0, 2 * Math.PI); ctx.fill();
        }
        const roverX = X(route.distance);
        ctx.fillStyle = '#edf5ff';
        ctx.beginPath();
        ctx.moveTo(roverX, horizon + 4 * dpr); ctx.lineTo(roverX - 5 * dpr, horizon + 12 * dpr);
        ctx.lineTo(roverX, horizon + 20 * dpr); ctx.lineTo(roverX + 5 * dpr, horizon + 12 * dpr);
        ctx.closePath(); ctx.fill();
        ctx.font = `${11 * dpr}px monospace`;
        ctx.textAlign = 'left'; ctx.fillStyle = '#b4cadb'; ctx.fillText('MERIDIAN · NORTH →', left, Math.min(h - 5 * dpr, horizon + 36 * dpr));
      }} />
  </div>;
}

export function NorthSurveyReadout({ route, now }: { route: Route; now: number }) {
  return <div className="stack north-survey-readout">
    <div className="row between"><b>{route.moving ? route.returning ? 'Returning to camp' : 'Rover underway' : route.planned ? 'Rover at camp' : 'Rover on station'}</b>
      <span className="mono">{km(route.distance)} km north</span></div>
    {route.moving && <progress aria-label="Northward rover travel progress" max="1" value={route.progress} />}
    {route.eta !== null && <div>{route.moving ? 'Arrival estimate' : 'Departure now'} · <span className="mono">{fmt((route.eta - now) / HOUR, 1)} h</span> to {route.returning ? 'camp' : 'station'} <span className="muted">· {missionTime(route.eta)}</span></div>}
    <dl className="kv">
      <dt>Camp solar time</dt><dd>{solarTime(route.campHours)}</dd>
      <dt>North station solar time</dt><dd>{solarTime(route.stationHours)}</dd>
      {route.campNoon !== null && <><dt>Next camp noon{route.eta !== null ? ' after arrival' : ''}</dt><dd>{missionTime(route.campNoon)}</dd></>}
      {route.stationNoon !== null && <><dt>Next station noon{route.eta !== null ? ' after arrival' : ''}</dt><dd>{missionTime(route.stationNoon)}</dd></>}
    </dl>
    <p className="faint">Same meridian, shared noon. Capture both views when the Sun is high and the sky is clear.</p>
  </div>;
}
