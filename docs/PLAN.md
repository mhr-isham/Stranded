# Stranded — Build Plan, Design Review & Feature Suggestions

Source: *Stranded: astro navigation game design* (8-page design doc).
Status: **first playable version built** (see README). Decisions taken:

| Question | Decision |
|---|---|
| Planets | 2: home planet and the blue outer target (with a moon). |
| Absolute distance scale | Two-site parallax of the blue planet against background stars (rover baseline, blink comparator). Distances read at any time are converted with the law of cosines, so measuring exactly at opposition is not required. Opposition is still the best time. |
| Survival layer | Built, behind a toggle at the start of each expedition. |
| Arrival | The fuel budget covers escape from the surface, one mid-course correction and capture into a parking orbit at 1.3 R₂. The heat shield handles the landing. This gives M₂ and R₂ a real job. |
| Art | Real sky physics rendered in a clean, stylised way: sky colours follow the star's altitude, stars twinkle, planets don't. |
| Platform | Single static web page (Vite + React + Canvas), phone and laptop, no sign-in, English. |
| Year length | Measured from the star's drift against the stars at twilight (faster than the analemma). |

---

## 1. One-paragraph summary of the design

A stranded astronomer lands by mistake in an unknown star system. No catalog, no radio, fixed fuel (Δv) and a fixed life-support clock. Using hand-operated, noisy tools (tracker + telescope, stopwatch, angle tool, pendulum, scale, ranging tool, parallax calculator) the player measures R1, g, M1, year length P1, synodic periods, an absolute distance scale (transit parallax), a1, M\*, R2, M2, then picks a Hohmann launch window and burn. Every value is entered with an error bar; scoring rewards *honest* error bars; consistency checks replace "right/wrong" marks. Each run is a freshly generated system that an automatic solver has proven solvable. Target: single web page, phone + laptop, no sign-in, for the MIT Maker Portfolio.

---

## 2. Issues found in the doc (physics + consistency)

These should be fixed before the generator is written, because they change the engine.

| # | Where | Problem | Suggested fix |
|---|---|---|---|
| 1 | Formula table, "outer planet period Pin" | The formula `1/Pin = 1/P1 + 1/S` is for an **inner** planet (the diagram correctly says "inner planet"). | Rename the row to "inner planet period". For planet 2 (outer) use `1/P2 = 1/P1 − 1/S2`. |
| 2 | "Orbit size a1" row | Table says `a1 = d / (aout/a1 − 1)`, diagram says `a1 = d / (1 − ratio)`. For an **inner-planet transit** d = a1 − ain, so `a1 = d / (1 − ain/a1)` (diagram is right). The table version is for an outer-planet closest approach (d = a2 − a1). | Keep both, labelled by route: transit → `d/(1−ain/a1)`; outer opposition → `d/(a2/a1−1)`. |
| 3 | "Planet separation at transit `d = B/p`" | During a transit the *background is the star's disk*, which is itself at distance a1 — not at infinity. The measured shift is `p = B(1/d − 1/a1)`, not `B/d`. (This is exactly the subtlety of the historical Venus-transit method.) | Either use the corrected formula (`p = B/d − B/a1`, combine with d = a1 − ain → solve for a1), or switch the default route (see #4). |
| 4 | Parallax calculator vs. solve chain | The tool row describes parallax of a planet against a **distant reference object with parallax 0** — that is *diurnal/two-site parallax against background stars*, a different route from the transit parallax in the solve chain. | **Recommendation:** make the default route *planet 2 at opposition vs background stars*. Then `d = B/p` is exactly right, d = a2 − a1, and you don't need a third (inner) planet. Keep transit parallax as an advanced/bonus route + consistency check. |
| 5 | Number of planets | Transit + inner-planet synodic period need a planet **inside** planet 1's orbit, plus planet 2 (blue, target) — that's **3 planets**. But the build order says "one star, two planets and one moon". | Decide (Q2). With #4's recommendation, 2 planets is enough. |
| 6 | Empty row in formula table (between M\* and R2) | Missing quantity — almost certainly **planet 2 orbit a2** (`a2 = a1·(P2/P1)^(2/3)`) and/or **P2**. Both are needed for the Hohmann formula. | Add rows: P2 from synodic S2, a2 from Kepler III. |
| 7 | Planet 2 mass M2 | Diagram says "angular sizes and moon orbit"; table says "rocky-planet density ratio". Also: M2 isn't used in the departure formula at all. | Use the **moon orbit** (Kepler III around planet 2) as primary, density as the moonless fallback. Give M2 a job: **arrival/capture burn** `Δv_arr = √(v_esc,2² + v∞,arr²) − …` (or orbit insertion), so the fuel budget covers both ends. |
| 8 | Planet 1 rotation | Doc says rotation is ignored, but the generator draws it — and the day/night cycle, analemma, Eratosthenes shadows and diurnal parallax all *need* rotation. | Keep rotation in the sky simulation; ignore it only in the launch Δv (or give it as a small bonus for equatorial eastward launch — a nice "aha"). |
| 9 | Year length from the analemma | With circular orbits the analemma shape comes only from axial tilt, and it needs a fixed clock-time observation every day for a whole year — slow and confusing. | Easier/faster routes: (a) noon-shadow / noon-altitude cycle (needs tilt), (b) **star's drift against background stars** measured at dusk/dawn: P1 = 360° ÷ (degrees per day). (b) gives a year estimate in ~a week of game time and improves with a longer baseline — which matches the doc's "long baselines shrink error" theme. |
| 10 | Life-support budget vs. synodic periods | P1 (a year), S (Earth–Venus ≈ 584 d, Earth–Mars ≈ 780 d) plus waiting for the window can exceed 2 game-years. | Generator must constrain: total "minimum needed time" + one synodic window < life support. Provide time warp (see §5). Prefer partial-arc methods so players aren't forced to watch a full period. |
| 11 | "Star radius from brightness and temperature" consistency check | No tool measures brightness or temperature. | Add a **photometer/spectroscope** (optional tool) or drop that check. |
| 12 | R2 = d2·α2/2 | d2 is the planet-planet distance *at the moment of measurement*, not a2. | Measure α2 at opposition (d2 = a2 − a1) or have the engine show the config. |
| 13 | "Leave early = faster transfer" | Non-Hohmann departures need a Lambert solver in the engine (the doc only gives Hohmann formulas). | Implement a small Lambert solver (universal variables, ~100 lines TS) or offer a discrete menu: "now / +N days / optimal window". |
| 14 | Pendulum "ask how many swings they counted" | The player can type any number; and amplitude affects T. | Let the player **tap each swing** (or count, then the game compares to the true count silently). Keep small-angle by limiting release angle; large release angle becomes a teachable error. |
| 15 | Page 7 | An empty 3×3 table — content missing from the doc. | Please send what was meant to be there (Q8). |
| 16 | Schedule | Doc's dates (Oct 18–31) are mostly past today (Oct 26). | Re-plan around the real deadline (Q1). |

Formulas I checked and agree with: `R1 ≈ 2h/θ²`, `R1 = d/Δφ`, `g = 4π²L/T²`, `M1 = gR1²/G`, Kepler ratio `(P/P1)^(2/3)`, `M* = 4π²a1³/(GP1²)`, Hohmann time `t = π√((a1+a2)³/(8GM*))`, lead angle `φ = 180° − 360°·t/P2`, `Δv_depart = √(v_esc² + v∞²)`, `v∞ = √(GM*/a1)(√(2a2/(a1+a2)) − 1)`, window repeat = synodic period `1/S12 = 1/P1 − 1/P2`. Error propagation remark (a³ → ~3× relative error) is correct.

---

## 3. Recommended answers to the doc's own open questions

| Doc question | Recommendation |
|---|---|
| Planet 2 always outer? | Yes for v1 (blue planet outer, so it shows retrograde and has oppositions). Inner target = a later "hard level". |
| Planet 2 always has a moon? | Yes in Normal; moonless = Hard (M2 by density). |
| Game days per real second / auto-logging? | **Player-controlled time warp** (pause, 1×, 1 h/s, 1 d/s, 10 d/s). Stopwatch error = reaction time × warp → teaches "slow down near events". Tracker **auto-logs** event times once the player chooses the event (as the doc says). |
| Transit parallax default, ranging easy-mode? | Default = opposition parallax vs background stars (§2 #4). Transit = advanced route. Ranging = Cadet/easy mode only. |
| Progress sheet: all at once or unlock? | **Unlock** — as a "constellation" map that lights up (§5.2). Locked nodes visible as silhouettes so players see the whole chain. |
| Single web page, phone + laptop, no sign-in? | Yes. Static site, local save (localStorage), shareable seeds. |

---

## 4. Build plan

### 4.1 Tech stack (proposed)

- **Vite + TypeScript**, deployed as a static site (GitHub Pages).
- **Engine** (`src/engine/`): pure TS, no DOM — orbital mechanics, sky model (positions of star/planets/moon/background stars from the observer's location + time), system generator, measurement noise model, solver, Lambert/Hohmann, scoring. Unit-tested with **Vitest**.
- **UI**: **React** for panels/HUD/progress sheet + **HTML Canvas 2D** (or PixiJS if we need more particles) for the sky, telescope, pendulum and orbit views. Framer Motion for UI transitions. Howler.js for sound.
- **Validator CLI** (`npm run validate`): generates N systems, runs the solver, writes a JSON/Markdown report (rejection rate, recovery accuracy per step). This is the "technical evidence" for the portfolio.
- Mobile-first layout; touch gestures for aiming tools.

### 4.2 Architecture

```
engine/
  constants.ts      G, units (SI internally, friendly units in UI)
  system.ts         Star, Planet, Moon types; generator(seed, difficulty)
  orbits.ts         circular coplanar positions at time t
  sky.ts            observer frame: alt/az of every body, day/night, twinkle flag
  tools/            pure measurement functions: (truth, player input) -> reading
  noise.ts          skill-based error: aim jitter, reading resolution, reaction delay
  solve.ts          bot player using only tool outputs (proves solvability)
  transfer.ts       Hohmann, lead angle, synodic, Lambert, flight sim
  scoring.ts        interval/log score for value ± error
  checks.ts         consistency checks (disagreement in σ)
game/
  state.ts          clock, life support, fuel, log, sheet, unlocks (save/load)
  missions.ts       mission tracker definitions
ui/
  hub, tools/*, sheet, launch, codex, results
```

### 4.3 Milestones (dates to be adjusted after Q1)

1. **M0 – Engine core:** generator + orbits + sky + transfer math, unit tests with Earth/Mars/Venus as known values.
2. **M1 – Solver & validator:** bot recovers every quantity; validation report. *Go/no-go gate.*
3. **M2 – Tools v1:** tracker/telescope with stopwatch & time warp, pendulum, angle tool (hill). Noise model.
4. **M3 – Progress sheet:** value ± error entry, auto-averaging log, unlocks, consistency checks, scoring.
5. **M4 – Distance scale + launch:** parallax tool, launch planner, flight simulation, outcomes.
6. **M5 – Story/tutorial/juice:** intro story, AI companion, mission tracker, sound, results screen.
7. **M6 – Playtest (BDOAA, NDMC, ROC):** telemetry (local JSON export: solve rate, time per step, where stuck), fix worst issues.
8. **M7 – Portfolio:** 1-minute video, 1-page technical doc with validation results.

Cut first if short on time (as in doc): hints, telescope mount detail, extra levels — plus, from my list, survival layer and achievements.

---

## 5. Gamification, fun & engagement suggestions

### 5.1 Story & companion
- **Ship AI companion** with damaged memory (think GLaDOS-lite / TARS). Delivers the intro, each tool tutorial, mission objectives and hints *in character*. Its memory banks "restore" as you measure things — e.g. after you get R1 it recovers a line of the ship log. Gives the hint system a personality.
- **Captain's log** that auto-writes entries from the player's actions ("Day 14: the bright dot near the horizon doesn't twinkle. A planet?").
- **Codex cards** unlocked per method with the real history: Eratosthenes (radius), Galileo (pendulum), Kepler (3rd law), Cook & the 1769 Venus transit (parallax), Hohmann (1925). Short, illustrated, collectible.
- **Multiple endings:** perfect arrival, arrival on fumes, flyby miss (with miss distance), can't escape gravity, life support runs out, plus a secret ending (e.g. arrive with >X% fuel and no hints).

### 5.2 Progress sheet as a "constellation" (signature UI)
- The solve chain is drawn as a **star map**: each quantity is a star, dependencies are constellation lines. Measuring lights a star; its **glow size = your error bar** (fuzzy = uncertain, sharp = precise). Finishing the chain "completes the constellation" — a very shareable visual.
- Inspired by Outer Wilds' *rumor map* ship log. Doubles as the mission tracker and checklist from the doc.
- **Obra Dinn–style batch confirmation** (optional alt to paid "is it correct?"): the AI confirms only when **3 entries** are simultaneously within their stated error. Keeps the hidden-grading spirit, adds a deduction thrill.

### 5.3 Making uncertainty visible and fun (core teaching hook)
- **Uncertainty cone on the launch screen:** draw 50–100 faint trajectories sampled from the player's error bars ("spaghetti plot"). Tight measurements → a laser-sharp bundle hitting planet 2; sloppy → a spray. Players *see* error propagation.
- **Error budget pie** on the launch and results screens: "62% of your margin went to the parallax."
- **Post-mortem replay** after any outcome: "If your parallax had been within 2%, you'd have arrived with 11% fuel."
- **Mid-course correction burns:** a fuel-for-error trade. Bad numbers aren't instant death — they cost fuel to fix in flight, which makes the fuel margin meaningful and the ending less binary.

### 5.4 Launch / Hohmann gamification
- **Orrery planner:** drag a time slider; planets move; a ghost Hohmann ellipse shows where you'd arrive. Lead angle φ shown as an arc that turns green in the window.
- **Launch-window countdown** on the HUD once φ is computed (KSP / transfer-window-planner feel).
- **Launch sequence mini-game:** pick departure day + burn; cinematic countdown; staging; flight animation with time compression; arrival / capture burn.
- **Gravity assist from the moon** as an advanced secret strategy (bonus).

### 5.5 Survival layer on the host planet (light, optional)
Adds pressure and reasons to manage time, without drowning the physics:
- **Resources:** O₂, food, power. Time warp burns them. Repairs/salvage cost time.
- **Weather:** cloudy nights block observation → plan observing sessions (a forecast panel). Makes "when to measure" a decision.
- **Salvage & crafting:** scavenge the wreck to **upgrade tools** — vernier scale for the angle tool (better resolution), tripod/steady mount (less jitter), better telescope lens (parallax needs it), a **drone/rover** to reach a second site for two-site parallax, a radio to unlock ranging. Each upgrade costs days of life support → genuine trade-off.
- **Events:** eclipses (bonus timing measurement), meteor showers (cosmetic + achievement), dust storms, a pendulum knocked over, solar flare forces shelter.
- **Greenhouse** mini-task to extend life support a little (risk/reward: buys days but costs work time).

### 5.6 Tools – extra / improved
- **Gnomon / sundial**: shadow angles → Eratosthenes route for R1 (second route = free consistency check) and day length.
- **Tracker trail mode:** the planet leaves a trail against background stars so the **retrograde loop** draws itself — beautiful and educational.
- **Twinkle test:** zoom in, watch scintillation; tagging a planet correctly is the first "aha" mission.
- **Photometer/spectroscope** (optional): star temperature (Wien) + brightness → star radius check (fixes §2 #11).
- **Pendulum:** tap-per-swing counting, adjustable length with the scale, visible amplitude; a "20 swings" streak indicator.
- **Hill climb** for horizon dip: choose height (climbing costs time/O₂), aim at horizon with steady-hand wobble (tilt/gyro on phone!).

### 5.7 Progression, replay & social
- **Difficulty tiers:** Cadet (ranging tool, formula sheet on, generous life support), Navigator (default), Astronomer (moonless planet 2, transit route, no hints), Ironman (one launch, no consistency checks).
- **Rank / grade:** S/A/B/C per run with breakdown: accuracy, honesty (calibration), fuel left, days used, hints used.
- **Achievements** (examples): *Eratosthenes* (R1 within 1%), *Tycho* (10+ repeat readings), *Honest Navigator* (every true value inside your error bars), *Lean Burn* (≥20% fuel left), *No Help Needed*, *Speedrun* (launch before day X), *Retrograde Witness*.
- **Seeds:** "System #4821" — share a seed so friends play the identical system. **Daily system** (same seed for everyone each day).
- **Wordle-style share card** (no sign-in): emoji grid of accuracy per quantity + grade + fuel left. Great for spreading playtests at BDOAA/NDMC/ROC.
- **Local leaderboard / personal bests** in localStorage.

### 5.8 UI / look & feel (inspirations)
- **Outer Wilds** – ship log/rumor map; cozy discovery tone.
- **Kerbal Space Program** – time warp control, maneuver planning, orbit view.
- **Return of the Obra Dinn** – deduction ledger with batch confirmation.
- **Subnautica / Alien: Isolation** – diegetic PDA / retro-futuristic terminal UI for the AI companion.
- **Mini Metro / Monument Valley** – minimal, clean, phone-friendly visuals.
- Concretely: dark night-sky palette, one accent (the blue planet's colour) for interactive elements, monospaced HUD numbers, subtle CRT/scanline on the terminal panels, satisfying sounds (clicks, swings, stopwatch beeps), haptics on mobile.
- **Hub screen:** illustrated crash-site map with clickable stations (Observatory, Pendulum tent, Hill, Workbench, Ship computer, Launch pad). Top HUD: day, O₂/food, fuel, time warp. Side: mission tracker.

---

## 6. Telemetry for playtesting (portfolio evidence)

Local-only, exportable JSON per run: seed, difficulty, timestamps per step, every measurement + chosen error, hints used, consistency-check usage, outcome. A small script aggregates playtest files → solve rate, median time per step, "where players got stuck" chart for the technical document.

---

## 7. Questions for you

1. **Deadline & scope:** what is the real submission deadline now (doc dates Oct 18–31 have mostly passed)? How much of §5 do you want in v1 vs later?
2. **Planets:** 2 planets (home + blue outer target, distance scale from opposition parallax) or 3 planets (adds an inner planet for transit + synodic route as in the doc)?
3. **Distance-scale default:** opposition/diurnal parallax vs background stars (my recommendation), or keep transit parallax as default?
4. **Tech:** OK with Vite + TypeScript + React + Canvas, hosted on GitHub Pages? Any constraint (e.g. must be one HTML file, offline)?
5. **Survival layer:** include it (light version), or keep the game purely about measurement?
6. **Arrival:** should the fuel budget include capture/landing at planet 2 (gives M2 a purpose) or only departure as in the doc?
7. **Art direction:** stylised flat/minimal vector, or more realistic/painterly? Any reference games you love?
8. **Missing content:** the empty table on page 7 and the empty formula row — what were they meant to contain?
9. **Team:** who is working on this (doc says "we") — should code be organised for multiple contributors (e.g. one on engine, one on UI)?
10. **Language:** English only, or also Bangla (given BDOAA/NDMC playtesters)?
