# Micrometer controls and dated angular-size interpretation

Date: 17 November 2026. Decision: SCI-09 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Approved scope

Improve the physical feel and usability of the two micrometer wires, retain trustworthy observation guards, distinguish repeated adjustments from additional observations, and improve the existing Flight School size exercise. Teaching in ordinary gameplay remains optional. This work does not add a new required lesson, accuracy advantage or chapter gate.

## Instrument controls

The telescope now labels its wires A and B. Each has a handle and distinct colour; the selected wire is highlighted. Select A/B with the stage buttons or keyboard 1/2. Image Pan or keyboard 0 selects image motion. Left/right nudges the selected wire; Shift uses a ten-times finer adjustment. Up/down still aims the telescope. Plus/minus and the stage zoom buttons change magnification. The existing field slider and directional image controls remain available in the micrometer side panel, clear of the wire toolbar.

Selectable step sizes are 1, 0.1 and 0.01 arcseconds. These are control increments, not statements of optical accuracy. Wire positions are tangent-plane coordinates; the diameter is the difference of their angular positions. A keyboard adjustment changes the angle itself, and stops at the visible field boundary. Crossed A/B order still yields a positive separation; nearly coincident wires cannot produce a valid diameter.

Pointer selection chooses the nearer wire inside a 24-CSS-pixel hit area, scaled correctly for high-DPI canvases. A tie respects the selected wire. The drag preserves the initial offset between finger/cursor and wire rather than jumping the wire onto the finger. Explicit Pan mode moves the image without moving the wires. Pointer cancellation and window blur release a drag; additional simultaneous pointers do not replace the active drag.

The digital readout refreshes while the game is paused. This fixes the old reliance on changing simulation time to update a ref-backed instrument display. Zooming changes the image scale while preserving angular wire positions. Small detent cues use the existing effect mix; music and volume controls retain their behavior.

Phone, desktop and short-landscape layouts keep wire controls beside the image. The compact size guide docks away from the toolbar; its interpretation shortcut can scroll to the optional panel and minimise the guide.

## Trustworthy observation records

Logging requires an identified target in telescope mode, inside the current field, above the local skyline and unobscured. Both the latest rendered sighting and current observing conditions must be usable. The existing below-horizon and overlapping-wire guards remain. Nonfinite angles and wires outside the visible field are rejected.

The reading stores its visible live sighting date and seeing conditions, wire positions, field, chosen step, image sample time and revision count. This is a live-view measurement, not a newly introduced frozen-photo mode. Older readings retain their original values; missing historical wire information is not fabricated.

A sighting is identified by run and simulation observation time. Logging again at the same paused time revises that sighting's reading instead of increasing the sample count. Resume/advance time for another dated sighting. A new timestamp does not prove statistical independence: closely spaced observations can still share blur, limb judgement and alignment errors. The optional methods text makes this distinction explicit, and captured conditions remain with the reading after the sky changes.

Revising a reading clears a previously saved size interpretation, since it was calculated from the old angle. The player can save a fresh interpretation. The Flight School ECHO helper remains labelled as supplied data and advances a repeated practice observation by 60 seconds rather than manufacturing several nominal sightings at one paused time. It does not invent manual wire positions.

## Optional Flight School improvements

### Existing Angular Size lesson

The existing lesson now offers a teaching experiment with distance, angular diameter and their separate stated uncertainties. Doubling distance while keeping the apparent disk fixed doubles inferred physical radius; the diagram changes its distance and planet size accordingly. The image angles are explicitly exaggerated.

The calculation uses the exact radius relation and first-order independent-input uncertainty. Distance and angular contributions combine in quadrature. Their displayed shares are shares of estimated variance, not percentages to add directly to the radius. Seeing and shared judgement errors may require additional allowances.

Players can keep up to four hypothetical calculations. Only explicit lesson completion archives them on the ordinary first/latest discovery cards. These records identify their teaching source, never enter the expedition measurement log and do not consume fuel or change expedition time. Formula visibility follows the existing preference. No new module is added: the library remains at 48 modules.

### Existing focused size exercise

The optional interpretation panel uses a kept diameter sighting and the player's entered angular uncertainty. The orbit model transports the player's distance anchor to the selected diameter date; an earlier parallax separation is not silently reused as the current separation. It shows inferred radius, combined uncertainty and separate model-input/angular contributions.

The focused size exercise now supplies its labelled orbital prerequisites, including synodic period and opposition date, so this calculation can be explored immediately. Basic Training can return after its own model is ready. Missing inputs produce a clear explanation instead of invented orbital values. An undated distance anchor retains the existing disclosed alignment-date assumption.

A practice-only “Next sighting (+60 s)” control advances and pauses the isolated exercise. It does not promise a clearer or independent image, and normal observing gates remain. Students place the wires and keep dated observations themselves.

Saving the optional interpretation records the student's angle/range, dated model separation, radius and uncertainty contributions with that sighting. The size exercise discovery card can archive this work. It is a souvenir of the player's calculation, not an accuracy verdict against hidden truth. Sending the diameter and completing practice do not require using this panel.

Returning from practice restores the original expedition, clock and measurements while retaining normal cosmetic recognition. The existing first-completion patch, help labels, scoring and resource policies remain in effect.

## Verification

- `npm test -- --testTimeout=120000`: 175 tests in 33 files passed.
- `npm run build`: TypeScript and production build passed; the existing main-bundle size advisory remains.
- New numerical tests cover angular conversion of tangent-plane wires, order independence, angular nudging and field limits, nearest-wire/tie/high-DPI selection, distance/radius scaling, first derivatives and quadrature, invalid inputs, dated model transport player-input dependence and labelled ECHO practice epochs without invented wire data. A discovery-card test checks that the student's saved size interpretation and contributions are archived without an accuracy verdict.
- `python scripts/check_micrometer.py`: 390 × 844 high-DPI phone, 1440 × 900 desktop and 844 × 390 landscape controls. It checks keyboard selection/fine adjustment, a touch-area grab 20 CSS pixels away from a wire without a jump, Pan mode, zoom, zero-gap rejection, paused revision of one sighting, new dated sightings, saved conditions, horizon blocking and reload persistence. Phone/desktop cases complete the real size course, keep teaching examples, compare doubled distance, save/clear/re-save a size interpretation, submit angular uncertainty, finish and restore the original expedition. The resulting teaching and exercise cards persist.
- `python scripts/check_sky.py` and `python scripts/check_environment.py`: regression checks for the existing sky controls and environmental acquisition behavior.
- `git diff --check`: whitespace validation.

Browser checks require no runtime errors. Screenshots are written to `/tmp/stranded-micrometer` and the existing regression-check directories. Observing-window/time fixtures make checks deterministic; native controls manipulate wires and perform logging, interpretation, sending and completion. Control/metadata checks do not certify that an automated wire placement accurately locates a blurred physical limb.

Browser work found overlapping old/new stage controls, a stale readout while paused and a compact desktop guide covering the toolbar. The layouts and paused readout were corrected and exercised again. Short-landscape mode also moves the view selector into the micrometer side panel so it cannot cover the wire toolbar.

## Limits

This iteration conservatively merges revisions at the same simulation epoch; it does not infer the seeing correlation time or certify independence from timestamps. Separate closely spaced live sights can remain correlated. The main angle sender still supports a local average of compatible kept readings with a representative date; widely separated apparent sizes should not be treated as scatter around one fixed disk.

Uncertainty propagation is first-order and assumes independent entered model inputs. It does not calibrate shared limb/alignment biases or validate the model against hidden truth. Fine control increments do not override seeing. Covariance-aware multi-session fitting, nonspherical limb models and future moon-fit refinements remain separate work. No backend service is required. Local browser verification and GitHub Pages deployment are separate checks.
