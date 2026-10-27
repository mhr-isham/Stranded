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

**Ways to play:** a nine-chapter **Campaign** with a story, a **Single expedition** to a random system, and **Free Roam** (no clock, no score; optionally show the true values). Five modes run from **Stargazer** (gentle, fully coached) to **Legend** (no formula sheet, no safety net). The **Flight School** teaches every method, and each chapter's new idea has an optional module.

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

The design review and build plan are in [`docs/PLAN.md`](docs/PLAN.md). The current design (modes, chapters, story, flight) is [`docs/DESIGN-V2.md`](docs/DESIGN-V2.md), with the camp, rover, ship and fuel redesigned in [`docs/DESIGN-V3.md`](docs/DESIGN-V3.md); the engagement research is in [`docs/ENGAGEMENT.md`](docs/ENGAGEMENT.md) and [`docs/ENGAGEMENT-DEEP-DIVE.md`](docs/ENGAGEMENT-DEEP-DIVE.md).
