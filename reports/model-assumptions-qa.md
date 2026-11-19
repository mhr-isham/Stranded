# Orbital reference checks and understandable model assumptions

Date: 19 November 2026 (Asia/Dhaka). Decision: SCI-17 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved scope and findings

Preserve the working inference and flight mathematics; add missing real-system reference checks; make the active model and approximations easy to inspect; improve relevant Flight School visuals without duplicating lessons or requiring additional study before play.

The repository already had generated-system solve-chain tests across chapter variants, a real Mars/Earth chapter, an Earth–Mars Hohmann time check and propagation/Lambert tests. The dated-distance work also already distinguished circular, inner, elliptical and giant geometry. The missing reference coverage was a named Earth–Venus case and a compact set of independent numerical anchors spanning inference, transfer direction and capture. The existing planner did not have a concise player-model summary that separated Hohmann reference numbers from the chosen dated transfer.

This change does not modify engine algorithms, constants, generation, scoring, resource rules, required measurements or flight controls. It adds reference tests and player-facing explanations/teaching controls.

## Reference checks

The new tests use rounded mean Solar System inputs rather than only checking a procedural solver against its own generated truth. Earth–Mars exercises the outer sign; Earth–Venus exercises the inner sign. The inputs include Earth's sidereal orbital year, each target's synodic interval, circularized conjunction/opposition separation, angular radius and Earth's surface gravity/radius.

The chain checks target year, orbital ratio, home and target orbit scale, stellar mass, home mass and target radius. A Phobos orbit supplies a separate Mars moon-mass anchor. No fictional moon is assigned to Venus; its orbital inference is checked without requiring a moon-derived mass.

The transfer checks use a direct reference solar gravitational parameter, so they do not silently use the engine's rounded G times solar mass as both implementation and reference. Earth–Mars gives about 258.866 days, +2.945 km/s departure excess and 2.649 km/s arrival excess magnitude. Earth–Venus gives about 146.075 days, −2.495 km/s departure excess and 2.707 km/s arrival excess magnitude. The analytical helper's signed arrival convention is also checked. These are circularized reference cases, not dated ephemeris predictions.

Capture checks use independent planetary gravitational parameters and a parking radius of 1.3 target radii: about 2.026 km/s for the Mars case and 3.056 km/s for Venus. The planner cases check the outgoing/incoming prograde direction, small radial excess at a Hohmann alignment and propagation to the model's predicted endpoint. A separate eccentric target case propagates a planned Lambert trajectory to its fitted dated endpoint and verifies that the corresponding reference circle would put the target elsewhere, even though both share the same semi-major-axis Hohmann time scale.

The reference tolerances account for rounded input data, the existing constants and the deliberately simplified two-body models. They are intended to catch sign, unit, frame and endpoint mistakes, not assert high-precision celestial ephemerides or validate atmospheric flight from one analytical example.

## Planner: name the model, explain on request

A compact “Model in use” card appears when the launch planner can build a player model. It distinguishes a circular home/outer or inner target, a fitted target orbit, and the two-leg giant-flyby route. Its detailed assumptions are closed by default.

The card receives the player's model as a parameter and does not read the generated target's true eccentricity. A fitted eccentricity of zero remains identified as a fitted model family, with the explanation that zero reduces that orbit to a circle. This matters when the player's fit disagrees with the hidden physical system.

Requested details explain that home follows a circular orbit; heliocentric paths are planar; a fitted target uses the period, eccentricity and perihelion direction entered on the sheet; circular inner/outer targets use the corresponding relative-period sign; and the giant route has its own alignment clock and mass estimate.

The date-specific trajectory uses a prograde, zero-revolution Lambert solution around the star. The giant route joins two such legs with a patched-conic encounter. Planetary escape and capture are separate approximations. Hohmann time/alignment are circular, coplanar references and become search-scale estimates for an elliptical target. They do not replace its fitted positions or certify the measurements. Inclined/multi-revolution transfers and a full simultaneous many-body trajectory remain outside the current planner.

The main card is factual model context rather than an unsolicited correctness verdict. Its explanation is optional in independent modes too. Missing worksheet inputs still use the existing incomplete-planner flow, without fabricating an active numerical model. Existing dated-distance context and node-specific model notes remain in place.

## Existing Flight School lessons

### Synodic period

The existing lesson now lets players choose an inner or outer target and compare Earth–Mars and Earth–Venus teaching cases. The diagram's orbit-size ratio follows the teaching periods through Kepler's law. Home and target are identified with both color and text.

Inner cases explain that the faster target laps home and use the plus sign when recovering the target's orbital rate. Outer cases explain that home laps the slower target and use the minus sign. The repeating interval is positive in both cases. Dynamic period-control bounds keep the chosen target on the correct side of home and avoid zero relative rate.

The reference buttons use rounded mean periods, explicitly labelled as circular teaching orbits rather than real-time ephemerides. Optional model text explains why successive alignments in an ellipse can be uneven and why one interval need not establish its mean year. This builds on the existing dated-distance and fitted-orbit lessons.

Players can pause the visible animation and replay from alignment. Reduced-motion preference starts it still. Paused controls can inspect or change a teaching case without advancing the expedition clock. The rounded reference cases return approximately 779.94 days for Earth–Mars and 583.92 days for Earth–Venus.

### Ellipses

An optional checkbox overlays a star-centered circular reference with the same semi-major axis and orbital period. A gold outline marker shows its position at the same elapsed fraction of the year as the blue ellipse marker. At zero eccentricity they coincide; when eccentricity changes they can predict different positions without changing the year. The overlay is a comparison of hypothetical models, not two measured observations or a hidden-truth check.

The pre-existing speed readout was normalized to circular speed at the semi-major axis but labelled “average.” The label now states its actual normalization. The numerical simulation and equal-area construction are retained.

### Hohmann transfer

The existing demonstration and controls remain. The key idea now describes the circular, coplanar two-burn transfer without claiming that it is the global cheapest route for every possible pair of orbits. Optional text connects it to the existing Ellipses lesson and explains why the planner's dated Lambert solution is distinct from a Hohmann reference estimate.

These are enhancements to existing modules. The library remains at 49 modules, with normal explicit lesson-completion recognition. No additional lesson, prediction, chapter gate, mandatory calculation or new accuracy reward is added. The teaching views do not change expedition measurements, worksheet values or time.

## Verification

- `npm test -- --testTimeout=120000`: 207 tests in 37 files passed, including seven new reference tests.
- `npm run build`: TypeScript and production build passed. The existing main-bundle size advisory remains.
- `python scripts/check_model_notes.py`: 390 × 844 high-DPI phone, 1440 × 1000 desktop and 844 × 390 landscape. Native controls open the existing lessons; select both Earth-reference cases; verify the corresponding signs and finite synodic intervals; exercise pause/replay/reduced-motion and keyboard period bounds; compare coincident/divergent circle/ellipse positions; open Hohmann assumptions; and finish the lessons without changing the original worksheet, observations or clock. Planner fixtures cover outer, inner and fitted-zero-eccentricity models, with closed default details, no forced lesson/formula overlay, readable bounds and the existing incomplete-sheet state. The zero-eccentricity fixture deliberately differs from the generated ellipse to check that the card describes the entered model. No runtime errors are permitted.
- `python scripts/check_school.py`: 49-module library, search/filtering, view/skip/complete/repeat, assistance, recommendations and safe expedition return passed.
- `python scripts/check_distance_scale.py`: existing dated observation selection, worksheet date editing, model diagrams, departure-date independence, inner/outer teaching comparisons, uncertainty feedback, formula preferences and archived first/latest artifacts passed.
- `git diff --check`: whitespace validation.

Screenshots are stored locally in `/tmp/stranded-model-notes`. Planner browser fixtures supply complete worksheet inputs; they are not evidence of manual observation accuracy. Local browser checks and the GitHub Pages deployment workflow are separate verification steps.

## Limits

The numerical anchors validate the specified circularized cases and a fitted-ellipse endpoint, not every possible parameter combination or every future physics extension. The giant-flyby model description reflects the existing engine architecture; this UI iteration does not revalidate every slingshot trajectory.

The engine's established two-body/planar, circular-home and patched-conic approximations remain. The visual lesson cases are explanatory models, not a high-precision Solar System simulator. No full covariance treatment or calibrated success-probability claim is added; those remain SCI-18 discussion work.
