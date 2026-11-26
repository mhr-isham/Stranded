import { useMemo, useState } from 'react';
import { DEG } from '../../engine/constants';
import { clock } from '../../game/clock';
import { connectStars, sketchStars, SKETCH_LIMIT, type ConstellationSketch, type SketchField, type SketchLink } from '../../game/constellationSketch';
import { opticalWeather } from '../../game/observing';
import { currentWorld } from '../../game/sim';
import { visibleSkyLights } from '../../game/skyObservation';
import { useGame } from '../../game/store';
import { dayNumber } from '../../game/time';
import { makeLandscape } from '../../render/terrain';
import { sfx } from '../../game/audio';

const WIDTH = 320, HEIGHT = 200;
const VIEWS = ['North', 'East', 'South', 'West'] as const;

function SketchChart({ field, links, picked, onPick }: {
  field: SketchField;
  links: SketchLink[];
  picked?: number | null;
  onPick?: (index: number) => void;
}) {
  const stars = field.stars;
  return <div className="sketch-chart" role={onPick ? 'group' : 'img'} aria-label={onPick ? 'Stars in your captured field' : `Saved pattern with ${links.length} lines`}>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
      {links.map(([a, b]) => stars[a] && stars[b] && <line key={`${a}:${b}`}
        x1={stars[a].x * WIDTH} y1={stars[a].y * HEIGHT}
        x2={stars[b].x * WIDTH} y2={stars[b].y * HEIGHT} />)}
      {!onPick && stars.map((star, index) => <circle key={index} cx={star.x * WIDTH} cy={star.y * HEIGHT} r={2} />)}
    </svg>
    {onPick && stars.map((star, index) => <button key={index} type="button" className="sketch-star"
      style={{ left: `${100 * star.x}%`, top: `${100 * star.y}%` }}
      aria-label={`Star ${index + 1}, ${star.tint}`} aria-pressed={picked === index} onClick={() => onPick(index)} />)}
  </div>;
}

export function ConstellationSketchpad() {
  const saved = useGame(s => s.constellationSketches);
  const { system, catalog } = currentWorld();
  const land = useMemo(() => makeLandscape(system.seed, system.hillHeight), [system.seed, system.hillHeight]);
  const [view, setView] = useState(2);
  const [field, setField] = useState<SketchField | null>(null);
  const [links, setLinks] = useState<SketchLink[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  const [lastSaved, setLastSaved] = useState<{ field: SketchField; links: SketchLink[]; name: string } | null>(null);

  function capture() {
    const state = useGame.getState(), at = clock.t;
    const weather = opticalWeather(system, state, at);
    const sky = visibleSkyLights(system, catalog, at, { az: view * 90 * DEG, alt: 43 * DEG, fov: 95 * DEG, w: WIDTH, h: HEIGHT },
      land, weather.cloudy || weather.flare);
    const stars = sketchStars(sky, WIDTH, HEIGHT);
    if (stars.length < 2) {
      setNotice(weather.cloudy ? 'Clouds cover the field.' : weather.flare ? 'Flare glare covers the field.' : 'Too few bright stars here. Try another direction or a darker sky.');
      return;
    }
    setField({ at, view: VIEWS[view], stars });
    setLinks([]);
    setPicked(null);
    setName('');
    setNotice('Field captured. Choose two stars to draw a line.');
    sfx('shutter');
  }

  function pick(index: number) {
    if (picked === null) { setPicked(index); setNotice(`Star ${index + 1} selected. Choose another star.`); return; }
    const next = connectStars(links, picked, index, field?.stars.length ?? 0);
    setLinks(next);
    setPicked(null);
    setNotice(next !== links ? 'Line added.' : picked === index ? 'Selection cleared.' : 'That line is already drawn.');
  }

  function keep() {
    if (!field || !links.length) return;
    const label = name.trim() || 'Untitled constellation';
    const state = useGame.getState();
    const record: ConstellationSketch = { ...field, links, name: label, id: `${state.runId}:${Date.now()}` };
    state.set({ constellationSketches: [record, ...state.constellationSketches].slice(0, SKETCH_LIMIT) });
    setLastSaved({ field, links, name });
    setNotice(`Saved “${label}”.`);
    sfx('log');
  }

  return <section className="stack" aria-label="Constellation sketchpad">
    <p className="muted timeline-intro">Capture bright stars from the sky, connect a few, and give your pattern a name. The captured field stays still while expedition time passes.</p>
    <div className="row sketch-capture">
      <label className="field">Look toward<select className="input" value={view} onChange={e => setView(Number(e.target.value))}>
        {VIEWS.map((label, index) => <option key={label} value={index}>{label}</option>)}
      </select></label>
      <button className="btn primary" onClick={capture}>{field ? 'Capture new field' : 'Capture star field'}</button>
    </div>
    {field && <>
      <span className="muted">Day {dayNumber(field.at)} · {field.view.toLowerCase()} field · {field.stars.length} bright stars</span>
      <SketchChart field={field} links={links} picked={picked} onPick={pick} />
      <div className="row between">
        <button className="btn small" disabled={!links.length} onClick={() => {
          setLinks(links.slice(0, -1)); setPicked(null); setNotice('Last line removed.');
        }}>Undo line</button>
        <span className="mono">{links.length} {links.length === 1 ? 'line' : 'lines'}</span>
      </div>
      <label className="field">Sketch name<input className="input" value={name} maxLength={48} onChange={e => setName(e.target.value)} /></label>
      <button className="btn small" disabled={!links.length || lastSaved?.field === field && lastSaved.links === links && lastSaved.name === name} onClick={keep}>Save sketch</button>
    </>}
    {notice && <span className="muted" role="status">{notice}</span>}
    {saved.length > 0 && <details className="measurement-help"><summary>Saved sketches ({saved.length})</summary>
      <p>Your six latest sketches from this expedition.</p>
      <div className="stack">{saved.map(sketch => <details className="panel-inset" key={sketch.id}>
        <summary>{sketch.name} · Day {dayNumber(sketch.at)}</summary>
        <SketchChart field={sketch} links={sketch.links} />
      </details>)}</div>
    </details>}
  </section>;
}
