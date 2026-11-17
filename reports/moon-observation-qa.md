# Moon observations: approachable interval analysis

Date: 17 November 2026. Decision: SCI-10 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved behavior and player choice

Improve moon-date selection, explain changing distance/viewing direction and reliability, and improve the existing Flight School moon exercise with optional comparisons using recorded observations. The user's refinement is that different kinds of players should be accommodated without feeling overwhelmed.

The default panel shows the tracker, recorded chart, date controls, selected count/span, a short status and candidate period/angular half-swing. Sending values, enlarged selected-data views, diagnostic explanations, alternate models, forecasts and prediction practice use closed sections. The ordinary game does not require reading a lesson, comparing models or saving comparison fits. Flight School comparison work is also optional and is not part of its completion predicate.

The Moon tab starts with a chart-focused layout instead of confining analysis to the narrow observatory side panel or the lower half of a phone. A button restores the sky alongside the chart; the other observatory tabs retain their layouts. Date fields support keyboard input and decimal expedition days. Explicit Apply avoids fitting every half-written date. Last 10 days, Last 20 days and All observations supplement pointer brushing. Invalid or reversed dates leave the applied selection intact and display an explanation.

All valid recorded moon points remain on the overview; excluded dates are faded. Fit lines stop at the actual first/last selected observations. The optional enlarged chart displays the selected sightings and curves at a readable scale while the full log remains above it. Selected sample count and actual time span differ from merely counting every point in the log.

## Analysis integrity

The analysis sorts finite records and merges duplicate timestamps. It requires at least twelve distinct observations for the existing changing-envelope model, a resolved swing at the tracker's half-arcsecond step, and no more than fifty days in the local fit. Fifty days is an approximation guard, not a physical upper limit on observation length. Rejected intervals do not delete observations.

Orbital-period fitting requires the planet's recorded track to support a viewing-direction correction. Missing tracking no longer silently falls back to a plain apparent-swing period labelled as an orbital period. Internal interpolation gaps are limited by recording cadence and capped at four days. Edge extrapolation is allowed only up to the smaller of two days or 1.25 median recording intervals, and is disclosed in requested details. These guards are conservative model policies, not guarantees of accurate geometry.

The fit uses recorded moon offsets and planet longitudes, retaining the existing local quadratic angular-envelope model and searches over 0.4–60 days. It does not read the system's true moon period to choose or grade its candidates. Fitting is memoized for unchanged logs, range and manual-fit rules, rather than repeated on every clock display update.

The existing alternative-period scan supplies a candidate seed. That seed is now refitted through the same changing-height model as A, instead of presenting a plain-wave alternative beside a different primary model. A sufficiently distinct, comparably fitting alternative is retained, with its own amplitude, period, residual scatter and uncertainties. Selecting B sends B's uncertainty estimates, rather than A's. A lower residual is described as fit quality rather than a truth verdict.

Manual-fit challenges bypass the solver entirely. They keep raw charts and date controls, with no fitted values, alternate curves or automatic fitted-peak helper. The player can still enter their own measurements and calculations through the ordinary progress sheet.

The optional five-day model comparison has its own explicitly labelled projection chart, starting at the end of the selected interval. Forecasts are never added to the measured dots. A model-derived date of greatest disagreement can suggest an observation, with visibility, measurement precision and extrapolation limitations; it does not promise that one night resolves the ambiguity. The separate existing peak-prediction activity is also collapsed and does not supply an automatic fitted answer in manual-fit mode.

## Uncertainty and dated measurements

Angular half-swing is dated at the selected interval's centre. Its corresponding planet distance must refer to that date; different intervals can yield different angular swings even for one physical moon orbit. The period is treated as the orbit's constant period. The existing send controls still require a player-entered positive uncertainty and honor mode-specific visibility of numerical error guides and the formula preference.

The moon senders now label their numerical estimate as a fit error containing heuristic model allowances. They do not describe those allowances as a pure standard error from repeated readings or calibrated confidence. Shared tracking errors, envelope mismatch, aliasing and other systematic effects can require additional uncertainty. Overlapping intervals reuse evidence; their agreement is a stability check, not independent corroboration.

## Optional Flight School work and recognition

The existing Moon lesson retains its simple animated mass/radius experiment. Its text now distinguishes changing apparent size, dated distance, local fitting and period ambiguity, without telling students that arbitrarily longer intervals are always better.

In the existing focused moon exercise, an optional investigation presents one step at a time: keep a candidate; change dates or candidate and keep another; then compare. Up to four snapshots preserve the selected dates, count, centre date, period, angular swing, each candidate's errors, residual scatter and at most 180 actual selected points. Duplicate snapshots are identified; clearing comparisons does not clear observations. No model functions are serialized and no forecast points are archived as measurements.

The moon course's existing discovery card archives the last kept interval's actual selected plot and the candidate summaries. If no optional comparison is saved, its plot is explicitly labelled as the full tracker log rather than falsely claiming selected-fit provenance. Existing worksheet entries can also appear. Keeping snapshots itself gives no patch, score, fuel or verification advantage; the existing completion mechanism awards normal cosmetic recognition. The library stays at 48 modules.

The school guide uses the compact, nondimming observation treatment and offers an explicit shortcut to the optional investigation. Finishing requires the original worksheet goals, not comparison work. Returning from isolated practice restores the original expedition's clock, worksheet and comparison records while retaining normal profile recognition. New runs reset run-local comparisons; older checkpoints and practice snapshots default missing comparison records to an empty list.

## Verification

- `npm test -- --testTimeout=120000`: 183 tests in 34 files passed.
- `npm run build`: TypeScript and production build passed. The existing main-bundle size advisory remains.
- Seven new analysis tests cover period recovery under a changing angular envelope and recorded viewing direction; excluded data retention; solver bypass in manual-fit challenges; missing/long-gap planet coverage; unresolved offsets; invalid and duplicate timestamps; reversed ranges; local-span limits; bounded edge extrapolation; ambiguous daily sampling with independently refitted candidate errors; and bounded, serializable snapshots containing actual selected observations.
- A discovery-card/state test checks selected moon plot provenance, practice expedition restoration, profile card preservation and checkpoint restoration of run-local comparison work.
- `python scripts/check_moon.py`: native controls at 390 × 844 with high DPI, 1440 × 900 and 844 × 390. Starts the real focused moon course from the library and uses its normal generated observation logs. Exercises chart/sky focus, presets, exact dates, invalid-date recovery, optional comparisons, duplicate detection, selected-data enlargement, native uncertainty entry/submission, course completion, saved discovery cards, reload, and original expedition/clock restoration. Additional explicitly synthetic fixtures exercise alternate B selection, separate model-only forecasts, missing planet tracking and manual-fit output suppression. Checks closed defaults, absent ordinary-game teaching panel, hidden formulas when disabled and absence of runtime errors.
- `git diff --check`: whitespace validation.

Browser screenshots are stored locally in `/tmp/stranded-moon`. Browser fixtures distinguish generated course logs from synthetic alias cases. Local browser verification and the GitHub Pages deployment workflow are separate checks; local checks do not establish that every public-site/device combination was tested.

## Remaining limits

The envelope approximation, search range and candidate enumeration are inherited scientific limitations. The alias list is not exhaustive, and a long or sparse observing cadence can still support misleading local minima. The fit tries both senses of orbit but does not turn an apparent match into a unique physical orbit. Track interpolation/extrapolation policies do not calibrate their uncertainty or independently validate tracking accuracy.

The error estimates use the existing heuristic floors and omit a full covariance treatment. Fifty days can still be too long for a rapidly changing geometry; a shorter interval can still be too short to establish a period. The diagnostics explain these limits without requiring every player to study them. Forecasts deliberately extend the local approximation and deserve less trust outside the selected interval.

The existing explicit ECHO “do it” teaching helper and delayed peak-prediction adjudication retain their previous supplied-assistance policies. They are separate from the new recorded-data fit analysis and do not make its snapshots truth-verified. This work does not rewrite other instruments' fit families, add unlock gates, require new backend services or certify learning from course completion.
