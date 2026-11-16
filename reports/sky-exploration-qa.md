# Sky discovery and exploration — SCI-01

Implemented and checked on 16 November 2026 (Asia/Dhaka). This delivers the agreed first-discovery flow and the request to make sky observation interesting; later science, story and campaign recommendations remain discussion items.

## Player experience

- Pan and zoom the real observer-frame sky using drag, pinch, wheel, keyboard or labeled buttons. The optional light list contains selectable lights actually visible in the current field, rather than a target finder through daylight, terrain or opaque weather.
- Compare neutrally coded lights without the target being placed first or named in advance. Brightness-variation symbols/text and qualitative tint descriptions complement the visual image. Labels are optional; the selected light has one label.
- Inspect selected catalogue stars in the telescope: they persist from the wide view rather than disappearing into an unrelated procedural background. Fainter background stars emerge with magnification, preserving a readable brightness hierarchy. The giant has a warm, banded image rather than the blue planet's continents. Relay visibility still depends on darkness, altitude and sunlight.
- Read factual image descriptions (point-like or resolved disk, brightness variation, position relative to the crosshair) and adjust the image manually. These descriptions do not print an angular diameter or an orbital solution.
- Keep personal notes and dated pointings in an optional notebook. Compare circles for one recorded light with squares for another, inspect either series with pointer or keyboard, and revisit the sky on another night. No complete orbit, interpolated trail or future ephemeris is supplied by the notebook.
- Identification remains possible immediately after inspecting a candidate: no journal, quota, delay or required sequence. Wrong candidates receive observational feedback without a new score penalty. The established identification unlocks remain.
- Stargazer/Cadet can open a comparison guide on request, subject to their effective guidance setting. Navigator/Astronomer/Legend do not receive that beginner method automatically. Free Roam's existing explicit guidance preference is respected. Every mode retains controls and descriptions of what is visible.
- Reduce visual twinkle independently of physical seeing. Text variation cues remain. The preference persists and is retained on return from practice.

## Measurement and state boundaries

The notebook stores the observer's current pointing against a fixed ecliptic chart, not the exact object direction. Its readout steps are 0.1° in wide view and 0.005° in the telescope; these are resolution steps, not total error estimates. Selection introduces an aiming offset and players can adjust it. The UI explicitly warns about centring, seeing, repeatability, chart versus compass coordinates, and simulated time/air consumption.

Pointing change is the spherical separation from each light's first recorded pointing. It handles longitude wrap. It is not signed displacement, a fitted orbital track or proof of planetary motion. Repeated readings at the same simulated instant are labeled as repeats without a time baseline. Fixed catalogue directions provide the reference frame; apparent planet motion uses the existing simulation.

Notes are per expedition, persisted with the save, restored with expedition snapshots, and reset for a new expedition. Isolated practice restores the original expedition notebook, including explicit empty defaults for older practice-return snapshots. Identical paused pointings with identical notes are not duplicated accidentally. Written notes are bounded to 240 characters.

Wide selection and identification recheck availability at action time. Telescope imagery is masked by the actual skyline and opaque weather. Catalogue stars are unavailable in a bright telescope field; notebook logging requires a dark enough reference-star field. Flare/cloud checks were also added to the existing year and micrometer observation actions touched here. This does **not** settle SCI-22's broader cross-instrument availability work.

## Verification

- `npm test`: **109 tests passed in 24 files**. Added coverage for stable unique neutral codes, actual field/terrain/daylight filtering, opaque-weather input, changing planetary versus fixed catalogue directions, finite/resolution-bounded sightings, spherical wrap, measured-only plots, practice restoration and legacy snapshot defaults.
- `npm run build`: TypeScript and production build passed. The pre-existing bundle-size warning remains.
- `python scripts/check_sky.py`: Chromium at 390 × 844 (DPR 2) and 1440 × 900. Uses ordinary pan/select/zoom/nudge/log/identify controls after a fixture selects the observing night and bypasses opening story. Checks comparison guide availability, optional labels, twinkle preference, star image continuity, wrong classification, observations twenty simulated days apart, comparison glyphs/keyboard inspection, reload persistence, no notebook requirement in Legend, distinct giant imagery, opaque weather and daytime selectable lights. Screenshots: `/tmp/stranded-sky`.
- `python scripts/check_estimation.py`: estimation workshops, rendered mathematics, actual pendulum/star prediction flows, persistence, optional Basic Training and expedition restoration. The regression script now waits for the next automatically opened lesson before closing it, avoiding a render-effect race in its exit sequence.
- `python scripts/check_environment.py`: windscreen, refraction, seeing, frozen rover frames and flare gates at both widths.
- `python scripts/check_school.py`: Flight School library and practice restoration at both widths.

The tests set up deterministic expeditions and times; they do not represent a complete human playthrough or establish enjoyment for all players. Human testing should check whether a first-time player notices useful differences, enjoys returning to compare sightings, understands centring error, and finds the optional notebook worth using. Broader story integration, advanced optical experiments, observed trails and the dedicated science-tool discussions remain open.

Publication is verified through the repository's GitHub Pages deployment workflow. Local browser checks cover the changed UI; the public Pages URL is not directly browser-tested in this environment.
