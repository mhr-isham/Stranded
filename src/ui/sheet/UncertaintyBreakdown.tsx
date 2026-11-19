import { useState } from 'react';
import { labelFor, QUANTITY_INFO, uncertaintyBudget, type ChainVariant, type DerivedKey, type Primaries, type PrimaryKey } from '../../engine/chain';
import { sig, toDisplay } from '../../game/format';
import { useMode } from '../../game/modes';
import './uncertainty.css';

/** An inspection of entered evidence, never a comparison with the generated world. */
export function UncertaintyBreakdown({ sheet, quantity, variant, onSelectInput }: {
  sheet: Primaries; quantity: DerivedKey; variant: ChainVariant; onSelectInput: (key: PrimaryKey) => void;
}) {
  const mode = useMode();
  const [chosen, setChosen] = useState<PrimaryKey | ''>('');
  const [factor, setFactor] = useState(1);
  const budget = uncertaintyBudget(sheet, quantity, variant);
  const rows = budget?.contributions.slice().sort((a, b) => b.variance - a.variance) ?? [];
  const valid = budget && Number.isFinite(budget.sigma);
  const source = chosen || rows[0]?.input;
  const scenario = valid && source && sheet[source] ? uncertaintyBudget({ ...sheet, [source]: { ...sheet[source]!, sigma: sheet[source]!.sigma * factor } }, quantity, variant) : null;
  const amount = (sigma: number) => `${sig(toDisplay(quantity, sigma), 3)} ${QUANTITY_INFO[quantity].unit}`;
  return <details className="uncertainty-budget" aria-label="Uncertainty breakdown">
    <summary>Where does this uncertainty come from?</summary>
    <div className="stack" style={{ marginTop: 12 }}>
      {!budget ? <p className="muted">A breakdown needs all supporting inputs and a finite result. Enter those observations first.</p> : !valid ? <p className="amber">Uncertainty unavailable. Check the entered error bars and model sensitivity{budget.invalid.length ? ` for ${budget.invalid.map((k) => QUANTITY_INFO[k].symbol).join(', ')}` : ''}. A failed calculation is not zero uncertainty.</p> : <>
        <div className="uncertainty-total"><span>Combined first-order uncertainty</span><b>±{amount(budget.sigma)}</b></div>
        <p className="faint">Each bar is a share of estimated variance (squared uncertainty). The percentages add to 100% when the total is positive; the ± contributions combine in quadrature, rather than by addition.</p>
        <ol className="uncertainty-sources" aria-label="Sources of uncertainty">
          {rows.map((c, i) => <li key={c.input}>
            <div className="uncertainty-source-title"><button className="uncertainty-source-link" onClick={() => onSelectInput(c.input)}>{QUANTITY_INFO[c.input].symbol} · {labelFor(c.input, variant)}</button><span>{(c.share * 100).toFixed(1)}%</span></div>
            <div className="uncertainty-track" aria-hidden="true"><div style={{ width: `${c.share * 100}%` }} /></div>
            <div className="faint">Entered ±{sig(toDisplay(c.input, c.enteredSigma), 3)} {QUANTITY_INFO[c.input].unit} → contributes ±{amount(c.effect)}{i === 0 && c.effect > 0 ? ' · largest contribution' : ''}</div>
            {c.enteredSigma === 0 && <div className="amber">No uncertainty allowance entered. This does not establish a perfect measurement.</div>}
            {c.enteredSigma > 0 && c.effect === 0 && <div className="faint">No first-order effect at these values; nonlinear effects may remain.</div>}
          </li>)}
        </ol>
        {mode.coaching && budget.sigma > 0 && <div className="callout tip" style={{ margin: 0 }}>If you want a tighter result, inspect the largest contribution’s observations first. Repeating a measurement helps only with independent scatter; shared alignment or calibration errors need another approach.</div>}
        <details className="uncertainty-scenario">
          <summary>Try a hypothetical error bar</summary>
          <div className="stack" style={{ marginTop: 10 }}>
            <label className="field">Input to explore<select className="input" aria-label="Hypothetical input" value={source} onChange={(e) => { setChosen(e.target.value as PrimaryKey); setFactor(1); }}>{rows.map((c) => <option key={c.input} value={c.input}>{QUANTITY_INFO[c.input].symbol} · {labelFor(c.input, variant)}</option>)}</select></label>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {[.5, 1, 2].map((f) => <button key={f} className={`btn small ${factor === f ? 'primary' : 'ghost'}`} aria-pressed={factor === f} onClick={() => setFactor(f)}>{f === .5 ? 'Halve error' : f === 1 ? 'As entered' : 'Double error'}</button>)}
            </div>
            <div className="uncertainty-preview" aria-live="polite">Combined ±{amount(budget.sigma)} → {scenario && Number.isFinite(scenario.sigma) ? `±${amount(scenario.sigma)}` : 'unavailable'}<br /><span className="faint">Hypothetical only. Your worksheet, observations and expedition are unchanged. A smaller entered error bar needs evidence; this experiment does not improve a measurement.</span></div>
          </div>
        </details>
      </>}
      <p className="faint">This uses the local, linear approximation and treats distinct primary inputs as independent. Each underlying input is counted once even when several paths reuse it. Correlations between different inputs, omitted systematic errors and nonlinear effects are not represented. Derived results that reuse observations are not independent confirmations.</p>
    </div>
  </details>;
}
