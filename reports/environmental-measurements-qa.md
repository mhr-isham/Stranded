# Environmental measurements — MODE-14, 16 November 2026

Environmental effects now have clearer mitigation, calculation and provenance paths. The agreed rule also applies to future effects: supply observable clues and a practical way to avoid/minimize the effect or account for it in a justified model with uncertainty. An effect should not silently invalidate an otherwise careful expedition.

## Implemented behavior

| Effect | Player response | Recorded evidence |
|---|---|---|
| Steady wind on the pendulum | Fit the instrument-kit windscreen in any mode, or return to camp and wait for calmer conditions. The exposed resting bob visibly tilts; the fitted screen removes the modeled crosswind force. | Wind at the start/end of timing, changes during the timing, protection used, observed length/period and instrument result. ECHO stabilization is identified as physical assistance, with no invented numerical wind correction. |
| Episodic humidity/refraction at the horizon | Recheck after the damp spell, or use an estimated refraction coefficient with uncertainty. New Cadet runs default to labeled ECHO humidity compensation; harder modes default to keeping the displayed angle and allow manual estimates. | Original angle and uncorrected radius, angle/radius used, station, eye height, observation time, chosen coefficient/uncertainty, treatment source and local calibration time when applicable. |
| Persistent thick-air refraction | Use an independently justified coefficient or the chapter's existing noon-shadow experiment. The local air probe estimates episodic humidity only, leaving persistent layers outside its calibration. | The correction's assumptions remain explicit. Tool help and the refraction lesson explain calibration against an independent radius and reject circular reasoning from the same uncorrected method. |
| Turbulent telescope images | Compare observing sessions or independent measurements after the image changes; use scatter and allow for blur, edge placement and shared alignment error. A larger apparent disk or longer parallax baseline improves relative precision. | New diameter and manual star logs record image conditions. Parallax readings retain conditions at exposure time, even after game time advances. A frozen pair stays frozen; repeated marks on it are explicitly not independent exposures. |
| Clouds or stellar flares blocking rover cameras | Wait for usable observations rather than attempting a numerical correction of a missing image. | Capture is disabled with the specific reason. The capture handler checks current cloud/flare conditions again to cover a change between UI refresh and click. |

The windscreen changes the force used in the existing pendulum integrator and is drawn around the rig. It is not a label attached to an unchanged result. Its fitted state persists in the expedition and participates in the existing practice/checkpoint snapshot system. Fitting/removal is disabled during a timing. A result retains the treatment used when it was measured even if the player changes equipment before keeping it.

Every mode retains the condition indicators and optional “Conditions and methods” reference. Astronomer and Legend do not gain automatic ECHO corrections or unsolicited method coaching. The bad-seeing season remains a challenge: waiting does not promise a perfectly sharp night. The eyepiece's image motion now scales with its existing seeing factor as well as its blur.

## Calculations and uncertainty

The horizon model uses apparent dip = geometric dip × √(1−k). The correction divides the measured apparent dip by √(1−k) and calculates radius from the corrected angle and measured eye height. The calculation accepts the chosen coefficient, not a lookup of the planet's true radius. The local calibration has a repeatable offset and an explicit ±0.02 uncertainty; it does not reveal a full atmospheric profile.

The shared radius contribution from coefficient uncertainty is propagated with the derivative of the radius calculation. The UI labels this a first-order model contribution and cautions when coefficient uncertainty is large relative to 1−k. It is not a complete error budget. Angular alignment, eye height, shared instrument errors and unmodeled layers may require additional allowance.

The progress-sheet sender uses the largest kept correction contribution as a conservative shared floor. Repeating the same calibration does not divide that contribution by √n. A player-requested scatter-plus-model suggestion combines the standard error and shared contribution in quadrature; the player still chooses a final uncertainty and must allow for other errors. A smaller stated uncertainty cannot silently omit the recorded model contribution in this sender. The independently editable sheet remains available for a separately justified estimate.

Readings with mixed treatments/protection prompt a compatibility review before averaging. Their include/exclude controls remain available. Expanded provenance uses a full-width table row so it is readable on phones and remains legible after a reading is excluded. Existing anomaly debriefs use the frozen treatment metadata instead of classifying a sheltered/corrected reading solely from the date's weather. This does not settle the separate SCI-23 discussion of the per-reading Sharp Eye reward and its farming exploit.

## Compatibility and scope

New expeditions use **ruleset 3**, identifying the apparent-angle and explicit correction flow in shared results. The ruleset-2-and-later manual-flight contract remains unchanged. Older easy-mode saves retain their previously compensated sight; the UI explains that uncompensated historical angles were not captured. Earlier readings without condition metadata are labeled “Conditions not recorded”; no historical provenance is fabricated. Observations already on the progress sheet are preserved.

This change covers the existing wind, horizon and seeing tools, plus consistent rover cloud/flare gating. It does not add extinction, clock drift, dust, new weather simulation, or new story scenes. Wind protection is a simplified steady-crosswind model, and the refraction calculation is an explicitly stated model rather than a validated atmospheric ray tracer.

## Validation

- **84 tests across 21 files pass.** New tests cover wind protection without changing weather, raw versus legacy humidity treatment, calibration repeatability/uncertainty, recovery of a known reference radius, persistent-layer residuals, derivative-based uncertainty propagation, invalid inputs, a shared uncertainty that survives repeated readings, exclusion of discarded records and provenance-aware debrief classification.
- The production build passes with the existing large-bundle warning. Authored formula tests cover both new tool equations and the expanded refraction lesson.
- `scripts/check_environment.py` passes in Chromium at **390×844 and 1440×900**: Legend windscreen operation, timing/protection freezing and reloads, manual Astronomer correction with invalid-input gates, raw/corrected history, a shared uncertainty floor, new Cadet correction versus legacy compensation, optional Legend seeing references, real simultaneous-image controls and frozen exposure metadata. A chapter-6 flare blocks rover capture with the stated reason. Screenshots of exposed/sheltered rigs, phone provenance and seeing/parallax panels were reviewed. No page errors were observed.
- `scripts/check_estimation.py` passes at both widths, preserving estimation workshops, actual pendulum/star prediction flows, commit/observation gates, reloads, optional Basic Training and restoration of the original expedition.
- `scripts/check_school.py` and `scripts/check_cadet.py` pass at both widths, covering the 47-module library, isolated guided practice, optional guidance, actual instrument warning flows and saved hide/reopen preferences.

Browser fixtures bypass the opening story and use short timings or deliberately placed image marks to test UI data flow. They are not realistic human measurements, complete chapter playthroughs, or evidence of learning and long-term engagement. The numerical tests separately establish the correction equations and uncertainty behavior under their stated model.
