# Two-site noon shadows: alternate radius expedition

Date: 17 November 2026. Decision: SCI-11 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved scope

Offer the shadow experiment as a general alternative to the hill measurement where the system supports it. Make the sunlight/shadows, rover separation and measurement flow visually clear. Save location, local-noon/day and baseline context; use the planet's actual solar cycle rather than Earth-length day bins. Explain the method gradually in optional Flight School practice. The user additionally requested that the experiment look nice.

The result is a responsive field-science workbench with a curved-route schematic, labelled camp/rover stations, a travelling rover, an illuminated stick and ground ruler, a fuzzy shadow edge, a movable blue marker, frozen-view/date labels and a side-by-side comparison of the player's marked lengths. Camp and rover have distinct colors plus text labels. The radius reveal uses the player's marks; it does not reveal the generated planet radius.

## Access and player flow

The camp shadow stick and an explicit alternative-method button on the hill are available from the beginning across suitable chapters and independent modes. The existing hill workflow and chapter-3 shadow mission remain. Locked nighttime camps are excluded from normal shadow entry points; directly reopening that screen gives an explanation and an instrument link rather than an endless wait for noon. The experiment is an option, not a new progression gate.

Deploy the rover north first. This fixes the old chapter-3 instructions that asked for a camp reading before a multi-day journey and then expected a same-day comparison. The northward survey continues to share the rover with parallax and surface exploration: another active rover excursion prevents dispatch. A poleward survey limit prevents leaving the supported geographical range. The route view shows travel progress and distance, including a return journey. Survey speeds follow the existing rover upgrade and slow-rover challenge settings.

Travel and noon have explicit wait controls. They advance the expedition clock, use ordinary resource rules and pause on arrival. Leaving the screen cancels its local wait and restores the previous clock behavior through the existing shared time helper. Arrival does not collect data automatically.

Near local noon, the player captures both views at the same instant. Capture pauses the expedition; the player may later resume the clock while the photographs retain their acquisition time. Switching between camp and rover clears the unsaved marker, while kept marks remain. Capturing another pair or returning to the live preview does not delete saved observations.

The marker supports tap/drag, arrow keys at 1 cm, Shift at 1 mm, Home/End and an editable numeric position. Pointer mapping uses the SVG's CSS rectangle, so high-DPI devices do not double the apparent measurement. The ruler and vertical stick share the same spatial scale. Pointer-selected positions use millimetre increments; these controls do not certify millimetre optical accuracy. The marking-error field is a player-editable working assumption.

On small screens the plan/capture controls precede the instrument. Capture scrolls to the workbench; keeping both marks scrolls to the comparison. On desktop the instrument and plan sit side by side. The short-landscape school guide docks narrowly over the planning side, leaving the measuring area clearer. The main-game lesson, uncertainty review, formula explanation, sending form and refraction treatment are optional sections or explicit actions.

## Scientific and data corrections

### Actual local solar cycles

The instrument now derives an unwrapped solar hour angle from the rotating meridian and the star's equatorial direction. Its day identifier advances at local solar midnight, not every 86,400 seconds. The noon wait numerically locates the next upper meridian crossing, allowing non-Earth rotation and seasonal changes in apparent solar time.

Every new observation preserves its capture ID/time, camp/rover identity, raw marked length and apparent altitude, signed shadow direction, location latitude/longitude, local solar day/hour, baseline, baseline uncertainty and marking uncertainty. The coordinates record acquisition context; the radius calculation does **not** use their true latitude difference. That would reproduce the hidden radius instead of inferring it from shadows.

Only matching capture IDs and timestamps on the same meridian/solar cycle are paired. Unsynchronized observations and legacy records without acquisition context remain in the log but are not silently treated as a valid pair. The latest complete capture is selected, including a new pair captured at the same paused simulation epoch. Re-keeping a mark on one captured view revises that observation instead of increasing the sample count.

### Signed geometry and observation bounds

The model uses the signed zenith angle inferred from each marked length and observed shadow direction. Same-direction angles subtract; opposing directions add through the signed difference. This fixes the previous absolute-altitude subtraction when the Sun lies between the two sites' zeniths.

The radius is the odometer baseline divided by that measured angular difference in radians. The computation uses no hidden correct radius or true shadow-tip coordinate. The generated system drives the physical image and solar clock; the player still positions the marker.

Paired acquisition requires both stations to have an arrived rover, positive finite baseline uncertainty and the Sun between 15 and 89.5 degrees altitude. Low light, nearly overhead unresolved shadows, clouds and flare obstruction prevent capture. Live obstruction also covers the image; it does not leave an apparently usable clear shadow behind a disabled button. Already captured photographs retain their original conditions.

Off-noon photographs can remain as observations. Radius inference requires them to lie within fifteen local solar minutes of noon and rejects geometries whose timing ambiguity overwhelms the angle difference or makes a near-overhead direction unreliable. A conservative angular departure bound is derived from the marked zenith angle and recorded hour angle. It is converted to a radius allowance using the smaller possible angular separation. That bound is added separately from independently propagated uncertainties, rather than being called a random standard error.

### Refraction and uncertainty

The old instrument substituted a nonzero coefficient when a system's refraction was zero. Zero now stays zero. Higher sunlight reduces the modeled refraction; it does not remove it. The optional correction accepts a player's coefficient and its uncertainty for the stated high-Sun model. It inverts the apparent-altitude relation numerically, preserves raw lengths/angles and requires consistent shared assumptions for both marks. It does not fetch the correct coefficient as an automatic answer or use the hill humidity sample as an unexplained calibration.

The radius error estimate propagates the two entered marking uncertainties, entered baseline uncertainty and the derivative of the *shared* coefficient's effect on the angle difference. The shared coefficient is not counted as two independent corrections. A conservative timing allowance is added after the quadrature calculation. The estimate is explicitly not calibrated confidence; control increments are not error bars.

The existing sender requires a positive player-entered final uncertainty. Numerical guides follow mode rules; formulas follow the formula preference and are authored with proper mathematical typesetting. Sending a shadow radius deliberately replaces the worksheet's current R1. There is no automatic cross-method agreement award or hidden-truth grading.

## Flight School and preservation

A new independent “Measure with two noon shadows” exercise is open in the existing library, bringing it to 49 modules. It uses the existing Refraction/Eratosthenes lesson, followed by two practical goals: collect a usable marked pair and send the inferred radius with uncertainty. The lesson no longer claims that shadow measurements are immune to atmospheric effects, and explains signed directions and deploying the rover before the shared noon.

The three new standalone steps sit after the Basic Training endpoint. Basic Training and older non-session tutorials still end at graduation; the new experiment does not become three extra compulsory steps. The focused school guide is compact and nondimming. The ordinary game never opens its teaching automatically.

Completion archives the player's actual two marked shadow lengths versus baseline position, their dates, directions, stated errors, refraction treatment and inferred result on the normal first/latest discovery cards. It acknowledges practice, not certification or accuracy against hidden truth. Existing cosmetic recognition applies; no fuel, scoring or truth-check advantage is added. Original expedition time, worksheet, rover state and shadow observations return after practice, while the profile's earned recognition persists.

Old saved shadow records and worksheet results are preserved. Their missing coordinates, capture IDs, directions and solar-cycle metadata are not invented. The review can still display the old apparent altitude and date; obtaining a new trusted pair uses the new capture flow. Frozen photographs themselves are transient tool views; only kept observations persist through reload. Reopening the tool can infer from a complete saved pair without pretending to restore an unsaved photograph.

## Verification

- `npm run build`: TypeScript and production build passed. The existing main-bundle size advisory remains.
- `npm test -- --testTimeout=120000`: 192 tests in 35 files passed. The focused shadow/reward/equation suites also passed: 22 tests in three files.
- Eight shadow-analysis tests cover generated systems in chapters 1–5 and 7–9, recovery from actual physical shadow images, same- and opposite-direction geometry, a physically constructed Sun-between-sites case, non-Earth local-day boundaries, numerical noon finding, missing/mixed/legacy provenance, invalid readings, off-noon guards and allowances, correction inversion, zero-refraction behavior, shared errors, geographic bounds, locked sites, revisions and latest complete capture selection. A coordinate-independence assertion checks that changing stored latitudes cannot drive the radius result.
- A discovery-card test checks actual marked plot provenance and uncertainty, saved profile recognition and restoration of the original expedition's shadow records. The existing training-library tests validate all exercise ranges.
- `python scripts/check_shadows.py`: 390 × 844 high-DPI phone, 1440 × 1000 desktop and 844 × 390 landscape. Opens the real new school exercise, dispatches the rover, waits through real travel/noon controls, captures, marks via native pointer and fine keyboard controls, revises one image, changes live time while preserving frozen epochs, keeps both observations, reviews formatted equations, submits an uncertainty, finishes and restores the original expedition. Checks actual archived marks and reload persistence, independent main-game access, closed teaching/details, zero-baseline-error rejection, live cloud obstruction and locked-site behavior. Deterministic image targeting supplies pixel locations for testing controls; it is not evidence that automated players learn to locate a fuzzy limb accurately.
- `python scripts/check_school.py`: 49-module library, filtering/search, view/skip/complete/repeat, guided exercise and assistance, optional campaign entry, chapter recommendations and safe return to title/live expeditions at phone/desktop widths.
- `git diff --check`: whitespace validation.

Local screenshots are in `/tmp/stranded-shadows`. Browser checks require no runtime errors. Local browser testing and the GitHub Pages deployment workflow are separate checks; this report does not claim a public-site browser test on every device.

## Remaining limits

This remains a meridian, near-noon, spherical-planet experiment using two fixed-height sticks. The survey distance has a player-stated uncertainty but does not simulate route odometer calibration, topographical meridian arc corrections or stick leveling errors individually. The northward survey is the existing abstract remote expedition; this change does not turn it into a new manually driven terrain map.

The sunlight/refraction model is deliberately simple. Shared coefficient treatment and timing bounds improve honesty but do not replace full covariance, vertical atmospheric profiles, changing stellar declination across unsynchronized captures or a calibrated optical measurement model. Repeated marks on one image do not establish independent evidence. Very wide or nonlinear input uncertainties need more than first-order propagation.

Coordinates belong to simulation provenance and are not supplied as an independent radius measurement. Baseline and marker errors start with editable illustrative working assumptions; players should justify them. The finite stellar distance, small nonparallel-ray effects and more complex surface geometry are not solved as a new correction method here.

Alternative methods and optional teaching improve choice; they do not prove enjoyment for every player. Larger comparative-method rewards and covariance-aware agreement checks remain SCI-12 discussion work rather than features silently added to this implementation.
