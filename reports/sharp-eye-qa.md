# Sharp Eye investigation rewards

Date: 21 November 2026 (Asia/Dhaka). Decision: SCI-23 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved behavior

Recognize recorded investigations once per condition type per expedition, rather than paying for each discarded affected reading. Require a comparison or mitigation supported by instrument records. Keep the activity optional and understandable, with brief acknowledgment and further information available on request. Neither agreement with hidden truth nor producing an expected discrepancy establishes eligibility.

There are two credits: wind and refraction, each worth 15 base points. All refraction routes share one allowance, so at most 30 base points are available per expedition. The existing challenge multiplier applies to the final grade; for example, a 1.2 multiplier turns 15 base points into 18 grade points. Repeating a comparison, toggling kept/excluded flags, manufacturing rejected readings, saving notes or returning through a checkpoint does not produce additional credit.

## Recorded evidence

**Wind:** compare separate native manual pendulum releases, one exposed and one with the player's windscreen. Both must record at least five correctly counted swings, release angles from 1–10° within 2° of one another, measured lengths within 1%, and similar stable strong wind throughout. Start/end wind must exceed 6 m/s and agree between releases within the larger of 1 m/s or 20% of the screened reading. Timing must agree with the recorded count and release motion. The stored gravity must reconstruct from the player's own measured length and period. This does not compare the entry with true gravity or certify ruler calibration. ECHO stabilization alone is not the player's windscreen investigation. A null numerical result remains eligible.

**Refraction:** compare deliberately aimed horizon sights at the same station and height in damp and drier recorded conditions, retaining original apparent angles. The station must match, height must agree within 1%, bracing/tripod settings must match, and recorded angular step and zoom must agree within 1%. Dates and observation identities must differ. A single sight revised with a correction is not two observations. Alternatively, record a deliberately aimed horizon sight and a complete synchronized camp/rover noon-shadow measurement accepted by the existing shadow inference. An ordinary horizon sight can qualify for that independent-method investigation; it need not coincide with a hidden damp episode. No particular declared calibration relationship, field-note text or separated result ranges is required.

Horizon radii and any applied correction are reconstructed from their recorded heights, angles and correction parameters. Assistance may be explicitly labeled while preserving the original apparent angle. Legacy compensated sights and observations lacking the new deliberate-aim provenance are not invented or relabeled as qualifying investigations. This does not remove their ordinary log or worksheet use.

The eligibility module does not import generated world truth, seeds, true radius/gravity, or paid verification results. Conditions are taken from the saved instrument environment. Keeping or excluding an observation is irrelevant. The old post-run anomaly review remains separate from eligibility and no longer displays a per-rejection prize.

## Persistence and scoring

Each credit retains a bounded copy of its qualifying readings, shadow pair where applicable, method, condition, expedition identifier and earned date. Revalidation uses that archive. Later exclusion, deletion or revision of the live log cannot erase the completed comparison or farm another award. Manual checkpoints and automatic prelaunch rewind preserve both credit and acknowledgment state, including when loading older snapshots. A new expedition clears them.

Flight School, tutorials, flight practice and Free Roam cannot mint scored expedition credit. Returning from an isolated exercise restores the original expedition's archive. An ECHO-assisted journey retains recognition already earned, but excludes it from scored bonuses. The debrief labels such retained recognition as unscored.

New expeditions use ruleset 4 because the scoring policy changed. Existing expeditions retain their earlier physical and manual-flight contracts; new results identify the `investigation-v1` policy separately. Historical Atlas cards and their scores are not rewritten. This is not a server-backed leaderboard or tamper-resistant achievement system.

## Player experience

The existing closed “Conditions and methods” sections explain eligibility. No new task, blocking dialog, mandatory lesson, score chase panel or unearned checklist appears. When an investigation qualifies, one nonmodal toast acknowledges that condition's 15 base points. A reload or rewind does not repeat the notice. If multiple previously unacknowledged credits are loaded together, one combined acknowledgment is used.

The debrief shows earned investigations with a plain-language reason. Evidence details remain closed until requested. Credit recognizes the investigation process; it does not certify measurement accuracy or the absence of shared systematic errors. Long lists in the existing anomaly review now sit behind a closed details control, and discarded entries receive no success coloring or points label.

The 844 × 390 browser check exposed a pre-existing pendulum layout failure: subtracting HUD and stopwatch space from a short stacked stage produced a negative drawing scale and invalid canvas radii. Short landscape screens now place the rig and controls side by side; the drawing scale also stays positive during transient resizes. This fix preserves the ordinary phone and desktop arrangement.

## Verification

- `npm test`: 244 tests in 40 files passed, including 17 focused Sharp Eye tests.
- `npm run build`: TypeScript and production build passed. The existing main-bundle size advisory remains.
- Focused checks cover rejection farming; valid and null-result comparisons; hidden-truth/worksheet/verification independence; malformed, legacy, unsynchronized and incomparable evidence; corrected revisions; shared refraction allowance; immutable archives; deletion and exclusion; checkpoints and prelaunch rewind; new-run reset; practice/unscored contexts; challenge multiplication; preserved resources; and historical ruleset/Atlas behavior.
- `python scripts/check_sharp_eye.py`: native pendulum release/watch/count/keep and windscreen controls, horizon keyboard aiming and recording, once-only notices, exclusion/repetition, checkpoint restore, reload, native Flight School entry/exit with explicitly injected practice evidence, restored expedition credit, real debrief grading from an explicitly constructed result fixture, archived evidence expansion, Atlas policy and new-run reset. Checks run at 390 × 844 with high DPI, 1440 × 1000 and 844 × 390 with reduced motion. They require no runtime errors or document horizontal overflow.
- Existing `python scripts/check_radius_cross_check.py` and `python scripts/check_verification.py` regressions passed for optional field notes, unchanged comparison resources, paid verification budgets and checkpoint persistence.
- `git diff --check`: whitespace validation.

The native timing test uses model periods only to schedule its waits and recorded-weather fixtures to choose test conditions; those values are not passed to reward eligibility. Its deliberate horizon aiming establishes acquisition/provenance behavior rather than the accuracy of a human observation. The constructed result screen is a grading check, not a completed expedition flight. Browser screenshots are stored locally in `/tmp/stranded-sharp-eye`. Local browser checks and GitHub Pages deployment are separate validations.

## Limits and follow-up

Recorded technique is evidence of an investigation, not proof of understanding. The game does not assess arbitrary prose or require a preferred scientific conclusion. Shared calibration errors can remain in either method. The score is deliberately bounded so that players gain nothing by repeatedly manufacturing a bad exposure. Actual enjoyment and comprehension across audiences still need player feedback; automated checks cannot establish perfection.

Broader instrument feedback, optional expert analysis and automatic arithmetic are SCI-24 discussion work. They are not additional requirements for this reward.
