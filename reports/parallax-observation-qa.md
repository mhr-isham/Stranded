# Parallax observations and optional Flight School geometry

Date: 17 November 2026. Decision: SCI-07 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Agreed scope

The user approved improved comparator controls, geometry practice and an optional prediction investigation, with one explicit refinement: geometry teaching belongs in Flight School and must not become compulsory teaching during ordinary gameplay.

The geometry model is therefore part of the optional parallax lesson. Players can access the lesson from Flight School or request it through the Codex. The main rover tool has a collapsed explanatory section. Capturing images, marking centres, keeping a reading and sending a distance never require opening that explanation, completing a lesson or making a prediction. The existing distance course can also finish without the extra investigation.

## Implemented behavior

### The synchronized comparator

Each capture freezes both camera directions, the angular disk radius, a common observation time, rover position, laser baseline, across-sightline baseline and seeing conditions. It begins on A with blinking stopped. Main-game time remains separate from the photographed instant.

The stage keeps A/B buttons and play/pause beside the image rather than requiring a trip down the side panel. Both camera badges show the same observation date. Blink speed can be 1.2, 0.7 or 0.35 seconds per frame. It is explicitly enabled by the player, and stops when the document is hidden. Background stars use the same reference pointing, seed and frozen rendering time in both frames.

A pointer press during blinking freezes the frame actually drawn and places its marker in that frame. This fixes the old mismatch between the displayed blink frame and the separate marking-frame selection. Dragging refines the marker. Keyboard 1/2 selects A/B, arrows move a marker by 1 arcsecond, Shift-arrows use 0.1 arcsecond, Enter marks the centre, and B toggles blinking. Keyboard markers stay within the displayed field. Those controls assist operation, not target finding: they do not snap to the planet or its true centre.

The field range extends from 30 to 1200 arcseconds. Changing the displayed field does not change saved angular markers. The photographed pair and marks survive screen changes, reloads and checkpoints; returning to the comparator starts on a static A view. The existing sky/flare/cloud restrictions still control acquisition. Capture checks visibility again at the actual click time, including rover arrival and both sites' sky conditions.

### Geometry and reading provenance

The distance readout uses the part of the laser baseline perpendicular to the camp camera pointing. The full straight-line laser distance remains visible; the distance driven along the surface is a separate travel quantity. Angular separation is computed from the two marked rays in the tangent-plane camera, rather than treating a screen displacement as an exact angle.

The displayed calculation is the distant-target approximation `d ≈ B⊥ / p`, with the angular shift in radians. Formula display follows the existing preference and uses the equation renderer. It is not an exact nearby-object triangulation formula or a hidden-truth check. Old saved readings retain their original values; they are not silently recalculated.

Kept readings include their capture identifier, both marks, full/projected baselines, marked angular separation and frozen conditions. Re-marking and keeping the same pair updates its existing reading instead of creating a second supposedly independent observation. The capture identifier is stable for the same run, time and rover position. Missing, coincident or nonfinite marks cannot produce an infinite distance reading. A large separation alone is no longer labelled proof of a mistake; nearby objects or long baselines can produce large shifts.

The Flight School ECHO measurement helper uses the projected baseline too, and remains explicitly labelled as ECHO-supplied rather than inventing manual camera marks.

### Flight School geometry experiment

A separate teaching model lets the player vary drive angle, laser baseline and a labelled hypothetical target distance. Buttons compare 0° toward, 30° diagonal and 90° sideways drives. A diagram highlights the sideways component. Numerical readouts and optional rendered formulas explain why a long drive toward a target supplies little angular parallax.

Players can keep four on-screen teaching comparisons. These are local lesson notes, not expedition measurements or a permanent experiment archive. The model states that its diagram is exaggerated, its values are hypothetical and its approximation assumes a distant target. It also explains why images must have identical timestamps and why re-marking a frozen exposure does not add independent data. No simulated resources, expedition observations or time are changed by the model.

### Optional prediction, recognition and records

Distance practice and Basic Training offer an optional prediction panel. After capturing A, commit a main screen direction before B has been viewed; then switch/blink and mark both centres. Ordinary comparator operation remains available if the player skips this. A pair already viewed from B cannot start a new prediction through that panel.

The comparison uses the player's marked displacement only, even when the prediction or marks disagree with the rendered target. Near-diagonal shifts are described by their larger screen component. Shifts smaller than the frozen image's 1.2-arcsecond × seeing-factor blur scale are inconclusive. This is an explicitly labelled teaching threshold, not a measured confidence interval or automatic uncertainty assignment.

The first comparison remains fixed if the player later edits a mark. Up to eight tested-pair records are retained in practice; the panel makes their projected baselines and marked shifts available for comparison. It cautions that target distance and observation time can also change the shift. The discovery card retains the investigation count, latest committed direction/comparison and projected baseline, alongside available kept-reading plots. Closing the camera pair does not discard the saved investigation record.

Testing a prediction earns the same cosmetic milestone whether it agrees or disagrees. Existing first-completion patches and assistance labels remain in effect. Practice restores the original expedition's camera pair, comparison history, measurements and clock while retaining profile recognition. No score, fuel, precision or verification allowance is added.

## Verification

- `npm test -- --testTimeout=120000`: 161 tests in 31 files passed. New cases cover oblique geometry that previously overestimated distance, degenerate baselines, angular marker conversion, invalid/coincident measurements, mark-only prediction comparison, immutable results, seeing thresholds, checkpoint/practice restoration and optional exercise completion. A reward test checks that closing a camera pair does not remove its investigation from the discovery card. The existing equation tests validate the new formula.
- `npm run build`: TypeScript and production build passed. The existing main-bundle size advisory remains.
- `python scripts/check_parallax.py`: tests 390 × 844 high-DPI phone, 1440 × 900 desktop and 844 × 390 landscape comparator controls. It uses optical fixtures to select an observing window and calculate rendered-centre click coordinates, while native UI performs capture, marking, blinking, keeping and updating. It checks a frozen common timestamp, zero-shift rejection, fine keyboard increments, visible-B marking during blinking, field-independent markers, reload persistence, projected distance, one reading per pair, and the absence of compulsory main-game teaching. Phone/desktop cases complete the actual distance course, optional geometry comparisons and committed prediction, then verify cosmetic records and complete expedition restoration. Automated centre-click checks allow 0.25% distance difference for finite browser pointer resolution; analytic geometry is tested separately.
- `python scripts/check_environment.py`: regression checks for frozen telescope conditions and rover flare/cloud acquisition gates, alongside the existing instrument-environment checks.
- `git diff --check`: whitespace validation.

Browser checks require no runtime errors. Screenshots are written to `/tmp/stranded-parallax` and `/tmp/stranded-environment`; the optical fixtures are testing aids, not player-visible automatic measurements. Local browser verification and the GitHub Pages deployment result are separate checks.

## Limits and later work

Prediction directions are screen directions, not automatically inferred orbital directions. The comparison deliberately does not certify measurement accuracy. Detailed baseline-orientation uncertainty and covariance across separate exposures remain further scientific work; this change prevents repeated marking of one identified pair from inflating its sample count. The main game still requires players to choose honest uncertainty when sending a distance.

The teaching model is optional and unscored. No backend, VPS or Cloudflare service is needed. This implementation does not change chapter progression, other distance methods or SCI-08's distinction between measured separation and orbital size.
