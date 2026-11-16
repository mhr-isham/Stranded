# Paid hints and checkpoints — MODE-16, 16 November 2026

Loading a checkpoint or rewinding a failed flight now preserves the highest unlocked hint level for each quantity and the expedition's paid-hint count. Reading an unlocked hint again is free. Newly unlocked paid levels retain the existing **25-base-point** grading cost, using one shared constant for the grade calculation and UI label. Stargazer hints remain free. Cadet retains up to three levels per quantity, Navigator one, and Astronomer/Legend none.

The shared unlock action reads current state and accepts only the next level permitted by the mode and current solve chain. Repeating a stale callback cannot charge the same level twice; skipping ahead, non-integer levels, unavailable quantities and requests outside expedition play are rejected. No hint is purchased merely by loading a checkpoint or reopening the progress sheet.

Checkpoint restoration merges the greatest unlocked level for each quantity from the current run and saved state. This covers legacy slots that contain different hint branches from before the persistence fix. Overlapping levels are counted once. Paid-hint modes preserve the largest known paid-use total and at least one paid use per distinct merged level; free Stargazer progress is not converted into paid uses. New expeditions reset run-specific hint progress as before. Separate Flight School snapshots retain their existing policy of restoring the original expedition rather than transferring practice costs into it.

The hint panel states the price and persistence rule. Unscored practice is labeled separately so learners are not told that their original expedition's score is being charged. The checkpoint menu explains that loading keeps unlocked hints and spent hint/verification costs. The prior verification-use and fuel-preservation behavior remains intact.

Validation:

- **101 tests across 23 files pass.** Seven new tests cover single-charge sequential unlocks, the unchanged grading deduction, repeated checkpoint loads, combined hint/verification preservation, failed-flight rewind, overlapping and disjoint legacy hint branches, free Stargazer progress, mode limits and new-expedition reset.
- Production build passes with the existing large-bundle warning.
- `scripts/check_hints.py` passes in Chromium at **390×844 and 1440×900**. It uses real hint buttons, entry navigation and checkpoint Save/Load controls. It verifies reload persistence, access after loading older slots, no repeat charges, maximum-level retention, rewind access, Navigator's one-level cap, free Stargazer hints, unscored-practice wording and hard-mode absence. The browser's direct rewind call is a state-transition fixture; the rewind function and cost behavior are independently covered by the automated tests. Screenshots were reviewed; no page errors were observed.
- `scripts/check_verification.py` passes at both widths after the checkpoint change, covering shared paid check allowances, sensor versus evidence sources, persistent result history, saved/stale results and verification fees across repeated loads.

These checks establish the named state transitions, grading rule and UI paths. They are not complete human expedition playthroughs or a claim of cheat-proof local save storage. Remaining mode-contract and hint-content quality work retain their separate scope.
