# Measuring the year and learning it in Flight School — SCI-05

Agreed, implemented and checked on 17 November 2026 (Asia/Dhaka). The additional user requirement was to make the investigation understandable and enjoyable in Flight School, with active observation rather than explanation alone.

## Observe, estimate, return and test

The year tool retains the existing observational routes: record the star's longitude near twilight on ordinary worlds, or the background sky's hour-angle turn on locked worlds. The fit uses the player's recorded positions and dates; it never receives the system's true period.

The tool now distinguishes:

- No valid observation or only one distinct observing date.
- A selected time span shorter than the existing half-day logging cadence.
- A valid, provisional two-date line, which cannot establish scatter.
- Three or more dates that can test a line and support a scatter-based uncertainty estimate.
- Invalid/non-positive rate estimates that cannot produce a usable automatic year value.

Finite observations are sorted chronologically before angle unwrapping. Same-time repeats remain visible but only the first at each timestamp enters the fit; repeats cannot manufacture time coverage or reduce its uncertainty. They also cannot change subsequent unwrapping. Nonfinite records are counted and excluded from plotting/fitting without deleting the saved record. Chart selection fits only the selected dates while retaining excluded dots. Labeled numeric date-range fields and a clear-all-selection button complement dragging.

The fit is evaluated in centred coordinates for numerical stability. The inferred period and its conversion to seconds must remain finite. Two-date fits provide no fabricated scatter estimate. Numerically negligible residuals do not produce a recommended zero-sized year error. If rate uncertainty is large relative to the rate, a small symmetric first-order year uncertainty is withheld. Players still state their own positive total error on the progress sheet.

## What the chart means

Dots are observations; the blue line is the selected fitted drift. Where the mode permits automatic error guidance, grey curves show one standard error of the fitted **mean line** under independent, equal-variance random scatter. This is neither a future-observation interval nor a complete physical error budget. The detailed explanation is optional so the main chart remains readable.

Wider time coverage can constrain a rate more strongly under the same positional scatter. A rough new sighting or a poor straight-line model may increase uncertainty or shift the result. Shared centring offsets, variable image quality and systematic errors remain separate concerns. The shortest-turn angle unwrap cannot discover an unobserved extra revolution across a large gap; the UI states this assumption. Curved motion can invalidate a constant-rate approximation over a long interval. There is no universal number of days that guarantees an accurate year; the half-day minimum preserves the instrument's existing logging policy rather than claiming such a guarantee.

Manual-fit challenges hide automatic fit lines, rates, year values, uncertainty curves and the automatic prediction trend. They retain raw observations, dates and controls. Formula-off settings remain off. Modes without the automatic scatter guide do not receive the new numerical uncertainty guide or grey curves. Requested Flight School lessons use explicitly labeled teaching data in their own context.

Native ordinary-star logging also rechecks scope selection, twilight and obscuration at action time, protecting against conditions changing between a render and a click. Native observations are marked manual; ECHO-generated practice logs are marked as supplied. The ECHO worksheet uses the same validated observed-data fit, refuses manual-fit and poorly constrained-rate cases, and labels its illustrative one-percent allowance combined with fitted scatter as an example rather than a validated total uncertainty.

## Flight School: make the evidence visible

The existing year lesson now includes an optional miniature observing expedition. Learners can record again at the same time, return after one, ten or twenty-five teaching days, or deliberately offset the next teaching sighting by three degrees. The plot, status and first-two-versus-current comparison respond to those choices. Small centring offsets are specified teaching data, not added noise in the player's expedition. Changing the teaching model resets only the mini log. A matching mini expedition in the locked-world lesson uses a clearly labeled sixty-day locked orbit and background-sky turn.

The focused **Log and fit the year** exercise starts at the Observatory with no supplied observations or year answer. Its guide leaves the instrument and panels accessible. The sequence now gives the learner a first sighting, a short-baseline sighting on the next observing day, then a later sighting about twenty-five days afterward. Learners centre and log through the ordinary controls. The optional investigation panel compares their first two dates with the complete later record, offers observing-date choices and a requested reflection explaining what changed. The guide includes a direct panel shortcut.

The comparison derives its early view from the first two stored dates, so it survives reloads without another competing saved worksheet. Its time buttons advance and point the instrument without recording measurements. The reflection/mini log is optional and unscored; finishing the regular exercise does not require a quiz or extra comparison. Training still records practice rather than skill certification. The library retains its 47 modules and existing tutorial step identifiers; the original expedition, clock and observations are restored after practice while training history is retained.

The existing star-prediction exercise now uses the same finite/baseline fit validation and chronological unwrapping. Its commitment still precedes the new target-time observation; its comparison does not reveal hidden system truth.

## Verification

- `npm test`: **140 tests passed in 28 files**. New tests cover distinct dates, baseline limits, two-date uncertainty limits, recovery from recorded drift, numerical-zero scatter, chronological wrap, repeat exclusion, wider-baseline precision, worsening scatter, invalid/non-positive rates, date selection, actual locked-world geometry, validated/labeled ECHO worksheets, poorly constrained-rate refusal and starting focused practice without supplied answers.
- `npm run build`: TypeScript and production build passed. The existing bundle-size advisory remains.
- `python scripts/check_year.py`: Chromium at 390 × 844 (DPR 2) and 1440 × 900. Checks actual rendered baseline/fit statuses and date selection, manual-fit/formula-off behavior, native locked-world logging in clear conditions, both interactive teaching mini expeditions, and a complete focused year exercise using ordinary lesson/date/point/log/send/finish controls. The three native observations remain manual, assistance stays false, completion is recorded, and the original gravity entry, clock and empty observation log are restored. Screenshots: `/tmp/stranded-year`.
- `python scripts/check_estimation.py`: existing workshops, pendulum/star prediction gates and comparison timing, optional Basic Training, persistence and practice-restoration checks passed at both widths.
- `python scripts/check_school.py`: library/module counts, filtering, lesson progress, guided/assisted exercises, optional campaign entry and safe expedition return passed at both widths.
- `git diff --check`: passed.

Numerical edge-case browser checks use explicit fixtures. The school investigation itself takes observations through the actual controls; the teaching models remain separate. These checks establish behavior and mathematical examples, not enjoyment or comprehension for every player. Human testing should check whether learners distinguish a first line from a tested fit, choose a useful next observing date, and understand why additional data can disagree.

Publication is verified through the GitHub Pages deployment workflow. Browser checks target the local application; the public Pages URL is not directly browser-tested in this environment.
