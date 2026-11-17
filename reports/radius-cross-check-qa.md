# Optional radius cross-check and field discoveries

Date: 18 November 2026 (Asia/Dhaka). Decision: SCI-12 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved behavior

Compare hill and shadow radius estimates side by side with their uncertainties. Explain agreement or disagreement from recorded observations without declaring either method correct. Recognize a thoughtful comparison once with a cosmetic discovery record, keeping the activity optional. Additional methods remain future discussion work. The user emphasized an enjoyable, polished player experience.

The implementation treats this as a small field investigation. Both instruments have a closed “Optional · compare hill and shadow measurements” panel. A player chooses two observations, enters their stated radius uncertainties and requests a comparison. A shared-scale diagram shows each method's central value and ± range with labelled colors, endpoints and accessible numerical descriptions. Matching ranges and a visible discrepancy are both valid discoveries worth recording. There is no pass/fail color or prize for forcing agreement.

The main path stays short. Recorded conditions and calculation limitations are under requested details; the player's own prose is optional. A brief selection of takeaways allows a field note without imposing a writing assignment. Numeric fields and selectors work with keyboard and touch. Small-screen charts use readable labels, and source cards stack within the narrow hill panel or phone width.

## Trustworthy source selection

The hill candidate must be a kept R1 observation with horizon metadata: height, measured/used dip, observing date and the recorded environment. The radius must be consistent with that observation's stated height and used angle. A generic worksheet R1 does not identify its method and is not used as evidence. Older or supplied entries without sufficient instrument provenance are not relabelled as independent horizon sights. Their ordinary worksheet/log use remains available.

The shadow candidate is a complete, usable synchronized pair accepted by the existing shadow analysis. Each eligible capture can be selected separately. Its radius comes from the actual marked lengths, signed directions and odometer baseline, not from stored true latitude separation. Missing, unresolved, off-noon or inconsistent pairs are not offered as successful inference inputs.

The comparison uses one selected hill observation. It does not average unlike heights or divide shared errors by the number of readings. Selecting another observation clears that method's entered uncertainty. Requesting a preview fixes the selected identities so later data do not silently substitute another observation. Changing a worksheet value alone does not alter the comparison.

Each preview retains complete copies of the selected hill record and the camp/rover shadow records, their inferred radii, entered ranges, recorded shadow working-error estimate and the player's declared relationship between calibrations. Source revisions, exclusion, removal or a new expedition invalidate a preview. A stale preview cannot be kept. Saving reconstructs the canonical current comparison rather than trusting display-only copies of its derived values.

## What agreement means

The diagram compares the entered intervals on one radius scale. It distinguishes overlap, touching endpoints and separation. Negative physical radius is excluded from the displayed lower range. Finite positive, numerically representable uncertainties are required; nonfinite results and unsupported provenance are rejected.

This is an interval comparison, not a calibrated significance test. It does not compute a z-score, confidence probability, weighted average, verified true radius or automatic preferred method. Overlap can occur because ranges are broad or because both methods share a bias. Separation can reflect understated uncertainty, conditions, marking, calibration or model inadequacy; the interface does not decide which explanation is true.

The relationship selector starts with uncertainty about shared calibration. The player can instead report separate observations/calibrations or explicitly say that one result helped calibrate the other. This declaration is retained as the player's account; it is not a certification of statistical independence. Linked comparisons explicitly say that matching results are not independent corroboration.

The optional evidence review shows the selected hill height, station, date, raw/used dip and any recorded correction, plus the shadow date/local day, marked lengths, baseline and stated input uncertainties. It distinguishes an ECHO humidity sample from a complete atmospheric calibration and notes legacy compensated sights. It retains the shared shadow coefficient when one was entered. It also flags when an entered range is narrower than a recorded model/input error estimate.

Atmospheric conditions, leveling, ruler/height calibration or choosing a correction using the other result can connect errors. Repeated algebra or re-marking one image is not another independent method. The implementation makes those limitations visible without claiming to solve covariance. The optional recorded-shadow error guide follows existing mode rules; independent modes do not get automatic uncertainty fill or an unsolicited preview.

## Personal field note and recognition

A player can choose to remember how the ranges compare, why shared errors matter, or why more evidence would help. They may add up to 600 characters of their own words. The saved artifact is called “Two ways of seeing a world.” It preserves the observations, ranges, calibration relationship, takeaway, personal words, expedition context and dates.

There is one cosmetic discovery per expedition, including isolated practice expeditions. A discrepancy earns the same recognition as overlap. Identical repeated saves are no-ops; meaningful revisions update the existing note without awarding another discovery. The first note's earned date remains stable. There is no score, fuel, hint, verification-use, achievement or worksheet advantage, and comparing does not advance the clock.

Changing a completed comparison starts a fresh draft of previously saved personal words, with an explanation that the original saved note remains in the Codex until updated. This avoids silently attaching an old “these overlap” statement to a newly separated comparison. Unsaved personal text is not automatically graded or rewritten by the game. The chosen takeaway is reset for a new preview so it is an explicit choice for the current comparison.

The Codex can show the expedition's current saved note and the profile's first/latest discoveries, deduplicating identical snapshots. The same saved-note view is available from the Flight School library. Old first notes remain immutable; the latest slot updates. This bounds profile storage rather than making repeated re-marking a collectible counter. Field notes remain souvenirs, not certifications of accuracy or learning.

Saved observations do not change when their live sources are revised or removed. The artifact identifies that situation for notes from the current expedition. Historical notes from older expeditions retain their original context rather than pretending to be current measurements.

## Persistence and compatibility

New expeditions start without an expedition field note, while the first/latest profile archive persists. Missing fields in older saves default to empty/null state; no absent observation or award is invented.

Checkpoints preserve the saved note and profile recognition instead of rolling them back and allowing repeated first-discovery awards. Restoring an earlier observation log can therefore leave the note as a labelled historical snapshot. The comparison is not presented as current evidence if its sources no longer match.

Returning from isolated practice restores the original expedition's own note while preserving the newly earned profile souvenir. Practice notes are labelled as Flight School work, and do not mark another exercise completed. No new course or compulsory objective is added: the library remains at 49 modules. The ordinary game does not open the activity automatically or require it for radius measurement, launch or progression.

## Verification

- `npm run build`: TypeScript and production build passed. The existing main-bundle size advisory remains.
- `npm test -- --testTimeout=120000`: 200 tests in 36 files passed.
- Eight new focused tests cover source/worksheet separation; overlap/touch/separation and physical range limits; invalid uncertainty and provenance; multiple captures and stale observations; equal recognition for different outcomes; unchanged resources/worksheet/achievements; immutable canonical snapshots; checkpoint/new-run behavior; and original-expedition/profile handling after practice.
- `python scripts/check_radius_cross_check.py`: 390 × 844 high-DPI phone, 1440 × 1000 desktop and 844 × 390 landscape. Native controls request comparisons, enter invalid/valid uncertainty, declare linked calibration, choose takeaways, write a note, save/update it, compare both outcomes, revise source data, inspect first/current artifacts, reload, exclude a source and exercise independent-mode defaults. It checks that score-related state, fuel penalty, hints, verification uses, worksheet and clock remain unchanged. The final checks include small-screen selector bounds and no runtime errors.
- `python scripts/check_hill.py`: existing native hill travel, paused arrival, cancellation/deadline, high-DPI/keyboard/touch aiming, brace countdown, equipment provenance and independent-mode/formula behavior passed.
- `python scripts/check_shadows.py`: existing native rover travel/noon waits, image capture, marking/revision, frozen epochs, inference, course completion, archive/restore/reload, clouds and locked-site guards passed across three layouts.
- `python scripts/check_school.py`: existing 49-module library, filters/search, completion/assistance, optional campaign start, chapter recommendations and safe expedition return passed at phone/desktop widths. A heavily concurrent initial run raced the guide's automatic step advancement and tried to click a disabled Next button; the normal rerun passed without changing the school implementation or weakening its assertions.
- `git diff --check`: whitespace validation.

The new browser script uses stored-observation fixtures to isolate comparison behavior. It is not an assessment of a human player's limb-marking skill. Native physical acquisition is covered by the separate hill and shadow regression scripts. Screenshots are stored locally in `/tmp/stranded-radius-cross-check`. Local browser testing and the GitHub Pages deployment workflow are separate checks.

## Remaining limits

The ranges are player declarations. The activity cannot verify that a chosen uncertainty is well justified, that calibrations were truly separate or that a short takeaway demonstrates learning. The recognition intentionally records the investigation process, not correctness. Arbitrary personal prose is not automatically adjudicated against a model or rewritten.

The comparison has no full covariance model, systematic-bias estimator or automatic result combination. First/latest artifacts are a bounded souvenir archive rather than a complete version history of every draft. Baseline/height/optical calibration limitations inherited from the instruments remain relevant.

Diurnal parallax, retrograde-rate year inference, more general method comparison and covariance-aware quantitative claims remain separate future discussions. Tests establish the listed behavior and layouts; actual enjoyment across all audiences still requires player feedback.
