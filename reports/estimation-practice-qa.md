# Estimation and prediction practice — MODE-12, 16 November 2026

The agreed pair of optional predictions now appears in Basic Training and as two directly repeatable Flight School exercises. The requested broader estimation practice adds seven workshops, each with six repeatable teaching datasets. The library now contains **47 modules**: 24 interactive lessons, 14 guided exercises, seven estimation workshops and two flight drills.

## Exercises and feedback

| Exercise | What the learner does | What the comparison means |
|---|---|---|
| Predict a measured swing | Keep a timed baseline, measure a noticeably different string length, commit a period and ± range, then time and keep the new reading | Agreement with a new observed period at the committed length; no hidden true gravity or exact period is revealed |
| Predict from your star logs | Log at least two different observing dusks, commit an unwrapped angular position and range about two weeks ahead, then log at the target dusk | Agreement with a new star observation within ten simulated minutes of the target; the plotted green point is that observation |
| Extend a trend | Extrapolate from three scattered positions | A fitted line through the displayed teaching data, with an illustrative range including scatter and rate uncertainty |
| Estimate between readings | Interpolate within an observed baseline | A comparison of interpolation with longer forecasts; three points cannot establish a precise confidence interval |
| Scale a swing time | Apply a measured period and known length ratio | Square-root scaling with the given timing uncertainty; real ruler and release-angle errors are additional |
| Bracket an event | Use the last observation before and first observation after an event | The whole observational interval; its midpoint is convenient, not a secretly known exact date |
| Estimate a rover journey | Convert distance and speed bounds into Earth days | The uninterrupted-driving time interval; stops, charging and terrain delays are explicitly excluded |
| Estimate from repeated timings | Estimate a mean period from five runs of twenty full swings | A standard error from random repeatability; shared errors do not disappear through averaging |
| Estimate a distance and its uncertainty | Convert arcseconds to radians and propagate independent baseline/angle errors | A small-angle parallax estimate with stated assumptions and omitted systematic/correlated effects |

The existing estimation lesson remains available. Its symmetric retrograde-loop demonstration now explicitly identifies symmetry as a teaching assumption; real loops may be asymmetric.

## Optional practice and preservation

Estimation workshops require a committed estimate before the separate worked-comparison reveal. Inputs reject non-finite values and zero/negative ranges; invalid drafts cannot corrupt the star plot. Optional reasoning hints use rendered mathematical notation. Interval graphics and written feedback explain a miss or an excessively broad range without awarding points. Completion records finishing practice, irrespective of accuracy; requested help is labeled. Repeating offers another dataset, and completed/skipped/started progress persists through reloads.

The two instrument exercises use an isolated, unscored teaching expedition. They supply no baseline logs by default. An optional pendulum helper is explicitly labeled ECHO and marks assisted practice. Committed predictions are frozen and survive reloads. Previously kept readings cannot resolve a new prediction; pendulum comparisons require a new kept reading at the committed length, and star comparisons require a new target-time log. Only quantities derived from the learner's observations are used to align angular wrapping. A missed star window offers a new prediction using the existing logs. The pendulum reading retains the length used in its calculation even if the player adjusts the rig before keeping it.

Basic Training exposes these opportunities at its existing pendulum/year steps, with a direct prediction-panel button and free scrolling between controls. Continuing Basic Training does not require a prediction. Focused prediction modules require an observed comparison before being marked completed, with an explicit exit/skip path always available. No new tutorial indices were inserted, preserving existing saved step positions.

Returning restores the original expedition's measurements, clock, difficulty and context while retaining training history. Ordinary prediction scoring, Campaign progression, achievements and Atlas records are unaffected by practice. Game tools remount when a new practice run starts so a previous run's local instrument state cannot carry into the new teaching world.

## Validation

- **76 tests in 20 files pass.** Coverage includes all teaching variants, unit conversions, square-root scaling, repeatability uncertainty, parallax propagation, full bracket coverage, invalid inputs, locked predictions, new-reading/length/time gates, angular wrapping, optional Basic Training and exclusion from ordinary prediction scoring.
- The production build passes. The existing large JavaScript bundle warning remains.
- `scripts/check_estimation.py` passes in Chromium at **390×844 and 1440×900**: all seven workshops, hints and rendered mathematics, commit-before-reveal, interval graphics, repeat examples, progress after reload, real instrument controls for keeping pendulum readings and logging stars, observation-gated feedback, committed star prediction after reload, skippable Basic Training, and restoration of the original expedition/time. No page errors were observed. Screenshots were reviewed.
- `scripts/check_school.py` passes with the expanded 47-module library, including filters/search, open advanced content, viewed/completed/skipped records, independent guided exercises, chapter recommendations and safe return to the original expedition.
- `scripts/check_flight_controls.py` passes: keyboard/touch handling, pause/focus release, sensitivity/reduced motion, preserved practice, required hard-mode launch, ECHO rescue/assisted accounting and successful manual branches.

The pendulum browser smoke test uses deliberately short stopwatch intervals to verify UI data flow, not realistic human timing. These checks establish the named flows and numerical rules; they do not establish learning outcomes, human measurement precision or long-term engagement.
