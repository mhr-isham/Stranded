# Measurement sources, repeat viewing and introductory practice

Date: 21 November 2026 (Asia/Dhaka). Decision: SCI-21 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Result

The README and existing Measuring lesson no longer claim that all measurement errors come from the player's technique. They distinguish technique, finite instrument resolution, variable observing conditions, simplified simulated receiver/tracker scatter and shared systematic effects. The lesson remains optional, and the Flight School library remains at 49 modules. No new environmental effect or covariance sampler is introduced.

## Source audit

| Path | Actual source and recorded behavior | Result of this change |
|---|---|---|
| Pendulum | Manual release/count/start/stop, measured length, large-angle dynamics and wind treatment; the optional worn-stopwatch challenge also introduces a labelled random button delay. Kept readings retain the result and available setup/condition metadata. | Describe technique as an important contributor without claiming that every error is human. Existing windscreen, timing and uncertainty behavior remains in place. |
| Manually aimed telescope/year and micrometer readings | Pointing/wire placement and instrument steps affect the reading. Live image movement is distinct from a kept observation. Existing micrometer sighting IDs identify revisions of one sighting. | Existing provenance and revision rules remain; explanations distinguish a new observation from another view of one recorded value. |
| Frozen rover exposure pairs | Live capture fixes the pair and its conditions. Re-marking it revises that evidence, rather than producing independent exposures. | Existing frozen-pair tests pass, including navigation, persistent pairs and one reading per pair. |
| Nearby-star position scans | A new Log action generates seeing-scaled simulated scatter and rounds the reported offset to 0.001 arcsecond. The offset is stored in `starPar`; fits/charts reuse that value. | New entries retain `source: tracker` plus the seeing factor, observation time and raw reported value. A requested position log shows the value and provenance. Older values remain unmodified and missing source/conditions are identified honestly. |
| Locked-world year reference | The Log action generates a reference angle with small simulated reading scatter. It does not test manual centring. Existing date spacing prevents repeated logging at one epoch from adding time coverage. | New entries are labelled tracker samples, correcting the former manual-source label. Duplicate-date rejection now precedes random sampling. Saved historical source labels are preserved. |
| Probe Doppler/radar | The recorded launch/pass parameters and sample index deterministically reconstruct the Doppler curve and simulated receiver scatter. The radar sample uses the same stable pass identity. Navigation variation changes the pass, rather than rerolling received samples. | Optional instrument notes explain those distinctions and model limits. Reopening, reloading, advancing the clock or changing worksheet estimates leaves the pass's received data unchanged. |
| ECHO-supplied tutorial examples | Helpers generate illustrative readings/entries; these are supplied assistance, not observations of the player's timing or aiming. Existing ECHO notes/source labels identify assistance. | Documentation and teaching explicitly include supplied examples among the simplified simulated measurements. |

Random initial pointing offsets, live seeing animation and cosmetic rover dust are not themselves newly kept observations. Their changing display must not be confused with a saved reading being redrawn. This audit does not assert that distinct logged samples have independent errors, nor that a seed alone reproduces every future manual action: some new scans use `Math.random`, and saved observations preserve the resulting values.

## Existing lesson improvements

The one-metre practice rod explicitly identifies its illustrative Gaussian scatter (standard deviation 4 mm), optional shared +6 mm calibration shift and optional rounding to 2 mm scale steps. The controls remain Take a reading, Take 10, Reset and optional truth display. Changing either ruler condition starts a fresh practice set so treatments are not silently mixed. Revealing the hypothetical truth only changes the display.

The observed sample spread is labelled `s`; the numerical bar and formula identify `s/√N` as a scatter-only standard error under independent repeats. They do not present it as a total uncertainty or guaranteed interval. The lesson explains why a shared offset persists as the scatter-only estimate narrows, why extra digits do not establish accuracy, and why zero observed scatter does not establish a perfect measurement.

An initially closed instrument connection explains timing/aiming, resolution, changing conditions/receiver scatter and shared calibration/refraction. It refers players to their actual instrument observations and conditions without requiring additional teaching during expeditions. The demonstration's truth reveal applies only to the hypothetical rod and does not reveal a generated world's hidden values.

Samples are generated once on the observation action, outside React's replayable state-updater callback. React can safely re-evaluate the append operation without consuming more random draws. Rendering, revealing truth and opening explanations do not resample existing practice dots. Individual dot tooltips report their practice readings; the horizontal plot range expands to retain outlying points. Simple end caps keep a narrow error bar legible instead of overlapping arrowheads.

## Instrument context and compatibility

Requested source notes start closed in the probe, nearby-star and locked-year panels. They are factual descriptions of instrument models and evidence, available in every mode without consuming hints, paid checks, fuel or allowances. They do not rank a reading against hidden truth or add beginner next-step coaching to independent modes.

The nearby-star schema additions are optional and compatible with existing saves. Neither historical star offsets nor previously stored manual/ECHO source labels are rewritten. A new nearby-star log distinguishes absent source and absent image conditions from newly recorded scan provenance. The locked-year log also displays tracker and unknown sources explicitly.

The README's related claims now match existing SCI-18/SCI-19 behavior: independent-input first-order propagation, conditional counts out of 36 attempted models rather than a calibrated success probability, and a follow-up date that may distinguish moon candidates rather than a night guaranteed to resolve them. Its lesson count reflects the existing 25 lessons.

## Verification

- **218 tests passed in 38 files.** No tests were added to mirror static wording. Stateful/numerical behavior is additionally exercised through the browser.
- `scripts/check_measurement_sources.py` passed at **390×844**, **1440×1000** and **844×390**, including high DPI and reduced motion. It checks practice sample counts, the displayed mean and standard error against the plotted samples, retained bias after 100 independent practice draws, 2 mm quantization, truth-display isolation, plotted point bounds, collapsed optional explanations, valid equation rendering and unchanged expedition data/resources/clock after lesson completion.
- Probe checks compare both saved pass state and deterministic canvas output through source-note opening, navigation, worksheet changes, clock advancement, a real checkpoint save/load and reload; the displayed raw radar reading is also retained. The probe fixture uses the existing launch helper to reach the relevant pass state, rather than claiming to test manual flight accuracy.
- Nearby-star checks use the native Log control. They verify reported resolution, new scan metadata, preservation of earlier samples when another scan is logged, exact saved values and visible log values through navigation/checkpoints/reload, and honest legacy labels without changing the numeric observations. Repeated canvas rasterization is not used as a substitute for comparing saved measurements; plot layout/rendering can vary while its data remains identical.
- Locked-world checks use the native reference-angle Log control, verify tracker provenance and duplicate-date rejection, and preserve the recorded angle through navigation and reload.
- Existing `scripts/check_year.py` passed at phone/desktop sizes: fit guards, ranges, formula/manual-fit restrictions, real locked-world logs and the native three-date Flight School investigation with expedition restoration.
- Existing `scripts/check_parallax.py` passed at phone/desktop/landscape sizes: real marking, frozen/persistent pairs, one reading per pair, geometry/prediction practice and restored expedition state.
- Production build and whitespace checks passed. The build retains the existing large-bundle advisory. Screenshots of the practice controls/plot and position log were inspected locally; no page exceptions or horizontal overflow were reported by the new browser checks.

These checks establish the behavior and arithmetic described above. The receiver/tracker and practice scatter are simplified game models, not empirically calibrated physical instruments. The tests do not establish learning outcomes or long-term enjoyment. Full covariance, new environmental investigations and the cross-instrument availability policy remain separate review items.
