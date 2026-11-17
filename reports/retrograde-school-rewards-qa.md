# Recorded-motion investigations and Flight School rewards

Date: 17 November 2026. Decisions: SCI-06 and the additional Flight School incentives agreed during its discussion in [GAME-REVIEW](../docs/GAME-REVIEW.md). This report describes the implemented scope and its checks; it does not authorize later science proposals.

## Player experience

### Understand the planet's motion using actual sightings

The Tracker retains the existing longitude chart, player-chosen opposition dates and synodic-period calculation. Its optional replay shows the player's saved sightings one by one. Controls provide play/pause, restart, three playback speeds, a sighting slider, an optional observed trail and a button to use that recorded date as the chart cursor. A numeric date control also makes chart marking usable without precise dragging.

Opening review pauses expedition time. Playback advances through saved records, not the simulation: it cannot obtain new observations, reveal future positions or grant extra observation time. Closing restores the previous pause state unless the player explicitly resumed time with the HUD. The clock remains under the player's control.

Dotted lines are visual guides between nearby recorded positions. Gaps longer than 1.75 normal sampling intervals are labelled and break the trail. The selected sighting gives the actual elapsed time and measured net change. Net motion across missing nights does not establish the intervening path. Inner-planet replay is labelled as elongation rather than outer-planet opposition.

An optional wide-sky overlay shows gold rings at past measured pointings. New native tracker records retain quantized longitude and latitude, at the existing tracker resolution. Those directions are projected into the current visible field and clipped by the terrain; clouds/flares retain their existing visibility rules. Old longitude-only saves work in the chart, but receive no invented sky latitude. Rings represent historical sightings against the star background, not several planets currently present. This is a recorded-sighting overlay, not a continuously sampled physical trail.

### Test an idea in Flight School

Basic Training, opposition and synodic practice offer an optional motion investigation. Inspect the last sightings, commit eastward/westward/unresolved motion, collect normally gated tracker observations and compare with the first later saved sighting. The collection button advances three days of practice time, enables the ordinary tracker and pauses afterward. Visibility and weather can still leave the player needing more nights.

The result explains both agreement and disagreement. Recognition is for committing and testing an idea, so an incorrect prediction is useful practice. The readout's 0.01-degree step limits whether a change is distinguishable. An opposite direction is a recorded comparison, not an assessment against hidden orbital truth.

Explanations distinguish turning points from opposition. Inferring opposition from a loop midpoint is presented as a near-circular approximation, with eccentricity and missing observations requiring caution and uncertainty. The optional pre-existing trend fit respects the manual-fit challenge.

## Encouragement and lasting recognition

| Mechanism | Behavior and limits |
|---|---|
| Mission patches | Every module's first explicit completion earns a permanent named patch. Opening a lesson alone, starting practice or skipping does not earn its completion patch. |
| Discovery cards | The logbook preserves the first card and the latest distinct attempt per module. It keeps the practice's own observations, entered worksheet values or committed teaching estimates when available. It never fills a card with unrelated expedition measurements. |
| Observation plots | Year and tracker practice preserve actual sample plots. Other supported measurement exercises preserve kept readings. Plots are limited to 180 selected actual samples, with this reduction disclosed; intermediate observations are never generated. |
| Prediction souvenirs | Star/swing cards retain committed value/range and the later measured comparison; motion cards retain the direction commitment and next saved sighting. Estimation workshops retain the committed estimate, worked teaching comparison and dataset. |
| Flight and standalone lessons | Flight cards record handling mode and assistance; lesson cards acknowledge explicit completion. Detailed flight telemetry is not archived in this iteration. Neither card claims to certify accuracy or flying skill. |
| Investigation milestones | First new field note, a wider three-date year baseline, and tested star, swing and motion predictions are each recognized once per profile. Supplied prerequisite records alone do not trigger the first-field-note milestone. |
| Immediate feedback | Guided-goal progress, a brief nonblocking recognition message and an existing sound cue make progress visible. Recognition sound respects the game's existing sound settings. |
| Varied repetition | Guided exercises offer an optional new-system seed from the beginning. Repetition can update the latest card while the first discovery remains. Every module stays open. |
| Assistance | Assisted completions receive the same patch and card, with help recorded. Historical first-completion status is retained; a later card can describe a new attempt with different assistance. |
| Existing players | Remembered completed modules get legacy patches/cards when the logbook loads. Missing historical measurements are explicitly acknowledged, rather than recreated or replayed as new rewards. |
| Persistence | Profile recognition survives reloads, new expeditions, checkpoint restores and return from isolated practice. Original expedition clock, measurements, fuel accounting and practice return behavior are preserved. |
| Fairness | Patches and milestones are cosmetic. They add no expedition points, fuel, verification uses, precision upgrades or mandatory unlocks. No streak, expiring collectible or recurring-grind requirement is added. |

## Verification

- `npm test -- --testTimeout=120000`: 152 tests across 30 files, including recorded-motion handling, hidden-data exclusion, immutable prediction comparisons, bounded discovery-card plots, duplicate reward prevention, assistance parity, legacy recognition and profile persistence through new games, practice return and checkpoint restores.
- `npm run build`: TypeScript and production build. The existing advisory about the main bundle exceeding 500 kB remains.
- `python scripts/check_replay_rewards.py`: at 390 × 844 (high-DPI phone) and 1440 × 900, replay five saved positions across one deliberate gap; verify two separate trail segments, no invented samples, a fixed expedition clock during playback and duplicate opposition-mark prevention. Native simulation produces finite saved sky latitudes. Complete an actual tracker-based motion investigation and opposition exercise through prediction, new sightings, date selection, uncertainty entry and completion. Check archived cards/milestones, reload persistence, no replayed award toast, zero practice-resource leakage and unrestricted new-system practice. Ascent completion fixtures exercise assisted/manual recognition and first/latest cards through the normal flight finish/return controls.
- `python scripts/check_year.py`: complete native three-date year practice and its first-two/later comparison, plus numerical edge cases, manual-fit/formula restrictions and interactive lessons. The step-wait helper now resolves the target index before polling synchronous game state; it no longer treats an unresolved asynchronous predicate as readiness.
- `python scripts/check_school.py`: library access, standalone lesson completion, an assisted pendulum exercise with its patch/card, skipped exercises, recommended modules and restoration when entered from a live expedition.
- `python scripts/check_estimation.py`: seven workshops, worked teaching comparisons, real star/swing prediction controls, commit-before-compare rules, reloads, optional Basic Training and expedition restoration.
- `python scripts/check_flight_controls.py`: keyboard/pointer/multitouch, pause/focus release, sensitivity/reduced motion and practice restoration at phone, desktop and landscape sizes; hard-mode rescue/scoring and successful manual-flight branches retain their behavior.
- `git diff --check`: whitespace validation.

Browser screenshots are written to `/tmp/stranded-replay-rewards`, `/tmp/stranded-year`, `/tmp/stranded-school` and the corresponding existing check directories. Fixture data supplies controlled edge cases or a valid flight-completion boundary; the motion/year investigations themselves collect observations through the native tracker/scope and normal time controls. Browser checks collect runtime errors and require none.

A repeated concurrent check encountered machine slowdown and deadlines in unrelated existing solver tests and browser actions. Final browser checks were run separately; the full suite used a longer timeout without changing its assertions.

A mobile regression exposed the compact tutorial covering investigation controls. Its minimised observation guide now hides its action row, stays below the HUD and provides expandable shortcuts to the investigation panels. Recognition messages are pointer-transparent and move above the navigation bar on phones, clear of that guide. The pendulum count dialog now exposes its complete bounds to the guide, which docks above it with a constrained scrolling height instead of covering Calculate g. Transient recognition does not certify scientific correctness.

## Remaining scope

The first/latest archive is a bounded souvenir collection, not an unlimited experiment history. Ordinary expedition tracker storage retains its existing behavior. Lesson completion remains self-reported acknowledgement. The guide's goal count records its exercise goals, not a scientific-quality grade.

Cloud-synced profiles, community galleries, public sharing of discovery cards, unique illustrated patch artwork, narrative crew reactions, additional investigation types and detailed flight-performance cards remain future discussion. No backend service is required for this implementation. SCI-07's parallax improvements are not included.
