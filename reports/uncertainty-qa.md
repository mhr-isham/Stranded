# Understandable uncertainty and conditional transfer forecasts

Date: 19 November 2026 (Asia/Dhaka). Decision: SCI-18 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved scope

The priority is an optional visual explanation of the uncertainties the player entered. The accompanying work checks repeated/shared evidence and replaces the planner's probability-like claim with conditional simulation counts. Full covariance-aware sampling remains a future project.

## Visual source breakdown

Every derived quantity in the progress sheet has a closed-by-default **Where does this uncertainty come from?** section. It shows the combined first-order uncertainty and ranks the distinct underlying primary inputs. Each row shows the entered input uncertainty, its estimated contribution in the result's units, and its percentage of estimated variance. Bars and text convey the ranking together. Percentages describe squared uncertainty; the individual ± contributions combine in quadrature, rather than by addition. Zero allowances and zero local sensitivities have separate explanations.

Source buttons return to the corresponding measured quantity. The optional expanded worksheet view provides a wider, taller reader; the player can return to the constellation. The chart updates from the current worksheet. It uses the same numerical budget as the derived readout and evidence review, rather than an independently maintained approximation or hidden-system comparison.

A second, initially closed section lets the player select an input and halve or double its stated error in a hypothetical calculation. Only local UI state changes. The actual worksheet, readings, expedition clock, verification uses, fuel penalty and hint count are unaffected. A tighter entered allowance needs observational justification; the preview does not improve a measurement. The combined actual result stays visible separately from the hypothetical result.

Stargazer/Cadet coaching modes receive an optional next-step suggestion about inspecting the dominant contribution. Independent modes receive the numerical breakdown and requested experiment without that volunteered coaching. This introduces no paid evidence review, correctness verdict, forced exercise, progression gate or extra library module. The existing averaging and propagation lessons now explain independence and point to the worksheet inspector.

## Numerical propagation and concrete correction

The engine continues to use central finite differences and the existing step policy for local first-order propagation. A new shared `uncertaintyBudget` exposes the individual sensitivities already needed for that calculation. Each distinct primary is perturbed once and reused throughout the full result function. A squared radius therefore has its factor-of-two sensitivity; it is not represented by two independent copies of the radius reading.

The slingshot chain previously concatenated `Sg` and `tOppG` onto an orbit-input list that already contained both. This counted some giant-orbit variance terms twice. The declaration and budget now deduplicate primary identifiers. An analytical giant-orbit sensitivity test checks the corrected total, including a case where only `Sg` has uncertainty. The inference value functions are unchanged.

Missing inputs or nonfinite values produce no derived result. Invalid, negative or overflowing uncertainty/sensitivity produces an unavailable uncertainty rather than silently treating that input as exact. An explicitly entered zero remains zero and is labelled as an absent allowance, not demonstrated perfection. Worksheet readouts and constellation radii handle unavailable uncertainty without rendering `± NaN` or an invalid SVG radius.

The implementation is still a local linear approximation with independent *different* primaries. It does not represent correlations between fitted amplitude and period, different inputs sharing calibration, unknown biases, omitted timestamp uncertainties or nonlinear probability distributions. A result calculated from reused observations is not independent corroboration. Those limits appear in the requested inspector.

## Repeated and shared evidence audit

The shared reading statistics now group known source identities within one measured quantity. Repeated micrometer marks with one `sightingId`, parallax marks with one `captureId`, and pendulum timings with one nonempty `releaseId` contribute their latest kept finite log version once. Earlier versions remain in the log and retain include/exclude controls. Counts and excluded revisions are explained at the sender and in evidence reviews. Nonfinite values cannot enter an average. Missing dates remain unspecified instead of producing a fictitious date.

Different releases at the same expedition time remain separate observations. Unidentified legacy readings are retained; matching values or timestamps do not invent a shared source. Equally, a new timestamp is not described as proof of independence. The scatter-derived standard error is explicitly conditional on independent repeats of a stable quantity. This conservative source grouping is not a fitted correlation model and cannot reconstruct provenance absent from an old save.

The recorded shared horizon-correction contribution already used a maximum kept allowance rather than dividing it by the square root of the number of readings. That rule remains. The Flight School quick-send helper previously omitted this recorded contribution; it now combines it with illustrative scatter in quadrature, retaining the existing minimum relative teaching allowance. The ordinary sender still requires at least the recorded model contribution. Manual worksheet entry remains the player's estimate; the evidence review can identify an omitted recorded allowance.

Dated rover distances still send one selected observation with its own date, rather than averaging changing separations. Existing year and moon analyses already require a time baseline/distinct observing dates and do not gain temporal baseline from duplicate dates. These checks do not establish statistical independence between different dates. Moon fit uncertainty floors, tracked projection models and the existing alternative hypotheses remain in place. Doppler sample selection already retains a residual-trend allowance instead of claiming all variation is repeat noise. None of those existing conditional estimates has become a covariance-calibrated total error budget through this change.

## Planner outcomes

The former **Chance of success, given your error bars** percentage becomes **Simulated transfer outcomes** with **X of 36 succeeded**, unsuccessful counts and unassessable counts. All attempted trials stay in the denominator. No assessable trials means unassessable attempts, not evidence of a zero probability.

Success now requires the simulator's `success` outcome and a finite, nonnegative fuel balance. A positive fuel balance on an expired or unsuccessful result is not success. The simulator's explicit unreachable-path sentinel (`lost` with negative-infinite fuel) counts as an unsuccessful transfer; other nonfinite balances are unassessable.

Each Gaussian draw samples a primary once, then reuses it throughout the derived chain. Invalid source error bars and out-of-domain draws—such as negative moon periods, invalid eccentricities or impossible probe speed order—return an unassessable attempt. They are neither silently skipped nor redrawn until plausible. Finite positive model quantities and required orbit directions/epochs are checked before simulation. Invalid path coordinates are excluded from trajectory drawing.

Requested forecast details explain the independent Gaussian input assumption, small sample, missing correlations/biases and possible model mismatch. These trials simulate automatic transfer/capture with the current fuel budget and intentionally no survival deadline. Deadline, manual flight performance and later surface survival therefore remain outside these counts; the normal arrival/deadline information still needs to be checked separately. The preview is based on the player's entered model and is not a hidden-truth verification or calibrated expedition-success probability.

## Validation

- Full suite: **218 tests passed in 38 files**, including 11 new numerical/stateful uncertainty tests. After the final tightening of nonfinite outcome classification, the 11 relevant tests were rerun successfully.
- Analytical checks: `M1 = gR1²/G` sensitivities, squared-radius variance share, a small-angle radius example with 5% distance and 1% angular uncertainty, and a slingshot giant-orbit derivative. Shared budgets match worksheet propagation across all six chain variants.
- Reading checks: same-source revisions, different releases at the same time, revised wires, repeated parallax pairs, unidentified legacy observations, invalid values/missing dates, and shared correction allowances with one versus 25 readings.
- Forecast checks: successful capture, zero fuel margin, expired/flyby outcomes with positive fuel, unreachable-path sentinel, invalid/nonfinite results, empty/unassessable sets, physical model domains, and one draw per primary.
- `scripts/check_uncertainty.py`: passed at **390×844**, **1440×1000** and **844×390**. Checks collapsed defaults, ranked bars, hypothetical isolation, live updates, source navigation, expanded-view return, expert-mode coaching restrictions, malformed allowances, all 36 forecast attempts and explicit invalid draws. No page exceptions or horizontal overflow. Screenshots inspected locally.
- Existing browser regressions passed: `check_verification.py`, `check_micrometer.py` and `check_model_notes.py`. These cover paid/shared verification limits and checkpoint persistence; instrument revisions, controls, saved conditions and training restoration; and the existing orbital lessons and player-model assumptions on phone/desktop/landscape.
- Production build and whitespace checks passed. The build retains the existing large-bundle advisory.

The browser fixtures seed clearly identified complete or deliberately malformed worksheet inputs. They verify UI behavior and accounting, not the accuracy of a player's manual observations or enjoyment in an actual expedition. Deployment is verified through GitHub Actions separately; these local checks are not a claim to have exercised the public Pages URL in a browser.

## Deferred

A covariance-aware observation/model representation and joint sampler remain deferred. That work should explicitly model which fitted parameters and calibration errors are shared before presenting calibrated probabilities. More realistic distribution families, convergence diagnostics, and empirical forecast calibration would also require separate work. The current UI labels its assumptions and uncertainty limits instead of claiming that this stage completes them.
