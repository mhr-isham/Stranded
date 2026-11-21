import { useEffect } from 'react';
import { SHARP_EYE_POINTS, SHARP_EYE_REASONS, sharpEyeAwardList, sharpEyeScoredContext } from '../../game/sharpEye';
import { useGame } from '../../game/store';
import { toast } from './widgets';

/** One non-blocking acknowledgement per condition, persisted through reloads. */
export function SharpEyeFeedback() {
  const s = useGame();
  useEffect(() => {
    const current = useGame.getState();
    if (current.phase !== 'play' || current.schoolOpen || !sharpEyeScoredContext(current)) return;
    const seen = current.sharpEyeNotified ?? [], fresh = sharpEyeAwardList(current).filter((a) => !seen.includes(a.condition));
    if (!fresh.length) return;
    current.set({ sharpEyeNotified: [...new Set([...seen, ...fresh.map((a) => a.condition)])] });
    const reason = fresh.length > 1 ? 'wind and refraction comparisons recorded' : fresh[0].condition === 'wind' ? 'exposed/screened wind comparison recorded' : 'refraction comparison recorded';
    toast(`Sharp Eye +${fresh.length * SHARP_EYE_POINTS} base · ${reason}`);
  }, [s.sharpEyeAwards, s.sharpEyeNotified, s.phase, s.runId, s.schoolOpen, s.settings, s.schoolSession, s.piloting, s.tutorial.active]);
  return null;
}

/** Earned investigations only; no unearned checklist or requirement to continue. */
export function SharpEyeSummary({ scored }: { scored: boolean }) {
  const s = useGame(), awards = sharpEyeAwardList(s), credited = scored && sharpEyeScoredContext(s);
  if (!awards.length) return null;
  return <section className="panel panel-pad stack" aria-label="Sharp Eye investigations">
    <h2 style={{ fontSize: 18 }}>Sharp Eye · {credited ? `+${awards.length * SHARP_EYE_POINTS} base` : 'unscored recognition'}</h2>
    {awards.map((a) => <div key={a.condition} className="stack" style={{ gap: 4 }}>
      <b style={{ fontSize: 13 }}>{a.condition === 'wind' ? 'Wind investigation' : 'Refraction investigation'}{credited ? ` · +${SHARP_EYE_POINTS} base` : ''}</b>
      <span className="muted" style={{ fontSize: 12 }}>{SHARP_EYE_REASONS[a.method]}</span>
      <details className="measurement-help"><summary>Recorded evidence</summary><p>{a.readings.map((r) => `${r.key} · day ${(r.at / 86400).toFixed(3)} · reading ${r.id}`).join('; ')}{a.shadows.length ? `; synchronized shadow pair ${a.shadows[0].capture}` : ''}.</p><p>This archived comparison survives checkpoint loads and later log edits. It recognizes the investigation, not agreement with hidden truth or proof that all shared errors are absent.</p></details>
    </div>)}
    <div className="faint">Once per condition type per expedition. Keeping or excluding a reading does not change this credit. The existing challenge multiplier applies to the final grade.</div>
  </section>;
}
