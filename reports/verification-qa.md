# Evidence review and ship-sensor verification — MODE-16, 16 November 2026

The agreed contract keeps both paid actions. Each costs **40 m/s of flight reserve** and they **share the existing allowance**: unlimited in Stargazer, five per run in Cadet, two in Navigator, none in Astronomer or Legend. Basic arithmetic, propagation and existing consistency checks remain free. The second action does not create a second budget.

## Two explicit information sources

“Review my evidence” uses kept readings, entered model values and saved observation/condition records. Its input type excludes generated system truth, the seed, and the probe's internal true trajectory. It compares an entry with the kept mean and repeatability where available, reports shared refraction uncertainty, exposed-wind timings, turbulent optical records and repeated marks on a frozen image. For derived quantities it identifies the largest first-order uncertainty contribution from the entered inputs. Observation-based quantities can receive a review of the saved baseline, event count and available supporting records. These reviews do not certify a fit or silently replace a player's values. A quantity without saved support does not incur a charge for an empty review.

Reports explain that agreement with recorded data does not establish accuracy. An exposed windy reading is a reason to investigate, not proof of its entire discrepancy or grounds for automatic deletion. Standard errors assume independent observations and do not include all shared errors. A sensitivity ranking reflects the current model and stated uncertainties, not guaranteed information gain.

“Verify against ship sensors” retains the existing hidden-truth comparison as the explicit paid exception. It reports that the true value lies inside, just outside or well outside the checked error bar. It does not supply the exact true number or claim to diagnose why the estimate missed. It retains the previous comparison thresholds and 40 m/s charge. The interface describes a charge against flight reserve; this change does not invent a simulated calibration burn.

Stargazer's requested evidence review expands its explanations and investigation suggestions. Cadet can open separate “Why this matters” and “How to investigate” sections. Navigator receives concise observed facts without the deeper method sections. Astronomer and Legend have neither paid action; their existing arithmetic, records, references and mode-specific warning rules remain available.

## Costs, records and checkpoint integrity

Both buttons call a shared action that checks the current mode, live allowance, valid entered estimate, expedition phase and remaining fuel. A stale UI callback cannot reuse an old counter. Exhausted allowances, insufficient fuel, invalid entries and unavailable evidence/sensor results do not incur a fee or spend a use.

Each successful check saves its source, quantity, entered value/error bar, observation timestamp when applicable, time of checking and report. Evidence reports also retain a change marker for the observed data. The result is marked as an earlier snapshot when the entry or supporting records change. Results survive reload and remain accessible under the checked quantity, including earlier paid reports. Older saves retain their existing spent-use count; missing historical reports are acknowledged rather than fabricated.

Checkpoint loading previously restored the saved `checksUsed` and `penaltyDv`, allowing a player to recover paid verification uses and their fuel. Restore now retains the greatest known verification-use count and adds the post-save verification charges to the snapshot's fuel expenditure. Repeated loads do not double-charge. Other post-save expedition fuel expenditure retains the existing checkpoint restoration behavior. The same rule applies to failed-flight rewind, and paid result history remains available. This fix is specific to verification costs and counters; it does not establish that all other checkpoint/mode restrictions have been audited or repaired.

## Validation

- **94 tests across 22 files pass.** New tests cover evidence-only conclusions, model sensitivity, concise Navigator reports, missing support without a charge, retained true-value comparison, shared allowances, direct-action mode enforcement, insufficient fuel, invalid entries, evidence-snapshot change detection, repeated checkpoint loads, ordinary versus verification fuel restoration and failed-flight rewind.
- The production build passes with the existing large-bundle warning.
- `scripts/check_verification.py` passes in Chromium at **390×844 and 1440×900**. It uses the real buttons, entry editor and checkpoint Save/Load controls. It verifies distinct report sources, 40 m/s charges, shared counts, saved reports after reload, stale-result labeling, persistent limits/fuel through repeated loads, Cadet/Navigator/Stargazer explanation differences, hard-mode absence, insufficient-fuel disabling and missing-evidence rejection without a charge. Screenshots were reviewed; no page errors were observed.
- `scripts/check_flight_controls.py` passes at phone, desktop and landscape sizes after the checkpoint change, including preserved practice, manual controls, required phases and rescue/assisted accounting.
- `scripts/check_cadet.py` passes at phone and desktop widths, preserving requested guidance, warning-triggered offers, free exploration and absence of automatic paid checks.

Browser checks use explicitly supplied measurements to test analysis and accounting; they are not human measurement trials or complete expedition playthroughs. These are local game rules, not a claim of cheat-proof offline storage or a secure competitive backend. Other MODE-16 contracts remain subject to their own discussion and validation.
