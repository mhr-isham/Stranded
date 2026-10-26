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
  system.ts     seeded system generator
  orbits.ts     Kepler propagation, Lambert solver, Hohmann
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
2. **Competent noisy play.** It reports the median error for each quantity, how often the truth falls inside the stated 1σ and 2σ, and the outcome rates. With the solver's skill level, the success rate is 100% on Cadet, about 95% on Navigator and about 83% on Astronomer.

`npm test` runs the unit tests, which check the orbital mechanics, generator determinism, chain recovery, error propagation and scoring.

The design review and build plan are in [`docs/PLAN.md`](docs/PLAN.md).
