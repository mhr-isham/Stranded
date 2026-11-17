# Stranded

*An astro-navigation game.* Your ship has crashed in an unknown star system. You have no star catalogue, no radio and a fixed amount of fuel. Measure the system with hand-operated tools, write down every number with an honest error bar, and plot a course to the blue planet before life support runs out.

Every measurement error comes from how you use the tools (reaction time, aiming, reading a scale), not from random noise added by the game. Every system is generated fresh, and an automatic solver checks that it can be solved before you see it.

## Play

**Live:** https://mhr-isham.github.io/Stranded/

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (works from any sub-path)
```

It runs as a single web page on phones and laptops, with no sign-in. Progress is saved in the browser. To give friends the same system, share its **seed** (☰ menu), or use **Daily system**.

**Ways to play:** a nine-chapter **Campaign** with a story, a **Single expedition** with random/daily/entered seeds and variations unlocked by completed Campaign chapters, and **Free Roam** (direct camp entry, every system type available, no deadline or score; optional guidance, truth overlay and landing practice). Five modes run from **Stargazer** (gentle, fully coached) to **Legend** (no formula sheet, no measurement warnings). New Astronomer and Legend runs require manual ascent and destination landing; ECHO rescue preserves the journey as assisted and unscored. **Flight School** groups 24 interactive lessons, 14 guided exercises, seven repeatable estimation workshops and two flight drills by skill. Estimation practice covers trends, interpolation, ratios, event bounds, travel times, repeated measurements and parallax uncertainty; two guided exercises compare predictions with your own new pendulum/star readings. All modules are optional and open, with saved completion/skip status and chapter recommendations. Basic Training and individual exercises preserve your current expedition. Chapter lessons also remain in the Codex. Flight controls support keyboard and simultaneous touch, pause, sensitivity adjustment and reduced camera motion.

**ECHO paid checks:** review your own evidence or verify an entered range against ship sensors. Each costs 40 m/s of flight reserve and shares the mode allowance: unlimited in Stargazer, five in Cadet, two in Navigator, none in Astronomer/Legend. Evidence reviews never consult hidden truth; sensor checks explicitly do. Saved results identify the checked entry and stale snapshots. Verification uses and costs persist through checkpoints and rewinds. Paid hint levels cost 25 base points each; unlocked hints and their costs also persist through loads/rewinds within the expedition, with no charge to read an unlocked hint again. Stargazer hints remain free. Basic calculations remain free.

**Measurement conditions:** fit a pendulum windscreen in any mode, recheck the horizon after damp spells, or apply a justified refraction estimate with uncertainty. New horizon readings retain original angles and corrected results; easier-mode ECHO assistance is labeled. The progress sheet includes shared correction uncertainty, and telescope/camera notes distinguish independent observations from repeated marks on frozen images. Persistent thick-air refraction still supports the alternative noon-shadow experiment.

**Audio:** an original electronic score changes arrangement for exploration, precision tools, flight and endings. Mechanical tool cues, discovery flourishes and thrust-responsive ship audio give actions distinct feedback. Music starts after a click or key press; adjust **Music** and **Sound effects** separately in setup or the ☰ menu. Both preferences are saved. Audio pauses in the background. All music and effects are synthesized locally, with no streaming or audio downloads.

Instruments also have physical sound: metallic pendulum hardware, wind and angle-tool detents on the hill, a telescope adjustment servo, rover motor/gravel and scanner pings, a wooden gnomon tap and probe/rover radio cues. Moving mechanisms respond to actual instrument motion and become silent when stopped or left behind.

Tool formula panels, progress-sheet equations and lesson formula blocks use locally bundled KaTeX typography with semantic MathML: proper fractions, roots, powers and subscripts. Long equations scroll inside their own panel on narrow screens.

## The campaign

| # | Chapter | What changes | New method |
|---|---|---|---|
| 1 | First Light | — | The whole chain below |
| 2 | The Silent Planet | The blue planet has no moon | Weigh it with a probe flyby (Doppler) |
| 3 | Thick Air | Refraction fools the horizon | Noon shadows at two sites (Eratosthenes) |
| 4 | The Long Ellipse | The orbit is an ellipse; oppositions are uneven | Kepler's method: fit the orbit to nightly sight lines |
| 5 | Inward | An inner planet: no oppositions | Transits and greatest elongation |
| 6 | Red Dwarf | A tidally locked world: no day, no night, flares | The year from the turning sky |
| 7 | Slingshot | The target is too far for the fuel | A gravity assist past a giant you weigh by its moon |
| 8 | Lost Among Stars | Where are *we*? | Stellar parallax of three stars, and a navigation fix |
| 9 | Home | The real Solar System, Mars to Earth | Your values against NASA's |

Harder modes add real **anomalies** (wind on the pendulum, humid air at the horizon, rough seeing): consistent effects a careful observer can spot, with a "Sharp Eye" bonus for leaving affected readings out. Astronomer and Legend also unlock optional **challenges** (a worn stopwatch, fitting by hand, short supplies…). When a fit is ambiguous (period aliasing), both models are shown, with the night that will decide between them.

## The solve chain

| You measure | With | Gives |
|---|---|---|
| Pendulum period T, length L | Pendulum rig, stopwatch, scale | g = 4π²L/T² |
| Horizon dip θ from height h | The hill, theodolite | R₁ = h·cosθ/(1−cosθ) |
| The star's daily drift against the stars | Observatory (at twilight) | year P₁ = 360°/drift |
| Two oppositions (middle of each retrograde loop) | Tracker | synodic period S, date t₀ |
| Parallax p over a baseline B | Rover plus a blink comparator | distance d = B/p |
| Angular diameter α₂ | Telescope micrometer | R₂ = d·tan(α₂/2) |
| The moon's greatest elongation and period | Moon tracker plus a sine fit | M₂ = 4π²aₘ³/(GPₘ²) |

ECHO, the ship's AI, works out the rest with full error propagation:

- M₁ = gR₁²/G
- 1/P₂ = 1/P₁ − 1/S
- a₂/a₁ = (P₂/P₁)^⅔
- a₁ from d (law of cosines at the time of each reading)
- M★ = 4π²a₁³/(GP₁²)

You then plan the launch in the **launch planner**. It shows a porkchop cost map and an orrery, and forecasts your chance of success by running your plan in many versions of the system that fit your error bars. The flight itself uses the *true* system:

1. Ascent guidance hits your planned escape velocity, and the true surface-to-escape Δv is charged.
2. ECHO makes one course correction at mid-course, aimed at the real planet.
3. The ship brakes into a parking orbit at 1.3 R₂.

Bad numbers turn into extra correction fuel. If the corrections use up the margin, the ship misses.

**Scoring** uses a Gaussian log score: a tight error bar that misses the truth scores *below* a wide one that contains it.

**Survival mode** is an optional toggle. It adds oxygen, food and power, dust storms that black out the sky, micrometeorite leaks, salvage from the wreck, and tool upgrades (tripod, vernier scale, solar panels, O₂ recycler, greenhouse, rover battery).

## Code map

```
src/engine/   pure TypeScript physics, no DOM (unit-tested)
  system.ts     seeded system generator (every chapter's system)
  chapters.ts   what each chapter changes in the system
  ephemeris.ts  planet positions (circles and Kepler ellipses), oppositions
  orbits.ts     Kepler propagation, Lambert solver, Hohmann
  windows.ts    launch windows found from the real transfer cost
  orbitfit.ts   Kepler's method: an orbit from directions alone
  flyby.ts      gravity assists (patched conics, powered flybys)
  nearstars.ts  stellar parallax and the navigation catalogue
  flares.ts     red-dwarf flares (a Poisson process)
  descent.ts / ascent.ts / probe.ts / relay.ts   flight phases, probe, relay satellite
  sky.ts        observer geometry, star catalogue, Milky Way
  measure.ts    what each instrument truly sees
  chain.ts      solve chain + error propagation + truth values
  planner.ts    launch planning from the player's model
  launch.ts     flight simulation through the true system
  solver.ts     automatic player used to prove solvability
  scoring.ts    log-score, grades
src/game/     state (zustand), clock and time warp, missions, ECHO, survival
src/render/   canvas renderers: sky, terrain, telescope, camp props
src/ui/       React screens and tools
scripts/validate.ts   validation report → reports/validation.md
```

## Validation

`npm run validate -- 40` generates systems for each difficulty and lets the solver play them. The report covers two things:

1. **Known-value recovery.** With noise-free readings, every quantity comes back to within 0.1%. The only remaining difference is the real large-amplitude pendulum effect in g.
2. **Competent noisy play.** It reports the median error for each quantity, how often the truth falls inside the stated 1σ and 2σ, and the outcome rates. With the solver's skill level, the success rate is 100% on Cadet, about 95% on Navigator and about 83% on Astronomer. Every campaign chapter is checked too: the solver reaches orbit in 35–40 of 40 systems per chapter on Navigator.

`npm test` runs the unit tests, which check the orbital mechanics, generator determinism, chain recovery, error propagation and scoring.

For browser audio regression checks, start a fresh `npm run dev` server, install Python Playwright (`python -m pip install playwright` and `python -m playwright install chromium`), then run `python scripts/check_audio.py`. Use `--browser /path/to/chromium` if needed. The check renders the actual score/effects into WAV previews, verifies finite output and clipping headroom, and exercises audio controls, persistence, backgrounding and flight/landing. Previews and screenshots go to `/tmp/stranded-audio-check`. See [the audio QA report](reports/audio-qa.md) for the tested mix and scope.

The consolidated feature inventory, implementation assessment, story-integration proposals, engagement review and future hosting plan are in [the unified game review](docs/GAME-REVIEW.md). It is a discussion register, not an approved implementation specification. The [story bible](docs/STORY.md) is preserved as the narrative reference. Earlier planning documents remain available in Git history.

Sky-discovery browser checks: with the development server running, run `python scripts/check_sky.py`. This exercises neutral labels, telescope controls, recorded-sighting comparisons, persistence, weather/daylight gates and optional guidance at phone/desktop sizes. Screenshots go to `/tmp/stranded-sky`; see [sky exploration QA](reports/sky-exploration-qa.md).

Pendulum observation checks: run `python scripts/check_pendulum.py` against the development server. It covers manual timing, optional timing comparisons, Earth-relative gravity with player uncertainty, keyboard counting, clock states, reloads and formula preferences at phone/desktop sizes. See [pendulum QA](reports/pendulum-observation-qa.md).

Pendulum technique checks: run `python scripts/check_technique.py` against the development server. It times real twenty-swing and repeat-release observations, checks cosmetic milestone persistence and false-count rejection, and verifies ECHO labels at phone/desktop sizes. See [technique QA](reports/pendulum-technique-qa.md).

Hill observation checks: run `python scripts/check_hill.py` against the development server. It verifies previewed/charged travel times, arrival and cancellation, keyboard/touch/high-DPI aiming, bracing, equipment provenance and expert-mode behavior. See [hill QA](reports/hill-observation-qa.md).

Year investigation checks: run `python scripts/check_year.py` against the development server. It covers fit/baseline guards, date selection, manual-fit and formula restrictions, locked-world observations, interactive Flight School lessons and a complete native three-date practice exercise with expedition restoration. See [year QA](reports/year-observation-qa.md).
