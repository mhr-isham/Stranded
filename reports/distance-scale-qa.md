# Dated separation and orbital scale

Date: 17 November 2026. Decision: SCI-08 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Agreed behavior

The telescope measures separation from the observer to another body at an observation time. Orbital size describes a path around the star. Those quantities must remain distinct when the separation anchors the inferred system scale and the launch planner.

The approved changes make dates clear, add an optional diagram and provide an optional Flight School comparison at different orbital positions. As agreed during SCI-07, explanations do not become compulsory teaching during ordinary play. No new chapter, instrument or launch gate is introduced.

## Main-game changes

### Preserve a dated separation

The rover distance log retains each observation. Its sender now selects one kept positive finite distance with its own date, defaulting to the most recently logged kept observation. The player enters uncertainty for that selected observation. Switching selection resets the sender's uncertainty input for review.

Previously, averaging all kept distances and assigning their mean date could combine genuinely different planet separations into an invented measurement. The sender no longer does that. The Flight School ECHO sender follows the same selection rule. Existing logged and progress-sheet values are not rewritten automatically.

This iteration does not combine separate dated observations into a fitted common orbital scale. Selecting one observation is deliberate; a future combination would need to account for orbital motion, measurement uncertainty and covariance. Fixed-quantity averaging remains available as before.

### Dates along the calculation chain

Time-dependent distance/angle log rows and senders show observation days. Relevant progress-sheet panels show the distance anchor's date; the target-size and moon-size branches also identify the angular observation date. The launch planner retains a separate dated distance reference beside its departure controls.

The progress sheet has an optional observation-day field for time-dependent primary quantities. Editing a value preserves its existing date. Entering a known day updates that date; leaving the field blank keeps it unrecorded. Zero is a valid recorded day. Display badges use four decimal places, while the saved timestamp retains its precision.

Older or manually entered estimates without dates remain usable under the engine's existing fallback. The UI labels the date as unrecorded and states the opposition/conjunction assumption being used; it does not invent a recorded date. Giant observations identify the giant's opposition as the fallback. Choosing a later departure does not mutate any observation timestamp or measurement.

### Optional diagram from the player's model

A collapsed explanation on relevant progress-sheet nodes and in the planner shows the separation between home and the observed body, alongside their orbits around the star. It is calculated from the player's periods, alignment time and dated distance. It never consults hidden correct orbital dimensions to repair a model.

Circular cases distinguish instantaneous separation from orbit radius. Elliptical cases identify the semi-major axis and draw the fitted ellipse; the target's current distance from the star is not labelled as its semi-major axis. The giant scenario identifies the giant as the parallax anchor and keeps the blue target's separate orbit distinct. Missing/invalid orbital inputs produce an explanation of the needed inputs rather than a fabricated diagram.

Related progress-sheet descriptions and requested hints now distinguish inner conjunction geometry, fitted ellipses and giant-based scaling. Existing difficulty restrictions and hint costs still govern requested hints. Formula visibility continues to follow the player's preference.

## Optional Flight School investigation

“Changing distance, same orbit” is a separate, always-open lesson. Flight School now has 25 lessons, 14 guided exercises, seven estimation workshops and two flight drills: 48 modules. Campaign recommendations and existing required exercise steps are unchanged.

The lesson uses an explicitly hypothetical, coplanar circular system with a home orbit of 100 million km and either an outer target of 160 million km or an inner target of 60 million km. Teaching periods obey Kepler's ratio. Players can inspect opposition/conjunction, one-eighth of a synodic cycle and one-quarter of a cycle, or select a teaching day with the slider.

They can commit an expectation, keep up to six dated teaching observations and compare inferred orbit sizes. Ordinary observations show that changing separations recover the same scale when their dates are used. A deliberately 3%-high teaching reading demonstrates that an inferred scale can disagree without the physical orbit expanding. Feedback checks every kept observation, including an inconsistent middle point. Teaching comparisons acknowledge useful investigation rather than grading a prediction against hidden truth.

The chart separates orange measured teaching gaps from green inferred orbit sizes, and labels both. A diagram and rendered equations support the comparison. These teaching observations do not enter the expedition log, consume resources, change live time or reveal the current system's true dimensions. The lesson states its approximation and that real observing windows impose additional visibility requirements.

The lesson host now accepts an optional teaching artifact. Only explicit “Got it” completion archives it and awards the normal module patch. Closing the lesson without completion does not award that patch. Its discovery card identifies the hypothetical source, scenario, dated observations, optional committed expectation and compared result. Repeating it preserves the first card and updates the latest attempt. Teaching artifacts are labelled “Teaching investigation,” rather than being misidentified as a practice system matching the saved expedition seed. Existing lessons without artifacts retain their acknowledgement cards.

## Verification

- `npm test -- --testTimeout=120000`: 166 tests in 32 files passed.
- `npm run build`: TypeScript and production build passed; the existing large-main-bundle advisory remains.
- New numerical tests recover unchanged scales from outer/inner observations away from alignment, demonstrate the bias from dropping a later observation's date, exercise deliberately rough data, preserve selected reading dates through the ECHO sender, and distinguish unknown dates from recorded day zero.
- Generated-world checks cover chapters 1, 2, 4, 5, 6, 7 and 9 at two off-opposition epochs each. Independent dates are supplied for parallax, angular diameter and moon-angle observations. Derived home/target scales, stellar mass, target radius and mass are checked against physical fixtures within the existing model approximations. The model diagram agrees with its dated separation; planner construction/position evaluation preserves the input estimates.
- `python scripts/check_distance_scale.py`: phone (390 × 844, high DPI) and desktop (1440 × 900). Native controls choose/send distinct dated readings, edit and clear dates, reload unknown-date estimates, open the optional own-model diagram and change a departure control without changing saved observations. The lesson test covers incomplete close, outer/inner comparisons, an incorrect committed expectation, rough-reading feedback, formula preferences, explicit completion, first/latest teaching cards and reload persistence. It also checks that a square-root radical retains a real rendered height.
- `python scripts/check_parallax.py`: the existing native parallax course, predicted camera jump, persistent exposures, one reading per pair, distance sender, rewards and expedition restoration, plus phone/desktop/landscape comparator operation.
- `python scripts/check_school.py`: the 48-module registry, search/filtering, skip/view/complete/repeat, assisted exercise recognition, optional recommendations and title/live-expedition restoration.
- `git diff --check`: whitespace validation.

Browser tests require no runtime errors. Screenshots are written to `/tmp/stranded-distance-scale` and the existing parallax/school check directories. Fixture observations and complete planner inputs are testing aids; native controls perform the date selection, edits, departure change and lesson completion.

Visual inspection found an existing broad diagram-SVG style shrinking KaTeX's radical SVG inside lesson demos. Diagram sizing now excludes KaTeX SVGs, preserving the square-root glyph. The browser check verifies this rendered behavior in addition to formula parsing.

## Limits

The teaching model is circular and coplanar, and explicitly separated from live acquisition. Its fixed 2% teaching uncertainty and optional 3% offset are examples, not automatically assigned expedition uncertainties. The main diagram shows the player's model rather than validating its accuracy. Legacy missing-date estimates retain the engine's disclosed fallback until the player supplies a known date.

The engine's time-aware orbit conversion was already present and remains in use. This change improves provenance, selection and teaching around it. Full timestamp uncertainty propagation, combining multiple dated observations into one orbital fit, additional measurement methods and later moon/micrometer refinements remain separate work. No backend service is required. Local browser verification and GitHub Pages deployment confirmation are separate checks.
