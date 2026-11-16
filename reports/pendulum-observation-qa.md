# Pendulum observation — SCI-02

Agreed, implemented and checked on 16 November 2026 (Asia/Dhaka). SCI-02 preserves the hand-operated experiment and adds optional explanations of timing precision and measured gravity. Technique rewards and celebrations remain a separate SCI-03 discussion.

## Implemented behavior

### Operate and understand the rig

Players still choose a length, align a ruler hairline with the bob's centre, release the bob, run a stopwatch and enter their count of full swings. The simulation retains the nonlinear pendulum, knot offset, real-time motion, crosswind and windscreen. No automatic counting, compulsory twenty-swing attempt, new score bonus or hidden-truth correction was introduced.

A closed-by-default comparison explains why one full swing is there and back and why start/stop error matters less over more swings. Before a timed period is available it uses a labeled two-second example; afterward it uses the current result or latest kept timing. Its table compares one, five and twenty swings plus the player's actual count. Adjusting a hypothetical **whole-interval** timing error changes the period-error and percentage columns. For example, 0.2 seconds of total timing error contributes 10% for one two-second swing and 0.5% for twenty such swings.

The comparison explicitly excludes length, large-angle, wind and counting errors from that timing budget. It explains that small fractional period errors contribute roughly twice as much fractional gravity error. The example error is not automatically saved, propagated as total uncertainty or entered on the progress sheet. Repeated timings and shared errors retain their existing interpretation.

### Interpret the player's gravity

The optional Earth comparison uses either the current instrument result, the latest kept reading or the explicitly labeled progress-sheet estimate. It never receives the true world gravity. Once the player submits a stated uncertainty, both the value and uncertainty scale against the 9.81 m/s² Earth reference. A 4.905 ± 0.4905 m/s² estimate becomes about half Earth gravity, with weight about 50% ± 5 percentage points of Earth weight. The text distinguishes unchanged mass from changed weight.

A reading without a stated uncertainty is labeled accordingly, with a route to submitting the player's own error. A sheet estimate remains labeled as the sheet estimate even if newer readings have not yet been sent. The comparison is not an independent verification. The added equations use the existing KaTeX/MathML renderer and obey the formula toggle, including formula-off hard modes. Both explanations are available on request and initially closed; existing hint costs and mode warning rules are unchanged.

### Make time and unfinished measurements clear

An indicator next to the stopwatch distinguishes **rig/watch real time**, **expedition paused or 1×**, and the saved warp selection. The HUD correctly says paused when the expedition is paused. The bob and watch continue using real elapsed time; an unpaused expedition advances at 1× and consumes its ordinary time/air. Leaving the rig releases the real-time override and retains the current pause/resume state and warp selection. The game's existing clock defaults on a browser reload remain unchanged; only observation data are claimed to persist here.

Length, scale alignment, angle, release/stop and windscreen controls are locked during timing and its pending swing-count dialog. Result records retain the actual release angle, measured length, elapsed time and count even if the setup is subsequently changed. Native keyboard activation of Start/Stop and +1 is handled once; global shortcuts ignore editable/native interactive controls and repeated keydown events. Zero/negative/nonfinite times, unsafe/noninteger counts and overflowing calculated gravity cannot become results. Worn-stopwatch challenge delays cannot produce a negative display.

Hiding the page during an unfinished timing invalidates that attempt, stops the watch and leaves an interruption message until the next start. This avoids combining a wall-clock interval with a throttled visual swing. Returning and releasing again starts a fresh timing; no reading or penalty is created. Leaving the tool also abandons an unfinished timing.

New kept observations retain optional swing-count and elapsed-time metadata, displayed under Conditions & calculation. Older readings without these fields remain usable, including their existing period-based prediction exercises.

## Verification

- `npm test`: **113 passed in 25 files**. New checks anchor one-metre pendulum calculations to standard Earth gravity, verify the one-versus-twenty-swing timing budget, preserve the effect of a counting mistake, reject invalid/overflowing inputs, and scale the player's value/uncertainty. Existing equation tests require all new formulas to have valid typesetting mappings.
- `npm run build`: TypeScript and production build passed; the existing bundle-size advisory remains.
- `python scripts/check_pendulum.py`: Chromium at 390 × 844 (DPR 2) and 1440 × 900. Checks optional comparison defaults and adjustment, rendered mathematics, ordinary start/count/stop keyboard interactions, rig locks, paused expedition with advancing watch, finite-count guards, own-result feedback, manually stated sheet uncertainty, saved count/time after reload, within-session warp restoration and pause state, every remaining mode with formulas off, and interruption handling. Output and screenshots: `/tmp/stranded-pendulum`.
- `python scripts/check_environment.py`: existing windscreen, frozen measurement provenance, expert refraction, seeing, rover and flare flows passed at both widths.
- `python scripts/check_estimation.py`: all estimation workshops, real pendulum/star UI prediction flows, optional Basic Training and restoration passed at both widths.
- `git diff --check`: passed.

Browser fixtures bypass the opening story and use short manual timing intervals to check data flow; they do not certify human timing accuracy, realistic technique or enjoyment. The visibility test dispatches a hidden-page event to exercise the interruption handler; it does not reproduce every operating-system background behavior. The pure calculation tests supply the quantitative anchors. Broader technique assessment and accessibility/score tradeoffs remain open under SCI-03.

Publication is verified through the GitHub Pages deployment workflow. Browser testing here targets the local application; the public Pages URL is not directly browser-tested in this environment.
