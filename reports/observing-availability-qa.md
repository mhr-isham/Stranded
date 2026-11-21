# Consistent observing conditions without compulsory instruction

Date: 21 November 2026 (Asia/Dhaka). Decision: SCI-22 in [GAME-REVIEW](../docs/GAME-REVIEW.md).

## Result and player interface

Live optical observations now share weather, daylight, altitude, reference-field and field-position checks through `src/game/observing.ts`. Instrument-specific requirements remain explicit. A small status line gives one reason when a view is blocked; the remaining requirements and current angles are available under closed-by-default **View details**. There is no new mandatory lesson, warning dialog, checklist, automatic waiting action or added resource/score charge.

Rough seeing is a quality condition, not an automatic rejection. Usable observations remain recordable, with available seeing metadata retained. Clouds and flare glare block new optical observations. Already recorded charts, kept values and frozen exposure pairs remain accessible during a blocked live view.

The same factual conditions apply in all modes. Independent modes do not receive new unsolicited correctness judgments, automatic numerical corrections or future observing forecasts. The details describe the current instrument and the current view. Existing mode-specific hints, paid checks, scoring, manual-flight rules and the 49-module Flight School library keep their own contracts.

## Shared rules and deliberate differences

| Method | Conditions |
|---|---|
| Target and moon tracker | Existing chapter limits: outer targets need Sun below −12° and target above 12°; inner targets need Sun below −6° and target above 8°. A usable reference field is required. |
| Giant and giant-moon tracker | Sun below −12°, giant above 12°, usable reference field. It now uses the shared flare/cloud decision too. |
| Simultaneous rover parallax | Both camp and rover are checked at the same instant. Existing target-specific Sun limits apply, with minimum object altitude 15° for outer targets and 10° for inner targets. A site-specific failure identifies Camp or Rover. |
| Nearby-star position scans | Sun below −12°, selected star above 15°, usable reference field, no blocking weather. This closes the former weather gap. |
| Micrometer | Identified target in the telescope field above the local landscape horizon, without cloud/flare blockage. A calibrated bright-disk measurement does not require a dark reference-star field, so a usable daytime/twilight disk is not rejected merely by applying the night tracker's rules. |
| Filtered year observation | Existing twilight-year model, Sun below 8° and above the actual local horizon, telescope pointed at the star. The nominal −1° lower window never overrides the horizon check. A solar filter is fitted; this method does not require an ordinary night reference field. |
| Locked-world reference angle | Reference-field and weather checks, without imposing a sunrise/sunset cycle that this camp does not have. New samples retain tracker provenance and seeing metadata. |
| Solar transit camera | Filtered observation with Sun above 3°, without cloud/flare blockage. Transit geometry remains a separate requirement for generating a sample. Daylight is permitted. |
| Wide/scope inspection and sky notebook | Existing field projection, visibility and local landscape checks remain. Notebook observations require an available reference field; inspecting a filtered star is separate from recording a night-sky note. |
| Noon-shadow instrument | Shared weather decision, retaining its existing two-station daylight/noon/geometry requirements and frozen-view workflow. |

The reference-field test uses the existing bright catalogue and wide-sky brightness model. It checks for a sufficiently bright catalogue star above a conservative horizon threshold, rather than assuming any timestamp proves that references are visible. It is a broad field-availability proxy, not a simulated per-exposure reference-star selection, full detector/SNR calculation or proof of accurate centring. Terrain and selected-object field checks remain explicit where the live instrument already models them.

Weather retains the established setting semantics: opaque cloud/dust episodes apply when survival is enabled; red-dwarf flare glare applies independently of the survival toggle. Seeing still follows the existing difficulty/challenge model. No extra random corruption or new weather effect is introduced.

## Recording-time correctness and retained evidence

The displayed status is a snapshot. Nearby-star scans, ordinary/locked year logs, micrometer readings and both rover cameras recheck the actual recording instant before accepting new data. A button rendered during a clear moment cannot record through a later obstruction just because React has not refreshed the button yet. Rover capture also rereads current deployment, arrival and site geometry.

Automatic target/moon/giant and solar-camera sampling uses the same policy for each sampled timestamp. Newly recorded automatic samples retain tracker provenance and available image quality. A blocked interval adds no fabricated observation and does not delete old samples. Invalid/nonfinite geometry produces an unavailable view rather than a usable-looking status.

Frozen rover image quality now comes from the exposure's recorded seeing factor. Changing today's challenge setting does not relabel yesterday's exposure. Missing historical quality is identified as missing, rather than reconstructed as if observed. Frozen images, their marks and derived readings remain independent of the current live obstruction.

## Rare transits and the existing alternate route

A direct transit is a rare event that can occur at night or behind clouds. A diagnostic using actual `world(...)` generation for five requested Cadet seeds (1, 6, 18, 22 and 316) found clear photographed event counts of 1, 2, 1, 1 and 3 respectively before nominal life-support expiry. These are sample cases, not a complete coverage proof. Counting raw `generateSystem(...)` candidates would be misleading because actual world creation may retry to a different solvable physical seed; the weather still follows the requested expedition seed.

The transit panel now has a closed optional alternate-method section that opens the existing planet tracker. Its elongation observations can support comparison of equivalent repeating features or candidate alignment brackets. The explanation distinguishes different alignment types and warns that a weather gap alone is not an alignment measurement.

While making that route reachable, the audit found that the inner tracker could save dates into `oppPicks` but then deliberately displayed an empty date list. This hid its date/period senders. The tracker now shows the saved candidate dates, uses the correct inner-planet plus sign in the period formula, and makes the normal manual uncertainty senders available. Dates remain player-chosen estimates; no hidden alignment date is supplied or automatically graded as correct. The transit panel also labels shared saved dates as alignment candidates. A fitted scatter estimate belongs to its selected photometric fit and is no longer automatically attached to an unrelated saved candidate.

A native regression for requested seed 22 records only one clear photographed transit event, while retaining tracker data on both sides of at least two model alignment epochs. The browser checks exercise the alternate route and candidate/send controls using labelled arbitrary cursor fixtures; those fixture picks do not claim physically accurate period estimates. This change does not guarantee that every transit is observable or certify a complete human expedition under every seed/resource strategy.

## Narrow-screen controls

Visual review with survival enabled caught a cramped phone header. At narrow widths, supply/readiness quick buttons use compact summaries while retaining their actions, accessible labels and full details. Numeric life support, time controls and the menu stay visible. Locked-world mobile time uses “dusk” while wider layouts retain “eternal dusk.” Supply warnings remain visible. This is a responsive presentation change, not removal of survival or readiness controls.

The new browser check verifies that visible header controls stay inside the viewport without overlapping, including the locked-world header. It also opens/resumes the expedition menu and opens/closes readiness details through the actual controls.

## Verification and limits

- **227 tests passed in 39 files.** Nine new numerical/stateful tests cover common weather priority across methods, usable rough seeing, filtered/bright-disk/locked-world differences, reference/field/altitude/window boundaries, invalid geometry, site-specific parallax, survival-off cloud semantics, real flare events, native automatic-record provenance, blocked solar-camera intervals and the rare-transit tracker alternative.
- `scripts/check_observing.py` passed at **390×844**, **1440×1000** and **844×390**, including high DPI and reduced motion. It checks one-reason feedback, initially closed details, cloud/altitude/daylight blocking, rough usable scans, recording-time races, solar/locked exceptions, both rover sites, frozen quality through challenge changes, reloads, alternate-route date controls, header bounds and access to menu/readiness details.
- Existing `check_year.py`, `check_parallax.py`, `check_micrometer.py`, `check_environment.py` and `check_sky.py` passed. They cover actual year practice/restoration, frozen-pair marking and persistence, micrometer controls/revisions/size interpretation, environmental mitigation/corrections and flare blocking, and sky discovery/notebook/mode behavior. The environment test's former bespoke flare wording was updated to the shared concise message while retaining its disabled-capture check.
- Production build and whitespace checks passed. The build retains its existing large-bundle advisory. Screenshots were inspected locally; the new browser checks report no page exceptions or horizontal document overflow.

The browser fixtures choose observation windows, bypass opening scenes and sometimes deploy equipment without charging travel. Native controls still perform the tested recordings. They verify data flow, constraints and layouts, not realistic aiming accuracy, long-term enjoyment or complete campaign solvability. The catalogue/brightness and seeing policies remain explicit simplified game models. Deployment is verified through GitHub Actions separately from local browser testing.
