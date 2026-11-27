import type { PlayerModel } from '../../engine/planner';

/** Describes the entered model, never the generated target's hidden orbit. */
export function PlanningModelNotes({ model }: { model: PlayerModel }) {
  const fitted = model.ecc !== undefined;
  const label = model.giant ? 'Direct and giant flyby using the same orbit model' : fitted ? 'Circular home orbit + fitted target orbit' : `Circular home orbit + ${model.inner ? 'inner' : 'outer'} target`;
  return <div className="panel panel-pad stack planning-model-notes" aria-label="Player planning model">
    <div><span className="meter-label">MODEL IN USE</span><div style={{ fontSize: 13, marginTop: 4 }}>{label}</div></div>
    <details><summary>Model assumptions</summary><div className="stack" style={{ fontSize: 13, paddingTop: 8 }}>
      <p>Home follows a circular orbit. The heliocentric paths share one plane; this does not remove the observing site's tilt, horizon or weather effects.</p>
      <p>{fitted ? 'The target follows the Kepler orbit entered on your sheet, including its fitted period, eccentricity and perihelion direction. Its semi-major axis is an orbit size, not its instantaneous distance from the star. A fitted eccentricity of zero reduces this model to a circle.' : model.giant ? 'The target and giant follow the circular orbits inferred from your entries. The target period comes from its orbit fit; the giant has its own alignment clock.' : `The target is treated as circular. Its year is inferred from your own year and the repeating ${model.inner ? 'inner-planet conjunction/transit' : 'outer-planet opposition'} interval, with the appropriate inner/outer sign.`}</p>
      <p>{model.giant ? 'The direct route uses one leg and the flyby uses two. Each leg is a date-specific, prograde, zero-revolution Lambert solution around the star. The flyby estimates the encounter using patched conics and your measured giant mass.' : 'The selected departure and arrival dates set the two endpoint positions. A prograde, zero-revolution Lambert solution connects them in a two-body model around the star.'}</p>
      <p>Hohmann numbers are a circular, coplanar reference for flight time and alignment. For a fitted ellipse they are only a search-scale estimate, not the chosen trajectory. Leaving and entering planetary gravity use separate escape/capture approximations.</p>
      <p>These assumptions describe your entries; they do not verify them. Additional revolutions, inclined transfers and a full simultaneous many-body trajectory are outside this planner.</p>
    </div></details>
  </div>;
}
