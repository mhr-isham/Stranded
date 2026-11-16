# Pendulum technique and recognition — SCI-03

Agreed, implemented and checked on 16 November 2026 (Asia/Dhaka).

## Player-facing behavior

A new Technique & milestones panel offers a closed-by-default review of the player's own recorded process:

- A controlled release is a kept manual timing with a nonzero 1–10° release, at least five reported full swings, and supporting recorded bob motion.
- A repeat set contains at least three kept, comparable timings from separate releases. Comparable here means measured lengths within 1% of the latest eligible timing and the same recorded wind protection. Reusing the same release does not inflate this set. The period range is shown from those records; the text explains that similar results and separate releases do not remove shared errors or prove correctness.
- A stated uncertainty is recognized as a choice recorded on the progress sheet. It is not assessed against the true gravity, called adequate, or rewarded just for being small.

Keeping an eligible manual timing of twenty or more swings earns the **Twenty-swing observation kept** milestone. The first such keep in the expedition shows a brief, non-modal gold panel and uses the existing unlock chime when sound is enabled. A small badge remains in the panel. The celebration disappears after 3.2 seconds, uses no animated movement/flashing, and never blocks controls. Ordinary shorter or otherwise non-qualifying readings remain usable.

This milestone is cosmetic: **zero score points, fuel, hint uses or verification charges**. The review and milestone do not alter grading, difficulty, achievements or existing measurement uncertainty. The milestone is retained across autosave/reload, checkpoint loads and failed-flight rewinds; it does not replay when the same milestone is reached again. Starting a new expedition resets it. Isolated practice has its own milestone state and restores the original expedition's state on return, including legacy return snapshots.

## Evidence and assistance

Native timings now retain their source, actual release angle, a release identifier and the turning points observed while the stopwatch runs. The angle and source are frozen when timing starts; the motion record is frozen when it stops and retained with the kept observation.

Turning points are detected from changes of angular-velocity sign inside the existing numerical integration steps. This observes the bob's motion; the milestone evaluator receives no world model or true gravity. A conservative cycle count between recorded endpoints is allowed to differ from the entered count by one cycle for arbitrary start/stop phase. This catches a typed twenty after a fraction of a swing without supplying an automatic counter, correcting the player's count/result, or showing the internal count. The own-record checks also require finite positive values, whole counts and consistency between saved interval/count/period. This is local gameplay evidence, not tamper-proof certification.

The current controls remain manual across mouse, touch and keyboard. The assistance/scoring disclosure is available on request in every mode. New technique feedback is not an unsolicited hard-mode warning or a hidden-truth check. It uses only stored records and remains closed until requested, including Legend.

The existing ECHO pendulum shortcut now explicitly marks its generated observation as ECHO-supplied. These observations remain usable for their existing practice purpose but never qualify as manual technique. Wind stabilization and windscreen treatment retain their separate condition labels. Older observations without technique provenance remain usable; missing evidence cannot retroactively earn a manual milestone.

The agreed policy for a **future** automatic counter or timer is recorded in GAME-REVIEW: disclose the assist, preserve its source and explain scoring treatment before use. No new automatic timing/counting aid or accessibility penalty is introduced in this change.

## Verification

- `npm test`: **120 tests passed in 26 files**. New tests cover zero/repeated direction samples, valid motion and arbitrary start phase, independence from correct gravity, insufficient motion, incorrect counts, ECHO/legacy/excluded records, release-angle eligibility, repeated-release deduplication, setup compatibility, one-time zero-resource awards, checkpoint preservation, new-run reset, and isolated/legacy practice restoration.
- `npm run build`: TypeScript and production build passed. The existing bundle-size advisory remains.
- `python scripts/check_technique.py`: Chromium at 390 × 844 (DPR 2) and 1440 × 900. The fixture sets a short string and seeks stronger gravity to keep real timing practical. At each width it first rejects a typed twenty after a short interval, then keeps a real twenty-swing motion-based observation through ordinary release/watch/count/keep controls, verifies the celebration, and records two further real five-swing timings from fresh releases. It checks the three-release review, player's stated uncertainty, zero-resource accounting, dismissal, badge/reload lifecycle, explicit ECHO provenance and closed expert review. A stored-record fixture checks a repeated eligible keep after reload without repeating the long timing. Screenshots: `/tmp/stranded-technique`.
- `python scripts/check_pendulum.py`: prior SCI-02 checks passed at both widths, including keyboard counting, setup locks, clock behavior, calculation guards, metadata persistence, formula-off modes and interrupted timing.
- `python scripts/check_estimation.py`: workshop, pendulum/star prediction, optional Basic Training, saved progress and expedition-restoration checks passed at both widths.
- `git diff --check`: passed.

These are behavioral and numerical checks, not a human study of learning, enjoyment or reaction-time accuracy. The milestone recognizes a process with recorded evidence; it is not certification that the inferred gravity or its stated uncertainty is correct. The original end-of-run accuracy achievements and broader scoring/achievement recommendations are outside this change.

Publication is verified using the GitHub Pages deployment workflow. Browser verification targets the local application; the public Pages URL is not directly browser-tested in this environment.
