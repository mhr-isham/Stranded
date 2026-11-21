# Clear and satisfying measurement feedback

Date: 21 November 2026 (Asia/Dhaka). Decision: SCI-24 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved direction

Make measurement enjoyable through observable instrument response, understandable evidence and useful decisions. Keep a small default interface, offer expert analysis on request, and preserve normal automatic arithmetic. The user specifically asked that this feel clear and gamified. The implementation builds on existing instrument physics, sound cues, bracing, image-quality feedback, technique milestones, alternate fits and optional field investigations.

This change adds feedback and analysis presentation rather than another progression currency. No new required lesson, collection quota, accuracy badge, score, fuel cost, timer obligation or verification/hint budget is introduced. Scoring and physical rulesets remain unchanged.

## Recording moments

Gravity, horizon radius, angular-diameter and parallax reading logs share a compact receipt. It shows the latest recorded value and units, observing date, inclusion state and number of entries in the log. Native save actions trigger a single brief border/light highlight and a polite accessible acknowledgment. The card stays readable as an ordinary archive summary after the highlight ends. Existing instrument-specific sounds remain in their native handlers.

Saving another exposure and revising one existing source have different labels. Re-marking a micrometer image or parallax pair says “Observation revised”; it does not pretend to add another exposure or an independent sample. The original log and its conditions remain directly available. A receipt acknowledges recording even when the numerical result is poor: it never compares against generated truth or certifies technique or accuracy.

Only actual recording handlers emit the transient acknowledgment. Hydrating a save, opening the log, loading a checkpoint, excluding/reincluding an entry, editing its note or deleting it does not replay the moment. Notifications and timers are not written into saved state. New expeditions clear local activity. The small-screen visual check caught an absolutely positioned screen-reader announcement extending the hidden game scroller; anchoring that clipped announcement to the viewport prevents it from shifting the HUD when a log is brought into view.

## Evidence that feels like progress

Year analysis distinguishes a first drift estimate from a line that additional dates can test. Moon analysis distinguishes recorded sightings, a candidate orbit and multiple plausible rhythms. These are descriptive states from existing analyses, rather than percentage-complete bars or promises that an instrument is correct. The existing fit-status messages, data selection, observation provenance, controls and optional activities remain available.

The default readout shows the inferred quantities. Where the existing mode permits error guides, a supported year error is shown beside the estimate and identified as scatter-only. Missing or unsuitable fitted error remains unexplained by a fabricated zero: the display says those dates do not establish a usable year error range. Detailed slope error and its limitations move into requested inspection. Moon period and angular swing show the existing error estimates with their heuristic-model limitation, rather than treating them as calibrated confidence.

Year and moon chart axes now explicitly use elapsed days, with day zero at expedition start. This clarifies the relationship to the HUD's numbered expedition days without changing dates, selections, clock behavior or calculations.

## Optional residual inspection

Both analyses offer signed observed-minus-fitted plots with a zero reference line and a plain-language explanation. The plotted points come from the selected observations only. They do not compare observations against hidden true values. Changing a date interval recomputes the displayed residuals; choosing moon model B updates them for that candidate using the same records.

An additional disclosure shows dates, observed values, fitted values and differences, with degrees for year positions and arcseconds for moon offsets. The numerical table shows at most the latest 80 selected records, labeled when bounded; the plot uses the complete selected set. The original observation log remains intact. Narrow tables scroll within their own container. Adaptive significant figures prevent small residual axes from displaying several indistinguishable rounded tick labels.

Plots mount only when their inspection is opened and stop when it closes. This avoids adding hidden animated canvases to the normal instrument view. Requested plots are normal arithmetic, without an accuracy grade, preferred conclusion or model diagnosis. Close residuals can coexist with shared calibration errors, inadequate models or aliased periods. Two candidate models can even predict identical values at the recorded sample times; switching candidates must not manufacture visible separation in that case.

## Modes, accessibility and compatibility

Manual fitting continues to hide automatic curves, rate/year/period values and automatic residuals. There is no new solver output or back door through the expert inspection. Legend retains its existing restrictions on automatic scatter/error guides; it can request residual arithmetic for an allowed automatic fit. No paid hint or truth-verification mechanism is replaced by this presentation.

Existing tutorial and Flight School modules reuse the clearer analysis component. The optional baseline exercise still permits completion without inspecting residuals or doing extra hand algebra. Practice restoration, historical observation provenance and prior rewards are unchanged. No absent historical condition or uncertainty is invented.

Feedback is nonmodal, uses text as well as color, and respects reduced-motion preferences. Recording announcements are brief and polite; continuously sampled conditions are not newly announced. Analysis disclosures retain native keyboard operation and readable units. The main log's include/exclude/delete controls remain available.

## Verification

- `npm test`: 251 tests in 41 files passed. Seven focused tests cover native recording/revision identity, non-events such as exclusion and deletion, invalid records, signed residual arithmetic and data immutability, selection, nonfinite/overflow cases and centered year fits at large epochs.
- `npm run build`: TypeScript and production build passed. The existing main-bundle size advisory remains.
- `python scripts/check_measurement_feedback.py`: native horizon aiming/read/keep, value/date/selection receipts, single acknowledgment, no replay from toggles/checkpoints/reload, fresh second recording, closed-by-default analysis, requested plots/tables, changed date selection, moon candidate switching, unchanged worksheet/resources/clock, Legend restrictions and manual-fit guards. Runs at 390 × 844 high DPI with reduced motion, 1440 × 1000 and 844 × 390; checks no runtime errors, document horizontal overflow or hidden game-scroller movement.
- `python scripts/check_year.py`: finite-fit/baseline guards, native locked-world logging, range selection, manual/formula restrictions, interactive ordinary/locked baseline lessons and actual three-date Flight School investigation/restoration passed. Assertions now explicitly open the requested fit-statistics disclosure.
- `python scripts/check_moon.py`: native Flight School fits, selected-date controls, optional comparisons, candidate B/forecast handling, missing-track/manual guards, sheet submission, practice restoration and three layouts passed.
- `python scripts/check_micrometer.py`: native mouse/touch/keyboard controls, same-epoch revision and fresh-exposure recording, conditions, visibility guards, optional lesson/investigation, uncertainty contributions and practice restoration passed. Added checks distinguish saved versus revised receipts without increasing the log count.
- `python scripts/check_parallax.py`: native visible-frame marking, keyboard/high-DPI controls, blink speed, frozen-pair persistence, projected-baseline distance, same-pair revisions, optional main help, Flight School geometry/prediction, rewards and safe expedition restoration passed at phone, desktop and landscape widths.
- `git diff --check`: whitespace validation.

An initial full-suite run alongside four browser suites exceeded the existing five-second timeout in the world-generation-heavy optical sampling test. A subsequent full run passed with the default timeout; no test timeout or assertion was weakened. Early browser assertions expecting always-visible detailed statistics were updated to request the new disclosure. A regularly sampled moon fixture also demonstrated exact aliasing; the candidate-change test uses slightly irregular observing times so a numerical difference is supported by its data.

The horizon test establishes native acquisition and feedback behavior, not human aiming accuracy. Year/moon presentation fixtures use stored observations to isolate selection and models. No complete expedition flight is claimed. Screenshots are retained locally in `/tmp/stranded-measurement-feedback`; local checks and GitHub Pages deployment are separate validations.

## Limits

These changes improve feedback consistency and make existing scientific decisions easier to inspect. They do not establish enjoyment for every audience, prove understanding, calibrate model uncertainties, eliminate aliasing or estimate shared covariance. Player feedback remains necessary to judge pacing, comprehension and satisfaction. Additional methods, physical effects and the prediction/planning changes starting at TIME-01 remain separate discussions.
