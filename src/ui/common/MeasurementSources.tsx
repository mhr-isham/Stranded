/** Requested factual instrument context, available without hints or truth checks. */
export function MeasurementSources({ instrument }: { instrument: 'probe' | 'stars' | 'locked-year' }) {
  return <details className="measurement-help" aria-label="Measurement sources">
    <summary>Where can these readings differ?</summary>
    {instrument === 'probe' ? <>
      <p>The probe's speeds follow a simulated flyby. Its receiver adds simplified simulated Doppler scatter, and its radar altitude has a simulated uncertainty. These are instrument models, not measurements of your aiming or reaction time.</p>
      <p>Your chosen pass and the probe's navigation scatter affect the actual trajectory. Selecting another part of its speed curve changes your estimate, not the received samples. Reopening the chart, changing your worksheet or reloading this expedition keeps this pass's samples and radar reading.</p>
      <p>Repeatedly viewing one pass is not new evidence. Scatter within a selected stretch does not cover every shared calibration error or the curve's remaining trend. The displayed ± allowances are not guaranteed bounds.</p>
    </> : instrument === 'stars' ? <>
      <p>Each position scan includes simplified simulated reading scatter that increases with rough seeing. Its reported step is 0.001″; that display resolution is not its accuracy. This scan does not assess manual centring technique.</p>
      <p>Logging makes a new observation and saves its value. Switching stars, reopening the chart or reloading keeps recorded values. A new scan may differ; a new timestamp alone does not establish independence, and a shared alignment error would not average away.</p>
    </> : <>
      <p>Here the tracker supplies a reference-star angle with small simulated reading scatter. This records the sky's turn without assessing manual telescope centring. New entries are identified as tracker samples; older source labels are retained.</p>
      <p>Opening or fitting the chart reuses recorded angles. Only logging another observation supplies another sample. Different dates provide time coverage, but do not by themselves establish independent errors or remove shared calibration bias.</p>
    </>}
  </details>;
}
