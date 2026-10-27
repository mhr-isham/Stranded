# Stranded — Design v2: modes, chapters, story and flight

This document turns the review comments on [`ENGAGEMENT.md`](ENGAGEMENT.md) and [`ENGAGEMENT-DEEP-DIVE.md`](ENGAGEMENT-DEEP-DIVE.md) into decisions. Where the two older documents disagree with this one, **this one wins**. They remain the research record.

Contents:
1. Ground rules
2. How the game is organised
3. The five modes: what each one is for
4. Which feature goes in which mode (the master table)
5. Beginners first: how Cadet avoids overwhelming people
6. Predictions that are estimates, not guesses
7. The chapters
8. The story
9. Flying the ship: intro, landing, launch, transfer, descent
10. Exploring the surface: rover, camp, resources
11. Checkpoints and saving
12. Answers to the questions in the comments
13. Counter-arguments and open questions
14. Roadmap

---

## 1. Ground rules

1. **The physics is the same in every mode.** Gravity, orbits, light, the sky and the atmosphere follow the same rules in Cadet as in Astronomer. Easier modes never fake the world, because a beginner who learns from a fake world learns the wrong thing.
2. **What changes between modes is help, scope and pressure:**
   - **Help:** how much ECHO explains, warns and corrects.
   - **Scope:** how many methods, tools and real-world complications you handle yourself.
   - **Pressure:** spare fuel, spare time, saving and rewinding.
3. **Real complications follow a ladder.** A real effect such as refraction is:
   - in Cadet, **present but corrected for you**, with one sentence explaining it;
   - in Navigator, **present and pointed out**, but you choose what to do;
   - in Astronomer, **present and unannounced**; you have to notice it.

   This keeps Cadet honest without making it heavy.
4. **One new idea at a time.** A feature appears in a mode only after the player has met it, in a chapter, a Flight School module or an earlier mode.
5. **Nothing gives away the truth early.** No mode reveals true values before launch, except Free Roam, which is unscored and labels it clearly.
6. **No quizzes.** ECHO explains; it does not test you. (This follows your comment on 3.2.)

---

## 2. How the game is organised

The title screen offers **four ways to play**. A **mode** (Stargazer, Cadet, Navigator, Astronomer or Legend; §3) is chosen when starting an expedition or a chapter.

| Menu item | What it is | Modes | Scored? |
|---|---|---|---|
| **🎓 Flight School** | *Basic Training* (today's tutorial, start to launch) plus **one short training module per chapter**. A module unlocks when you reach its chapter (§7.2) | Its own fixed, fully guided setting | No (badges only) |
| **📖 Campaign** | The story: a prologue and 9 chapters (§7), each a new star system that teaches one new idea | Choose for each chapter; you can change between chapters | Yes, separate boards per mode |
| **🚀 Expedition** | A single system: random, daily or from a seed. You pick any twist from the chapters you have finished | Choose | Yes |
| **🔭 Free Roam** | No deadline, no score. All tools you have learned, the ship, the rover, the sky. Fly, explore, draw constellations and take photos. This is the no-pressure sandbox from the deep-dive document. (The **Stargazer** *mode* is different: a real, scored expedition with very generous margins.) | None | No |

Why chapters live in the campaign while their *lessons* live in Flight School: this answers your concern about a long tutorial. Basic Training stays the length it is now. Each chapter adds a **5–10 minute module** taught just before you need it, so nobody sits through a two-hour tutorial and forgets the start.

**Teaching is never mandatory** (your decision). Basic Training and every chapter module are **offered, not required**:
- When a chapter opens, ECHO offers its module: *"New idea here. Want the 6-minute version first?"* with **Train first** and **Jump in** buttons.
- Skipping is remembered: the module stays in Flight School and the lesson stays in the Codex.
- In Stargazer and Cadet, if the player gets stuck on the new idea (no progress on it for a while), ECHO offers the module once more. It never forces it.

---

## 3. The five modes

You suggested one or two more modes to spread the difficulty. There are now **five**, shipped in the game with this update:
- **Stargazer** sits below Cadet, for people who want to learn without pressure.
- **Legend** sits above Astronomer, for the very best.

### What each mode promises

| | **Stargazer** | **Cadet** | **Navigator** | **Astronomer** | **Legend** |
|---|---|---|---|---|---|
| **For** | Learning at your own pace; younger or casual players | First full expeditions | The standard challenge | After a Navigator success | After an Astronomer success |
| **Feeling** | "I can't really fail" | "I'm learning and it's working" | "I have to be careful" | "Every error bar is a decision" | "Nothing is free" |
| **ECHO** | Coach, very patient | Coach | Colleague | Instrument: arithmetic only | Instrument; no warnings at all |
| **Spare fuel** | about **30–63%** | about **18–38%** | about **10–22%** | about **6–13%** | about **5–9%** |
| **Spare air** after the first realistic window | about **6 months – 2 years** | about **3–13 months** | about **2–8 months** | about **1–5 months** | about **1–4 months** |
| **Competent player succeeds** *(validation bot, 40 systems)* | 40/40 | 40/40 | 38/40 | 33/40 | 28/40 |
| **Mistakes** | Rewind as often as you like | One free rewind | One rewind (−150 points) | One shot | One shot |

The fuel and air numbers come from 30 generated systems per mode, using the `DIFFICULTY` rules in `src/engine/system.ts`. The success column comes from `npm run validate` (`reports/validation.md`). **The in-game descriptions say exactly this.**

### Why five and not more
Five gives a clear ladder with real steps between each rung (the success rates above fall steadily). More would split players and leaderboards. Two other layers handle the rest:
- **Survival** is a toggle in every mode except Legend (always on), with its intensity set by the mode (§4.5).
- **Astronomer Challenges** (§4.3) are optional add-ons for experts.

## 4. The master table: which feature goes in which mode

Key:
- ● on
- ◐ optional, light or assisted version
- ○ off
- 🔒 unlocked later by a chapter

Columns: **SG** = Stargazer, **Ca** = Cadet, **Na** = Navigator, **As** = Astronomer, **Le** = Legend. ✅ = **already in the game** with this update.

### 4.1 Measuring and reasoning

| Feature | Flight School | SG | Ca | Na | As | Le | Free Roam |
|---|---|---|---|---|---|---|---|
| Formula sheet ✅ | ● | ● | ● | ● | ○ default (can turn on) | ○ locked | ● |
| Mission list ✅ | step by step | done + now + next, with "why" | done + now + next, with "why" | all goals, no method | ○ (you plan) | ○ | ○ |
| ECHO's warnings on suspicious readings, and the scatter-based error guide ✅ | ● | ● | ● | ● | ● | ○ | ● |
| ECHO's coaching lines (next steps, discoveries pointed out) ✅ | ● | ● | ● | ● | ○ quiet | ○ quiet | ● |
| Hints on the sheet ✅ | 3 levels | 3 levels, **free** | 3 levels | 1 level | ○ (Codex lessons) | ○ | ● |
| "Ask ECHO to verify" (costs fuel, hints at the truth) ✅ | ● | unlimited | 5 per run | 2 per run | ○ | ○ | ● |
| **Readiness meter** (from your own error bars) | ● | ● with "improve this next" | ● with "improve this next" | ● weakest value | number only | number only | ● |
| **Predictions** (§6) | guided practice | ● with helper, gentle | ● with helper | ● | ● strict scoring | ● strict | ◐ |
| **Several methods per quantity** | 🔒 module per method | 1 method | 1 method | choose 1 of 2 | all, cross-check bonus | all | all learned |
| **Observing-time planner** | ○ | ○ | ○ (ECHO schedules) | ◐ optional | ● | ● | ○ |
| **Real anomalies** (§12.2) | ○ | ○ corrected | ○ corrected, with a note | ◐ pointed out in the debrief | ● unannounced | ● unannounced, more often | ◐ |
| **Competing hypotheses** (§12.3) | ○ | ○ | ○ ECHO picks | ● | ● | ● | ● |

### 4.2 Time and waiting

| Feature | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| "Skip to next event" | ● ECHO picks | ● ECHO picks | ● from **your** predictions | warp to times you choose; events only from your model | same as As |
| Things to do while warping (constellations, rover trips, camp jobs) | ● | ● | ● | ● | ● |
| Auto-pause at events | ● | ● | ● | ◐ alarms you set | ◐ alarms you set |

### 4.3 Progress and replay

| Feature | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Score and grade ✅ | ● | ● | ● | ● | ● |
| Leaderboard (later, with servers) | own board | own board | own board | own board | own board, top ranked |
| Atlas card for every run, even failed ones | ● | ● | ● | ● | ● |
| Calibration profile (§12.1) | ● | ● | ● | ● | ● |
| **Astronomer Challenges** | ○ | ○ | ○ | ● after one success | ● (several built in) |

**Astronomer Challenges** replace the 20-rank ladder. There are **eight optional realistic modifiers**, each shown as a badge on your result:
- worn stopwatch;
- bad-seeing season;
- half rover range;
- no formula sheet;
- survival forced on;
- you fit the curves by hand;
- no ECHO sanity checks;
- one save.

They can be combined. Legend already includes three of them (no formula sheet, survival on, no sanity checks).

### 4.4 Flight and landing (§9)

| Feature | Flight School | SG | Ca | Na | As | Le | Free Roam |
|---|---|---|---|---|---|---|---|
| Prologue landing | assisted, can't crash | assisted, can't crash | assisted, can't crash | assisted, can't crash | manual; ECHO saves you before a crash | manual; ECHO saves you, with damage | n/a |
| Launch ascent | ECHO flies | ECHO; ◐ take over | ECHO; ◐ take over with a guide line | manual or ECHO | manual or ECHO | manual | manual |
| Transfer burns | ECHO | ECHO | ECHO flies your plan | ECHO flies your plan; ◐ you fly it | ◐ you fly it | you fly it | manual |
| Mid-course correction | ECHO | ECHO, shown live | ECHO, shown live | you take a sighting; ECHO computes the burn | sighting + burn | sighting + burn | manual |
| Predicted path on screen | true path | true path | true path | **from your own model** | from your model | from your model | true path (sandbox) |
| Entry and landing at the target | assisted | assisted, wide corridor | assisted | attitude hold only | manual, heating limits | manual, heating limits | manual |
| Parachute | auto | auto-suggest | suggested | manual | manual, can tear | manual, can tear | manual |

### 4.5 Survival by mode

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Survival | toggle | toggle | toggle | toggle | **always on** ✅ |
| Storm forecast ✅ | 3 days | 2 days | 1 day | none | none |
| Oxygen leaks | rare, warned | rare, warned | normal | normal | normal |
| Fuel from ice (§10.3) | ● fast | ● fast | ● | ● | ◐ slower |

### 4.6 Saving (§11)

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Autosave (quit and continue) ✅ | ● | ● | ● | ● | ● |
| Manual checkpoints (3 slots) ✅ | any time | any time | 3 saves per run | ○ | ○ |
| Rewind to the launch planner after a failed flight ✅ | unlimited | 1, free | 1, −150 points | ○ | ○ |

---

## 5. Beginners first: how Stargazer and Cadet avoid overwhelming people

Your point that putting every feature in beginner mode is overwhelming is right. **The job of Stargazer and Cadet is to feel simple even though the world is real.** The rules below apply to both; Stargazer adds free hints, unlimited rewinds and bigger margins.

1. **Progressive disclosure.** The HUD in Cadet starts with **four elements**: the time, life support, ECHO and the sheet button. The warp menu, the readings table and the launch planner appear the first time you need them, with a one-line introduction.
2. **One method per quantity** in Cadet, the standard one that Flight School teaches. Other methods show up as "ECHO knows another way, ask me later" after the first success.
3. **ECHO plans the calendar** in Cadet. You never see the observing-time planner.
4. **Real complications are handled for you, but mentioned.** For example: *"Low stars are lifted a little by the air. I've corrected your horizon reading by 0.3′."* You learn that the effect exists without having to manage it.
5. **Two next steps at most** in the mission list, never a wall of tasks.
6. **A gentle failure.** A failed Cadet launch ends in a short, dignified story moment, then *"Rewind to the launch planner"*, which you can do once (§11).

**The test for any new Stargazer or Cadet feature:** a new player who just finished Flight School must be able to use it without reading anything extra. If they can't, it goes to Navigator.

---

## 6. Predictions that are estimates, not guesses (your comment on 2.1)

The risk you point out is real: if predicting feels like a lottery, players will tap at random. Five measures:

1. **A Flight School module, "Making a good estimate"** (5 minutes), teaching three moves with interactive demos:
   - **Extend the line:** drag a ruler along your last few points.
   - **Use a ratio:** "if the moon took 3 days to go half way, the full orbit takes about 6".
   - **Bracket it:** "it can't be less than X, because…, and it can't be more than Y, because…".
2. **The estimate helper is beside every prediction.** It shows the readings that matter, already plotted, with the time axis extended into the future. The player drags a marker *and* sets the ± range. In Cadet, the first two predictions are done together with ECHO, step by step.
3. **The range matters.** Predictions use the same honest scoring as the sheet:
   - a wild guess with a huge range scores almost nothing;
   - a confident wrong guess scores below zero.

   Random tapping therefore never pays, and an honest estimate always beats it.
4. **"Your data says…" (Cadet only).** If a prediction falls far outside what the player's own readings allow, ECHO says: *"Your drift readings point to around day 140 — want to use them?"* This comes from the player's data, never from the truth.
5. **After the reveal, a short explanation, no quiz** (your comment on 3.2). For example: *"It rose 40 minutes late. Your year was 2% long, so you expected the sky to have turned less than it did."* A "tell me more" link opens the matching lesson.

---

## 7. The chapters

### 7.1 Design method

Each chapter follows **the same template**, so players always know how to tackle it:

| Part | What it is |
|---|---|
| **The new idea** | One physics or astronomy idea that the previous chapter didn't need |
| **Why the old method fails** | The chapter's star system is built so the old approach clearly breaks. This creates the need, which research on productive failure shows is a good moment to learn |
| **Flight School module** | 5–10 minutes teaching the new idea with a demo, unlocked when the chapter opens |
| **The ECHO briefing** | At the start, ECHO states the problem in one paragraph, e.g. *"This blue planet has no moon. Without a moon we can't weigh it — unless we throw something past it."* |
| **What is reused** | Everything from earlier chapters works the same way, so nothing has to be re-learned |
| **Mode differences** | How Cadet, Navigator and Astronomer treat the new idea |
| **Story beat** | What the chapter adds to the main story |
| **The reveal** | The moment that rewards the new idea |

Every chapter keeps the core loop: **measure → model → predict → launch → land**.

### 7.2 Chapter list

| # | Chapter | New idea | Why the old way fails | New tool or method | Flight School module | Historical echo |
|---|---|---|---|---|---|---|
| P | **Prologue — "Fall"** | Flying and landing the ship | — | Thrusters, parachute, choosing a landing site | Basic Training, part 1 | — |
| 1 | **First Light** | The full chain: gravity, size, year, distance, parallax, the moon, transfer | — | Today's game | Basic Training (today's tutorial) | Eratosthenes, Kepler, Cassini |
| 2 | **The Silent Planet** | Weighing a planet by **flying a probe past it** (a flyby bends the probe's path) | The target has **no moon**, so the moon method can't give its mass | Launch a small probe; track its angle and Doppler signal | "Weighing with a flyby" | Mariner 10 found Mercury's mass by flyby |
| 3 | **Thick Air** | **Refraction** and how air distorts measurements; finding the planet's size another way | The air bends light so much that the horizon-dip method is badly wrong | The Eratosthenes route: noon shadows at two sites | "Light bends in air" | Eratosthenes (c. 240 BC) |
| 4 | **The Long Ellipse** | **Elliptical orbits** (Kepler's 1st and 2nd laws) | The target's orbit is clearly oval: oppositions are uneven and its size in the telescope changes | Fit an ellipse to its changing distance and speed | "Ellipses and equal areas" | Kepler and Mars (1609) |
| 5 | **Inward** | An **inner planet**: greatest elongation, phases, **transits** across the star | An inner planet is never at opposition, so the opposition method doesn't work | Measure the greatest elongation and time a transit | "Inner planets" | Copernicus; the transits of Venus |
| 6 | **Red Dwarf** | **Tidal locking**, a dim star, flares | The home planet always faces the star the same way, so there is no normal day and the star-drift method must change | Use the slow yearly turn of the stars and the star's brightness | "Locked worlds" | — |
| 7 | **Slingshot** | **Gravity assist** using a third planet | The target is too far for the fuel; a direct transfer is impossible | Plan a two-leg route through a middle planet | "Stealing speed from a planet" | Voyager |
| 8 | **Lost Among Stars** | **Stellar parallax**: measuring the distance to nearby stars and finding your place in the galaxy | The question is no longer *where the planet is* but *where we are* | Six months apart, measure the shift of nearby stars and match them to a map | "Measuring the stars" | Bessel (1838) |
| 9 | **Home** | The real Solar System: stranded on **Mars**, navigate to **Earth** | — (the final exam: an inner target, real values) | Every skill; at the end, your numbers are compared with NASA's | "Our Solar System" | Everything above |

**Pacing:**
- Chapter 1 is the current game.
- Chapters 2, 3 and 5 change **one measurement** each, so they are cheap to build and gentle to play.
- Chapters 4 and 7 change the **orbit maths**, which is bigger work and later.
- Chapters 8 and 9 tie the story together.
- You agreed on **2 planets** for the base game; only chapter 7 needs a third planet, and it is introduced as the chapter's whole point.

### 7.3 Example: Chapter 2, "The Silent Planet", in detail

- **Briefing:** *"No moon. Without something orbiting it, we can't weigh it — and without its mass, we can't plan the capture burn. But we have one probe left."*
- **Flight School module (6 minutes):**
  - A demo where you drag a planet's mass slider and watch a probe's path bend more or less.
  - Shown with arrows: the turning angle depends on mass, speed and how close the probe passes.
- **Gameplay:**
  1. Launch the probe on a flyby trajectory. It costs a small, fixed share of the fuel; spending it is part of the decision.
  2. Over the following weeks, take the probe's position against the stars each night, or its radio Doppler speed.
  3. Fit the bend to get the mass, with an error bar that depends on how well you tracked it.
- **Modes:**
  - Cadet: ECHO aims the probe and the tracking is a guided fit.
  - Navigator: you choose how close it passes. Closer gives more bending and a better mass, but a risk of hitting the planet.
  - Astronomer: you also pick the tracking nights, which plugs into the observing-time planner.
- **Story beat:** the probe's camera catches **a piece of human-made debris** in orbit around the blue planet (§8).
- **Reveal:** the probe's real path is drawn over your predicted one.

### 7.4 Mode differences inside chapters (general rule)

- **Stargazer and Cadet:** the new idea is the *only* new thing. ECHO does any other unusual work, using the standard methods. Stargazer adds a wider margin for the new idea's measurement.
- **Navigator:** the new idea plus one choice (two methods, or a risk dial like the flyby distance).
- **Astronomer:** the new idea plus real complications (anomalies, the planner, the challenges).
- **Legend:** as Astronomer, with no warnings and the complications more frequent.

---

## 8. The story (your comment on 2.4 and 4.4)

You asked for a story that runs across the whole game. This is the short outline; the full **story bible** is now [`STORY.md`](STORY.md). It covers the characters, plot per chapter, ECHO's tone guide, script samples and failure endings, and it adds two ideas: the measurements are the fold drive's calibration, and ECHO is secretly the Halcyon's AI. The rules for the story:
- every clue is a physical measurement;
- the story never interrupts a measurement;
- the story never gives away numbers.

### The premise
- You are the navigator of the survey ship **Kestrel**. Its experimental **fold drive** (the *one* piece of fiction in the game, used only between chapters) misfires.
- The ship falls into an unknown star system. The star catalogue is wiped and ECHO, the ship's AI, is badly damaged.
- The crew are in cryo-sleep. One pod, belonging to **Commander Ira Vale**, is failing, which is *why* life support is limited.
- Each chapter you repair a bit more of the drive and **jump** to another system, closer to home.

### The mystery: the *Halcyon*
- Forty years ago another ship, the **Halcyon**, vanished on the same test route.
- In every system you find something the Halcyon left behind, and **each clue is physics**:
  - **Ch 1:** a faint "star" that moves against the others. Measuring its period shows it is **in orbit**: a dead satellite.
  - **Ch 2:** your probe photographs the debris. Its orbit decay rate tells you **how long ago** it got there.
  - **Ch 3:** a stone cairn with a stick and marks: someone measured **noon shadows** here before you.
  - **Ch 4:** a recorded star map whose stars are slightly in the wrong places. The shift is the stars' **real proper motion**, which tells you the map's **age**: about 40 years.
  - **Ch 6:** a flare warning written in the Halcyon's log, with real flare statistics.
  - **Ch 8:** the Halcyon navigator's final star sightings let you *reconstruct where they went*.
- **The reveal (chapter 9):** the Halcyon reached Mars and never left. Its navigator, **Mira Sato**, left a full journal of every system, a "voice from the past" whose entries you read across the whole game. She mirrors the player: someone who did the same measurements, sometimes made the same mistakes, and was honest about her error bars. **Your last flight from Mars to Earth carries her journal home.**

### People to care about
- **ECHO:** grows more capable as you repair it (more memory, better voice, opinions). It remembers your best and worst measurements across chapters.
- **Commander Vale:** speaks once per chapter (short wake-ups from cryo), and becomes the person you are saving.
- **Mira Sato:** a journal entry at each chapter's key moment.

### How much story per mode
The story is the same in all modes. Only ECHO's coaching lines change. Players can **skip** any scene; skipped scenes stay in the Codex as "Logs".

---

## 9. Flying the ship (your comments on 2.5 and 3.5)

You want the game to feel like a spaceflight simulator without the rocket building. I agree, with one condition: **flying must use the player's measurements, not replace them.** The way to do that is **optical navigation**, which is how real spacecraft such as New Horizons found their way: during flight you take sightings of the target against the stars, and what you see depends on how good your model was.

### 9.1 The opening (same in Flight School and every mode)

1. **10–15 seconds, no control:** the ship tumbles; red lights and alarms; ECHO's voice breaks up. The player's touch input does nothing (*"Controls not responding"*).
2. **Control returns:** ECHO says *"Attitude thrusters online. Stop the spin — tap against it."* This teaches the first control, **rotation**, with a big, forgiving target.
3. **Deorbit burn:** *"Point retrograde. Burn when the marker turns green."* This teaches the **main engine** and the idea of **slowing down to fall**.
4. **Entry:**
   - The plasma glow builds and the ship is buffeted.
   - The **entry angle** gauge shows a green corridor: too steep overheats, too shallow skips off.
   - In the prologue the corridor is wide and ECHO corrects small errors.
5. **Descent and choosing a site:**
   - After the heat shield separates, you see the surface from about 10 km up.
   - **Thrusters:** tilt to move left and right, throttle to slow down.
   - The scanner marks flat ground, hills (good for the horizon method), ice (fuel, §10.3) and the latitude, with a one-line hint on each. Latitude changes how the sky looks for the rest of the game.
6. **Parachute:**
   - If the descent fuel runs low, deploy the parachute.
   - A real limit: opened too fast or too high, it tears (shown on a gauge). On thin-air planets it can't land you alone and you still need the engines at the end. This teaches a true fact: on Mars, parachutes slow you, but rockets land you.
7. **Touchdown:**
   - The ship **becomes the camp**. Where you land is where you live.
   - **The prologue can't kill you.** If you are about to crash, ECHO takes over (*"Taking control!"*) and the landing is rougher (a bit of damage, a story line).
   - The descent fuel is separate from the launch fuel, so beginners aren't punished before they start.
   - A **"Skip: land at recommended site"** option appears for replays.

### 9.2 Launch, transfer, approach and arrival

| Phase | What the player does | Where it connects to measurement |
|---|---|---|
| **Ascent** | Throttle and pitch (a gravity turn) to orbit, or let ECHO fly | Your measured g and R₁ set the target speed. A bad g means a wrong target, shown honestly |
| **Departure burn** | Burn at the planned time and direction | Comes from *your* Lambert plan |
| **Cruise** | Warp; take **navigation sightings** (the target's angle against the stars, and its size in the telescope) | **This is optical navigation**: your measured size of the target and your sighting give a distance estimate |
| **Mid-course correction** | Plan and do a small burn | In Navigator and Astronomer the predicted path comes from *your* model and *your* sightings, so a bad model shows up as a path that drifts away from the real one |
| **Arrival choice** | **Capture into orbit** (fuel), **aerobrake** (heat and risk, needs an atmosphere), or go straight to **entry** | Real trade-offs; the fuel-margin decision from deep dive §3.5 lives here naturally |
| **Entry, descent, landing** | As in §9.1, but harder by mode (§4.4) | Your measured R₂ and M₂ give the gravity and the entry speed you expect |

**The fuel-margin decision (deep dive §3.5) becomes part of flight.** The launch planner offers **three named plans**:
- **Cautious:** a slow transfer that keeps the most fuel for corrections.
- **Standard:** about the Hohmann transfer.
- **Fast:** saves life support but burns more fuel.

The readiness meter shows the risk of each one *from your own error bars*. It is one decision, made once, using everything you measured.

### 9.3 Controls on phones
- One thumb for rotation (drag), one for throttle (slider).
- Big buttons for stage, parachute and warp.
- A flight assist toggle (attitude hold) in Cadet and Navigator.
- Everything is 2D (side view for ascent and landing; top-down map for the transfer), so it runs at 60 fps on any phone. The current patched-conic simulation already does most of the work.

### 9.4 What I'd keep away from flying
- **No fuel pickups in space**, no upgrades that make the engine magically better.
- **The flight must not be a way around bad measurements.** If manual flying could rescue any plan, measuring carefully would stop mattering. The fuel margins of each mode are what keep this honest: in Navigator and Astronomer, even perfect flying can't save a plan built on a model that is 10% wrong.

---

## 10. Exploring the surface: rover, camp and resources (your comment on 2.5)

### 10.1 Driving the rover across the planet
- **Free driving** on a large map: rocks, craters, hills, ice fields, wreckage, story finds.
- **Finds:**
  - spare parts (survival);
  - **ice** (fuel, §10.3);
  - meteorites (Codex entries and a little science);
  - Halcyon clues (story);
  - better observing sites (higher, darker, drier).
- **Realistic driving:**
  - **Battery:** there is a range limit before you have to recharge in the sun.
  - **Slopes:** steep slopes are slow.
  - **Navigation:** at night you navigate by stars, which reuses your constellations.
- Driving costs **time** (life support), which is the real trade-off.
- Long drives are also how the **Eratosthenes route** (chapter 3) and **two-site parallax** work, so exploring and measuring share one system.

### 10.2 Moving the whole camp
A ballistic hop really is expensive: going up and coming down again, a 5 km hop needs roughly 0.4–0.5 km/s and a 100 km hop about 2 km/s. You decided hops should be **fun without worrying in the easier modes**, and that **rover towing stays** too. So there are two ways to move, and hops get their own fuel logic:

| Way | Cost | When it's worth it |
|---|---|---|
| **Tow the habitat with the rover** | Time (days of slow driving); no fuel | Any move; the relaxed way to reach a better site or ice |
| **Hop the ship** with thrusters | The **hop tank** (see below), or launch fuel in the hard modes | Fast moves: a far-away observing site, ice, a story find |

**The hop tank.** The Kestrel's landing thrusters have their own small tank, separate from the launch fuel. Landers really are built this way (descent stages and thruster tanks are separate). It holds enough for about one long hop and refills from the camp's water electrolyser, which runs on solar power.

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Hops use | hop tank | hop tank | hop tank | hop tank, then launch fuel | **launch fuel only** |
| Hop tank refills | every night, automatically | every night, automatically | over 3 days, or faster with ice | only from ice | — |
| Life support during a hop | not counted | not counted | counted (minutes) | counted | counted |

In Stargazer and Cadet, hopping is pure fun: fly the ship to a new spot, land it yourself, set up camp, no fuel worry. In Legend it is the real thing: every hop is fuel you won't have for the flight to the target, and ECHO shows the cost before you commit: *"This hop costs 0.6 km/s — a fifth of our spare fuel."*

⚪ The nightly refill in the easy modes is a small, labelled allowance (the electrolyser would really need water and time). It doesn't touch the measurement chain, so learning is unaffected.

### 10.3 Making fuel from "minerals" (in-situ resource use)
Fuel from minerals is realistic if it means **water ice**:
- Split the ice with electricity into hydrogen and oxygen, which is real rocket propellant.
- Some planets have CO₂ air, which can be turned into methane fuel. NASA plans exactly this for Mars.

You asked that it **not be very hard**. So:
- **Finding ice is easy.** The rover's scanner shows ice fields on the map from the start, and there is always one within a day's drive of the landing area.
- **The processor comes with the ship.** No upgrade is needed; an upgrade only makes it faster.
- **One load of ice takes a few days to process.** Life support keeps running, which is the only real cost.
- **There is a cap per system**, so measuring well still matters most.

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Extra launch fuel you can make (share of the mode's spare fuel) | up to +40% | up to +40% | up to +25% | up to +15% | up to +10% |
| Days per load | 1 | 2 | 3 | 4 | 5 |

The result is a real **time-versus-fuel trade-off**, generous in the easy modes and tight in the hard ones. ✅ realistic.

---

## 11. Checkpoints and saving (your comment on 7)

The rules are in the table in §4.6, and **they are in the game now**:
- **Manual checkpoints:** three slots in the ☰ menu. Any time in Stargazer and Cadet; 3 saves per run in Navigator; none in Astronomer and Legend.
- **Rewind:** after a failed flight, the game offers to go back to the launch planner *before* showing the debrief. The debrief shows the true values, so opening it ends the chance to rewind. Unlimited in Stargazer, once and free in Cadet, once for −150 points in Navigator.
- **Astronomer and Legend are one shot** (you agreed): the game autosaves only so you can quit and continue. A checkpoint before launch would turn "my measurements must be right" into trial and error.

The run's counters (checkpoints used, rewinds used) are never rolled back by loading a checkpoint, and nor is anything you unlocked (Codex entries, achievements, lessons).

---

## 12. Answers to the questions in the comments

### 12.1 What is a calibration profile? (ENGAGEMENT 2.6)
For every value you put on the sheet, you give a ± range. If your ranges are honest, the truth should land **inside ±1 range about 68% of the time** (that is what a ±1σ range means).

After each run the game records, for every value, whether the truth was inside your range. Across runs it shows a simple chart.
- **Inside about 68%:** "well calibrated". Your ± ranges mean what they say.
- **Inside much less, e.g. 30%:** **overconfident**. Your ranges are too narrow; you think you're more precise than you are.
- **Inside almost always, e.g. 98%:** **underconfident**. Your ranges are too wide and you're throwing away score.

It also breaks this down **per tool**: *"Your pendulum ranges are honest; your parallax ranges are too narrow, by about 2×."*

Why it's useful:
- It is real scientific practice; weather forecasters are judged exactly this way.
- It's the skill the game is really about.
- It gives a reason to replay that isn't grinding: getting more honest is visible progress.

It works in every mode and only uses finished runs, so it never gives away anything during play.

### 12.2 Real anomalies, in detail (deep dive 3.6)
These are **real physical effects** that bend measurements in a consistent direction (systematic errors), not random noise. Each one can be noticed and corrected by a careful player. They belong to the harder modes, as you suggested:
- **Stargazer and Cadet:** corrected automatically, with a note.
- **Navigator:** occasional, and ECHO points them out in the debrief.
- **Astronomer:** unannounced.
- **Legend:** unannounced and more frequent.

| Anomaly | What really happens | How it shows up in the game | How a careful player catches it |
|---|---|---|---|
| **Refraction near the horizon** | Air bends light, lifting things near the horizon by up to ~0.5° | Horizon-dip readings come out smaller on humid or cold mornings | Readings on different days disagree; take the reading at the same temperature, or apply the correction from the lesson |
| **Bad seeing** | Turbulent air blurs and shakes the image | One night's micrometer and parallax readings scatter widely | The scatter is visibly larger, so drop that night or give it less weight |
| **Extinction** | Air dims stars near the horizon | Faint reference stars vanish low in the sky | Observe higher up |
| **Wind on the pendulum** | A steady push changes the swing | The period drifts on windy days | Readings correlate with the wind gauge; re-measure on a calm day |
| **Stopwatch drift** | A cheap clock runs a little fast or slow | Every timed value is off by the same tiny factor | Check the clock against the stars (a sidereal day is a perfect clock) |
| **Light travel time** (Rømer, 1676) | Light takes longer to arrive when the planet is far, so moon events seem late | The moon's period seems to change over months | The changes follow the planet's distance. Bonus: **you can measure the speed of light**, as Rømer did |
| **Non-simultaneous parallax** | The planet moves between two photos taken minutes apart | Parallax is slightly wrong if the two sites don't shoot together | Use the countdown to shoot together, or correct for the planet's motion |

A **"Sharp Eye"** bonus rewards excluding or correcting an affected reading. **Rule:** the effects are real and consistent, never random penalties, and every one has a Codex entry explaining it.

### 12.3 Competing hypotheses, in detail (deep dive 3.7)
Sometimes **two different explanations fit your data equally well**, and real astronomers have to keep both until new data decides. The game lets you **keep two models side by side** and then **choose an observation that tells them apart**. Real examples that arise in Stranded:
- **Period aliasing:** if you log the star drift every 10 nights, a year of 210 days and one of 190 days can both fit the points. Each model predicts a different position on a future night. **Pick the night where they differ most**, observe, and one model wins.
- **Which side the moon is on:** two early moon readings can fit two different orbits, depending on the direction the moon goes round. One more night settles it.
- **Opposition date:** two fits with different dates. Watch for the retrograde turnaround to decide.

**In the game:**
- When a fit is ambiguous, the sheet shows "Model A / Model B" with their predictions for the next weeks.
- A small "best night to decide" marker appears (Navigator), or you have to work it out yourself (Astronomer).
- In Cadet, ECHO picks the more likely one and says so in one line.

This teaches the core of the scientific method: **a hypothesis is useful when it predicts something you can check.**

### 12.4 The moderation problem with names (deep dive 4.1)
If names players type are **shown to other people** (on leaderboards, in shared systems, or "the first to finish names the system for everyone"), some people will type insults, slurs, personal information, links or spam. Handling this means **moderation**: filtering, a report button, someone reviewing reports, and banning. A two-person team can't do that around the clock, and the audience includes children, so the risk is real.

**The plan:**
- **Now:** names are **private**; only you see them. No moderation is needed.
- **Later, with servers:** shared names are **picked, not typed**. The game offers a generated name made from syllables or from a curated word list, e.g. "Veyra", "Thessaly Prime".
- If free typing is ever shared, add a word filter **and** a report button **and** a review process. All three are needed; a filter alone is easy to get around.

### 12.5 The real data chapter, in detail (deep dive 5.5)
NASA's **Kepler** and **TESS** space telescopes watched hundreds of thousands of stars for tiny dips in brightness, caused by a planet passing in front (a **transit**). The data is **public domain** and downloadable from NASA's MAST archive.

**The chapter or side mission "Archive":**
- ECHO recovers part of the Halcyon's archive: brightness curves of real stars.
- The player sees a **real light curve** (brightness over time) in the telescope view and measures:
  1. the **period** (time between dips), which is the planet's year;
  2. the **depth** of the dip, which gives the planet's size compared with its star (depth = (planet radius ÷ star radius)²);
  3. using Kepler's third law (chapter 1 skills), **how far it orbits** from its star.
- **The reveal** compares your values with the **published values** for that real planet, with the planet's real name, e.g. *"You just measured Kepler-7b."*

Why it's good:
- It uses the same skills on the **real universe**.
- It gives a strong "this is real science" moment.
- It needs **no servers**: we pre-process a few dozen small light curves into the game.

Cautions: keep the files small, credit NASA properly, and pick clean, easy curves for Cadet and noisier ones for Astronomer. It fits best as a side mission after chapter 5 (transits).

### 12.6 Will Cloudflare Workers or KV bill you? (ENGAGEMENT 6)
**On the Workers Free plan, you are not charged for going over the limits.** When a free limit is hit, requests fail until the daily reset at midnight UTC.
- Cloudflare's own changelog says this for D1 (its database): queries on the Free plan **fail** when the limit is exceeded, and data is not affected ([Cloudflare changelog](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)).
- Third-party guides describe the same for Workers: about **100,000 requests a day per account**, resetting at 00:00 UTC ([eastondev](https://eastondev.com/blog/en/posts/dev/20260526-cloudflare-free-limits/)).

The real risks:
1. If you ever **upgrade to Workers Paid** (from about US$5/month), usage above the included amounts is billed. A traffic spike or a bot attack could then cost money. Set usage notifications and spending alerts if you upgrade.
2. On the free plan the risk is **downtime**, not cost: a busy day or a bot could use up the daily limit and the leaderboard stops working until midnight UTC. One forum report describes exactly that with KV ([Finsweet forum](https://forum.finsweet.com/t/daily-usage-limit-for-cloudflare-workers-kv-operations-reached/3840)).
3. Please confirm on Cloudflare's own pricing page before relying on this, because plans change.

**Your own small server** has a fixed cost and no surprise bills. It does mean you have to keep it patched, back it up and protect it from abuse. For a small leaderboard either works. My suggestion: keep the game itself on **GitHub Pages** (free, static) and put only the small social features on whichever server you have.

### 12.7 Guardrails, in more detail (deep dive 7)
"Dark patterns" are design tricks that keep people playing or paying **against their own interest**. Many players will be teenagers, and the game's theme is honesty, so we should be stricter than most games.

| We will not | Why it's harmful | What we do instead |
|---|---|---|
| **Loot boxes or random paid rewards** | Gambling mechanics; restricted or banned in some countries for minors | No paid randomness at all |
| **Pay to progress** (buy fuel, buy hints) | Makes skill meaningless, and pressures children | The game is complete without paying. If it ever earns money, only cosmetics or "support the developers" |
| **Energy timers** ("wait 4 hours or pay") | Artificial waiting built only to sell | Waiting in Stranded is always **real** (orbits take time) and you can always warp |
| **Fear of missing out** (items you can only get this weekend, forever) | Pressure and anxiety | Events come back every year, like the real sky. Event rewards stay earnable later |
| **Streaks that punish** ("you lost your 30-day streak!") | Guilt; people stop entirely once a streak breaks. Duolingo itself adds streak freezes for this reason ([Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit)) | Streaks are optional, with free "cloudy night" freezes and no loss messages |
| **Pleading notifications** ("ECHO misses you 😢") | You decided reminders in ECHO's voice are fine. The risk is only tone: childish or pleading lines put adults off | Reminders in ECHO's **adult, in-character** voice about real things in your save: *"Opposition in 2 days. The blue planet will be as close as it gets."* Opt-in, at most one a day. Tone guide in [`STORY.md`](STORY.md) §6 |
| **Fake or misleading progress** | Breaks trust | Scores and meters only ever use real data |
| **Collecting personal data** | Laws protect children's data (e.g. COPPA in the US for under-13s, the UK Children's Code) | No accounts needed; telemetry is local and opt-in (§12.8); leaderboards use nicknames picked from a list |

**Removed (your decision): "endless play with no stopping point."** Device parental controls handle children's screen time, and many players are adults. Instead of stopping points we design for **long sessions that stay fresh** (§12.9).

**The test for any engagement feature:** *Would we be comfortable explaining exactly how it works to a parent, a teacher and the player?* If not, don't build it.

### 12.9 Long sessions that stay fresh
You want players to keep playing because it stays interesting, not because of tricks. Boredom in long sessions comes from **sameness** and **waiting**, so:
1. **Alternate the kind of activity.** Each act mixes careful measuring (focus) with something physical (driving, hopping, flying) and something calm (drawing constellations, reading a journal entry). No act is all one kind.
2. **Acts end on a hook, not a stop sign.** The end-of-act card is a save point with an open question (*"The blue planet is slowing down…"*) and a **Continue** button that goes straight on. The summary is one tap away for those who want it.
3. **Waiting is always optional.** While time warps, there is always something useful to do: rover trips to finds and ice, camp hops, constellations, Mira's journal, lessons. Waiting is never forced (deep dive §4).
4. **Something new every 10–15 minutes.** A new tool, a new place, a discovery (retrograde, the moon, a Halcyon find), or a story beat. Pacing is checked in playtests (§12.8).
5. **Long-term goals in view.** The Atlas, the calibration profile, chapter progress and Astronomer Challenges are always one tap away.
6. **Variety across runs.** Chapter twists, alternative methods, random systems and the daily system make the 10th run different from the 1st.

### 12.8 The measurement plan, in more detail (deep dive 8)
**Why measure?** Because "players seem to like it" is the same mistake as a measurement without an error bar. We want evidence that a feature makes people **stay** *and* **learn**.

**What we record** (only gameplay events, no personal data):

| Event | Example data |
|---|---|
| Session start and end | time, mode, chapter, how it ended (closed tab, finished an act, failed) |
| Flight School step reached | step id, time spent, hints used |
| Reading taken | tool, value, ± range, kept or dropped |
| Prediction made and revealed | predicted value, range, true value |
| Launch | plan type, readiness meter value, outcome, fuel left |
| Feature used | e.g. constellation drawn, rover trip, checkpoint used |

**Where it is stored:**
- **Now, without servers:** in the browser only. A hidden **"Export playtest log"** button saves a file that a tester sends us.
- **Later:** opt-in anonymous upload to your server. No names, no email, a random id per device.

**The metrics:**

| Metric | Exact definition | Target | What it tells us |
|---|---|---|---|
| **Time to first fun** | Minutes from opening the game to the first prediction reveal *or* the first "steady reading" medal | under 3 min | Whether the opening grabs people |
| **Flight School funnel** | % of players reaching each step | no step loses more than 10% | Which step confuses people |
| **Return rate** | % of players who play again the next day; within 7 days | ≥ 30%; ≥ 12% | Whether it's sticky (typical mobile games keep about 23% and 4%) |
| **Run completion** | % of started Cadet expeditions that reach a launch | > 60% | Pacing and dead time |
| **Calibration** | % of sheet values with the truth inside ±1σ | moving toward ~68% over runs | Whether **honesty** is being learned |
| **Prediction error** | Average size of the miss, compared with the stated range | falling within a run and across runs | Whether **understanding** is improving |
| **Concept check** | 6 short questions before Flight School and after the first expedition, e.g. "why does a planet go backwards?" | clear improvement | Whether people learn the physics, not just the buttons |

**How to run a playtest** (works for a team of two):
1. **5–8 testers per round.** Small rounds find most usability problems. Include beginners, competition students and someone younger.
2. **Watch them play** (in person or on video) and ask them to **think aloud**. Don't help unless they're stuck for 2 minutes. Note every moment of confusion.
3. **Afterwards:** the concept check, plus 5 questions on a 1–7 scale: fun, felt in control, felt competent, wanted to continue, confusing parts.
4. **A/B tests** (for example predictions on vs off): give half the testers each version and compare the metrics above. With small numbers, look for **big** differences; small ones are noise.
5. **Decision rule:** keep a feature if it improves engagement **without** lowering learning (calibration, prediction error, concept check). If a feature raises engagement but lowers learning, cut it or move it to Free Roam.

---

## 13. Counter-arguments and open questions

1. **"Realistic features only in harder modes"** is mostly right, but with one correction: the **world** is equally real in all modes; only *handling* the complications moves to harder modes (§1, rule 3). Otherwise Cadet would teach a false world.
2. **Free Roam and Flight School both unscored:** keep them clearly separate. Flight School teaches with a script; Free Roam has no script at all.
3. **Manual flying vs measurement:** flying is great fun, but it must never make measurement optional. The fuel margins and the "predicted path from your own model" rule protect this (§9.4).
4. **Camp hopping costs a lot of fuel** in reality (§10.2). I recommend rover towing as the normal way and hopping as a rare, costly choice.
5. **Fuel from ice** is realistic but threatens the fixed-fuel tension. Hence the cap and the time cost (§10.3).
6. **A long campaign** (9 chapters) is a lot of work. Chapters 2, 3 and 5 are the cheapest and most valuable; build them first.
7. **The prologue landing replaces the current five story cards**, so new players reach the controls in under a minute. The first night sky (deep dive §2) comes right after touchdown.
8. **The "Short expedition" idea** from the deep dive (some values already known) is **dropped** (you agreed). Acts with save points let players stop whenever they like, without removing any learning (see below).
9. **Story writing** needs its own task: a story bible, script and ECHO lines. Want me to draft it next?

**Pacing a first session (you asked to think more about this).** Chapter 1 splits into **five acts**. Each act ends with a save, a hook for the next act and a **Continue** button; the summary of what you learned is one tap away.

| Act | Contents | Cadet length | Hook at the end |
|---|---|---|---|
| I · Ground | Landing, gravity, size | ~15 min | "Tonight the stars will show us how long a year is here." |
| II · Sky | Star drift, year, first predictions | ~15 min | "The blue planet is slowing down. Something strange is coming." |
| III · The blue planet | Retrograde, opposition, parallax, size | ~20–25 min | "We know where it is. Now we need to know how heavy it is." |
| IV · The moon | Moon orbit, mass | ~10 min | "Everything's on the sheet. Ready to plan the flight?" |
| V · Flight | Plan, launch, transfer, landing | ~15 min | The ending and the Atlas card |

Players who need to stop can stop at any act boundary with nothing lost; players who keep going roll straight into the next act. Either way, the act boundary lands on a high point and an open question, which is what brings people back.

---

## 14. Roadmap

| Order | Work | Size |
|---|---|---|
| ✅ | Mode descriptions say what to expect; each mode sets the formula-sheet default | S |
| ✅ | **Five modes** (Stargazer and Legend added) with margins validated by the solver bot | S |
| ✅ | **Mode rules in the game:** mission list, ECHO coaching, sanity warnings, hints, verify limits, formula lock, survival lock, storm forecast (§4) | M |
| ✅ | **Checkpoints** (3 slots) and the **rewind** offer before the debrief (§11) | M |
| ✅ | **Story bible** ([`STORY.md`](STORY.md)); the new opening ship log; ECHO lines on every ending | M |
| ✅ | Predictions with the estimate helper + the "Making a good estimate" module (§6) | M |
| ✅ | Readiness meter in the HUD (from your own error bars; the launch planner already has a version) | S |
| ✅ | Prologue: tumble, control returns, entry, descent, site choice, parachute, camp (§9.1) | L |
| ✅ | Acts with hooks (§12.9, §13) | M |
| ✅ | Atlas cards, calibration profile, naming (private) | M |
| ✅ | Story: full prologue script, Mira's journal entries, Vale's wake-ups ([`STORY.md`](STORY.md) §7) | M (writing) |
| ✅ | Chapters 2, 3 and 5 with their optional Flight School modules | L each |
| ✅ | Manual flight phases: ascent, corrections with optical navigation, arrival choice, landing (§9.2) | L |
| ✅ | Rover free driving, camp towing, the hop tank, ice-to-fuel (§10) | L |
| ✅ | Free Roam | M |
| ✅ | Chapters 4, 6, 7, 8, 9; Astronomer Challenges; anomalies; competing hypotheses | L |
| Later | Social features, co-op, real-sky events, the connection layer: after we have servers (your decision) | — |
| Dropped | Earth missions with phone sensors (your decision); "Short expedition" with known values (§13.8) | — |
