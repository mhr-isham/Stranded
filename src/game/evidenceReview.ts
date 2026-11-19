import { DAY } from '../engine/constants';
import { deriveAll, derivedFor, keysFor, QUANTITY_INFO, uncertaintyBudget, type ChainVariant, type Estimate, type PrimaryKey, type QuantityKey } from '../engine/chain';
import { readingStats, type GameState } from './store';
import { conditionUncertainty } from './measurementEnvironment';
import { showQuantity, sig, toDisplay } from './format';
const uncertainty = (key: QuantityKey, value: number) => `${sig(toDisplay(key, value), 2)} ${QUANTITY_INFO[key].unit}`;

/** Deliberately excludes the generated world, probe truth, seed and difficulty. */
export type Evidence = Pick<GameState, 'sheet' | 'readings' | 'starObs' | 'oppPicks' | 'oppPicksG' | 'moonTrack' | 'moonTrackG' | 'track' | 'starPar' | 'shadows'>;
export interface EvidenceReview { facts: string[]; why: string[]; next: string[] }

export function enteredEstimate(s: Pick<GameState, 'sheet'>, key: QuantityKey, variant: ChainVariant): Estimate | undefined {
  const e = keysFor(variant).includes(key as PrimaryKey) ? s.sheet[key as PrimaryKey] : deriveAll(s.sheet, variant)[key as keyof ReturnType<typeof deriveAll>];
  return e && Number.isFinite(e.value) && Number.isFinite(e.sigma) && e.sigma > 0 ? e : undefined;
}

/** All conclusions follow from saved observations and the player's own model. */
export function reviewEvidence(s: Evidence, key: QuantityKey, variant: ChainVariant, concise = false): EvidenceReview | null {
  const e = enteredEstimate(s, key, variant);
  if (!e) return null;
  const facts: string[] = [], why: string[] = [], next: string[] = [];
  const def = derivedFor(variant)[key as keyof ReturnType<typeof derivedFor>];
  const relevant = def ? def.inputs : [key as PrimaryKey];
  const readings = s.readings.filter((r) => relevant.includes(r.key) && r.kept);
  const stats = readingStats(readings, key as PrimaryKey);
  if (key === 'R1' && s.shadows.length) {
    facts.push(`${s.shadows.length} saved shadow observations are available for an independent radius method.`);
    why.push('The shadow method needs matched local-noon observations and a known north–south baseline. A horizon result is not an independent calibration of itself.');
    next.push('Review the paired noon observations, baseline and their uncertainties before comparing the shadow and horizon results.');
  }
  if (stats) {
    const same = Math.abs(e.value - stats.mean) <= Math.max(1e-12, Math.abs(stats.mean) * 1e-8);
    facts.push(`${stats.n} kept reading${stats.n === 1 ? '' : 's'} average ${showQuantity(key, stats.mean)}. Your entry ${same ? 'matches this average' : `is ${showQuantity(key, e.value)}; it differs from this average`}.`);
    if (stats.revisions) facts.push(`${stats.revisions} earlier kept mark/timing revision(s) share a recorded source; only its latest kept version enters the average.`);
    if (stats.invalid) facts.push(`${stats.invalid} nonfinite kept reading(s) cannot enter this average.`);
    if (!same) why.push('A difference may reflect a transcription error or a deliberate adjustment. Document the adjustment rather than assuming either value is correct.');
    if (stats.n > 1) {
      facts.push(stats.se > 0 ? `Standard error from the kept readings: ±${uncertainty(key, stats.se)}.${e.sigma < stats.se ? ' Your stated uncertainty is smaller than this repeatability estimate.' : ''}` : 'These kept values are identical; zero observed scatter does not establish zero uncertainty.');
      why.push('A standard error assumes independent repeat measurements of a stable quantity. Different timestamps alone do not establish independence. Shared errors and repeated marks on one image do not average away.');
    } else why.push('One kept reading cannot establish repeatability. Allow for the instrument, alignment and method as well as timing.');
    next.push('Take independent readings, compare their conditions, and justify the final uncertainty. Retain or exclude observations based on evidence.');
  }
  if (def) {
    const contributions = uncertaintyBudget(s.sheet, key as keyof ReturnType<typeof derivedFor>, variant)?.contributions.filter((c) => Number.isFinite(c.effect) && c.effect > 0).sort((a, b) => b.effect - a.effect) ?? [];
    facts.push(`This derived value is calculated from your entered ${[...new Set(def.inputs)].map((p) => QUANTITY_INFO[p].symbol).join(', ')}. Recalculation is not independent confirmation of those inputs.`);
    if (contributions[0]) facts.push(`Largest first-order uncertainty contribution in this model: ${QUANTITY_INFO[contributions[0].input].symbol}, approximately ±${uncertainty(key, contributions[0].effect)}.`);
    why.push('This ranks the uncertainties you entered under the current model. Missing systematic errors, correlations or an unsuitable model can change that ranking.');
    next.push('Inspect the observations supporting the largest contribution before spending time improving an already precise input.');
  }
  const floor = conditionUncertainty(readings);
  if (floor > 0 && !def) facts.push(`Recorded shared correction contribution: ±${uncertainty(key, floor)}.${e.sigma < floor ? ' Your entry does not include this recorded contribution.' : ''}`);
  const exposed = readings.filter((r) => r.environment?.wind?.protection === 'none' && Math.max(r.environment.wind.speed, r.environment.wind.endSpeed ?? 0) > 6);
  if (exposed.length) {
    facts.push(`${exposed.length} kept timing${exposed.length === 1 ? '' : 's'} used an exposed rig in strong wind.`);
    why.push('Steady crosswind can bias the pendulum. Its recorded presence is a reason to investigate, not proof that it caused the whole discrepancy.');
    next.push('Compare a sheltered timing at the same measured length. Check length, release angle and swing counting too.');
  }
  const damp = readings.filter((r) => r.environment?.horizon?.damp && !r.environment.horizon.correction);
  if (damp.length) { facts.push(`${damp.length} kept horizon reading${damp.length === 1 ? '' : 's'} recorded damp air without a numerical correction.`); next.push('Recheck after the damp spell or apply an independently justified refraction estimate with uncertainty.'); }
  if (readings.some((r) => r.environment?.horizon?.correction?.source === 'echo-humidity')) why.push('The local humidity correction does not measure persistent atmospheric layering. Compare an independent method if the horizon model remains doubtful.');
  const frozen = readings.filter((r) => r.environment?.seeing?.frozen);
  if (new Set(frozen.map((r) => r.environment!.at)).size < frozen.length) facts.push('Several kept marks come from the same frozen exposure pair. They are not independent exposures; their scatter cannot establish independent repeatability.');
  if (readings.some((r) => (r.environment?.seeing?.factor ?? 0) > 1.5)) { facts.push('Some kept optical measurements recorded turbulent images.'); next.push('Compare independent observations and allow for blur, edge placement and shared alignment error.'); }
  if (readings.some((r) => !r.environment)) facts.push('Some kept readings have no saved condition record. Their environmental treatment cannot be reconstructed.');
  const observations = key === 'P1' ? s.starObs : key === 'thetaM' || key === 'Pm' ? s.moonTrack : key === 'thetaMg' || key === 'Pmg' ? s.moonTrackG : ['Porb', 'ecc', 'wPeri'].includes(key) ? s.track : key.startsWith('pStar') ? s.starPar.filter((o) => o.i === ['pStarA', 'pStarB', 'pStarC'].indexOf(key)) : [];
  if (observations.length) {
    const times = observations.map((o) => o.at), span = (Math.max(...times) - Math.min(...times)) / DAY;
    facts.push(`${observations.length} saved observations span ${sig(span, 4)} days. Their existence alone does not validate the fitted model or uncertainty.`);
    if (span <= 0) facts.push('These observations do not yet provide a time baseline.');
    if ((key === 'Pm' || key === 'Pmg' || key === 'Porb') && span * DAY < e.value * 2) facts.push('The saved observations span fewer than two of your entered periods. Different period hypotheses may still fit.');
    next.push('Compare residuals and alternative fits with your observations; extend the baseline when the data cannot distinguish the hypotheses.');
  }
  const oppositions = key === 'S2' || key === 'tOpp' ? s.oppPicks : key === 'Sg' || key === 'tOppG' ? s.oppPicksG : [];
  if (oppositions.length) {
    facts.push(`${oppositions.length} opposition date${oppositions.length === 1 ? '' : 's'} marked by you.`);
    if ((key === 'S2' || key === 'Sg') && oppositions.length < 2) facts.push('One marked event does not establish a repeating interval.');
    next.push('Compare the marked dates with your retrograde observations and account for how tightly each event is bracketed.');
  }
  if (!facts.length) return null;
  facts.push('This review does not consult the true system values. Agreement with your records is not proof of accuracy.');
  return { facts, why: concise ? [] : [...new Set(why)], next: concise ? [] : [...new Set(next)] };
}
