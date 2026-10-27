# Stranded — Engagement Deep Dive (part 2)

> **Decisions:** the review comments on this document are answered and turned into decisions in [`DESIGN-V2.md`](DESIGN-V2.md) (modes, chapters, story, flight). Where they differ, DESIGN-V2 wins.

This builds on [`ENGAGEMENT.md`](ENGAGEMENT.md). That document listed ideas; this one goes deeper into **why players stay**, what the research says about **learning games specifically**, and turns it into a **player journey**, **player profiles**, **new mechanics woven into the physics** and a **revised roadmap**.

Legend (as before): ✅ strengthens learning/realism · ⚪ neutral · ⚠️ compromises it — keep out of hard modes or label clearly.

---

## 1. What the research tells us — and what it means for Stranded

| Finding | Source | What it means for us |
|---|---|---|
| When the learning is **built into the core mechanic** ("intrinsic integration"), children learned more in a fixed time and, given free choice, played the integrated version **about 7× longer**. A 2022 replication with 210 people found the learning advantage again, but traced it to **attention** rather than motivation | Habgood & Ainsworth 2011 ([Sheffield Hallam](https://shura.shu.ac.uk/3556/)); Cutting & Iacovides 2022 ([White Rose](https://eprints.whiterose.ac.uk/189921)) | **This is our main filter.** Every engagement feature should make the player measure, predict or reason *more*, and should keep attention on the instrument or the sky at the moment of reward. Rewards stuck on afterwards (badges for logging in) add little. |
| Serious games beat conventional teaching for **learning (d ≈ 0.29)** and **retention (d ≈ 0.36)**, but were **not clearly more motivating**. They worked better with **several sessions**, **groups**, and **extra instruction** alongside | Wouters et al. 2013 ([Utrecht](https://research-portal.uu.nl/en/publications/a-meta-analysis-of-the-cognitive-and-motivational-effects-of-seri/), [summary](https://www.e-teaching.org/materialien/literatur/wouters-van-nimwegen-van-ooostendorp-van-der-spek-2013)) | Being "a game" doesn't make Stranded motivating by itself; we have to design for it. Structure play into **sessions**, add **group play** (co-op, classroom), and keep the **lessons**. |
| Games improved learning over non-game teaching (g ≈ 0.33). **Better-designed games beat basic versions** (g ≈ 0.34). Support that guides the player while they play adds g ≈ 0.43, most of all in **puzzle and simulation** games | Clark, Tanner-Smith & Killingsworth 2016 ([SRI brief](https://www.sri.com/publication/education-learning-pubs/digital-learning-pubs/digital-games-design-and-learning-a-systematic-review-and-meta-analysis-brief/)); scaffolding meta-analysis ([Springer](https://link.springer.com/article/10.1007/s10648-021-09655-0)) | Design matters more than the medium. Invest in **feedback that diagnoses what went wrong** ("your release angles are always over 15°") rather than generic hints. |
| Curiosity comes from a **gap** in knowledge that feels **closable**, and it needs some prior knowledge as a foothold. A gap can close step by step or in one flash of insight. **Spoilers kill curiosity** | Loewenstein (via [CMU review](https://www.cmu.edu/dietrich/sds/docs/golman/golman_loewenstein_curiosity.pdf), [DiGRA paper](https://dl.digra.org/index.php/dl/article/download/793/793)) | Show the open questions early ("Why does it go backwards?"), let progress be visible (the constellation already does this), keep the truth hidden until it's earned, and plan the insight moments (the retrograde reveal, the parallax "jump"). |
| People remember an experience mostly by its **most intense moment and its ending**. A CHI study changed only the *order* of difficulty and changed how players rated the game afterwards | Peak-end rule ([CHI 2016](https://dx.doi.org/10.1145/2858036.2858419), [game examples](https://gametek.substack.com/p/colonoscopies-and-board-games)) | Our ending is currently a **table of numbers**. Both success and failure need a designed peak and a strong ending (§4.6). |
| A loyalty card that started with **2 of 10 stamps** already filled was completed **34% of the time vs 19%** for an empty 8-stamp card; progress near the goal speeds people up | Endowed progress, Nunes & Drèze ([summary](https://en.wikipedia.org/wiki/Goal_pursuit)) | Start each chapter with some progress **already there** (stars ECHO still remembers), and show "3 of 18 stars lit" and countdowns. |
| People value **what they made** more ("IKEA effect"), even if it's amateurish, but **only if they finish it**; destroying it removes the effect | Norton, Mochon & Ariely 2012 ([Harvard DASH](https://dash.harvard.edu/handle/1/12136084)) | Let players *make* things: name the system, draw constellations, keep a journal. **Never let a failed launch erase them.** Every run, even a failed one, earns a finished "system card" for the player's atlas. |
| **Predict → Observe → Explain** is a well-established physics-teaching method: wrong predictions are "logical" and become the best teachable moments | White & Gunstone (via [TU Delft](https://interactivetextbooks.tudelft.nl/showthephysics/Pedagogy/PoE.html), [NZCER](https://arbs.nzcer.org.nz/node/7187)) | This is the research basis for the **predictions** mechanic. Add the third step: after the reveal, ECHO asks *why* in one tap and explains. |
| "Juice" (extra visual, sound and **vibration** feedback) measurably improves player experience | [CHI PLAY 2019](https://unpaywall.org/10.1145%2F3311350.3347171), [juicy haptics CHI 2021](https://uwaterloo.ca/haptic-experience-lab/projects/juicy-haptic-design-vibrotactile-embellishments-can-improve), [juicy audio 2024](https://eprints.staffs.ac.uk/8527/1/3677084.pdf) | Make the juice **teach**: the strongest feedback goes to good *technique* (a steady reading, many swings), judged against the player's own scatter so the truth never leaks. |
| Mobile game medians are roughly **23% of players back on day 1, 4% on day 7, under 1% on day 28** (sources disagree on whether these are all games or top games). Puzzle games do better (around **12% on day 7**) | [GameAnalytics Q1'24](https://gamedevreports.substack.com/p/gameanalytics-benchmarks-in-mobile), [2025 report](https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf), [genre data](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies.md) | Most players are lost in the **first session**. The thing to measure is **time to first fun**, not tutorial completion ([Bugnet](https://bugnet.io/blog/how-to-measure-player-time-to-first-fun), [Roblox onboarding docs](https://create.roblox.com/docs/production/game-design/onboarding)). |
| Self-determination theory: feeling **competent**, **in control of your choices**, and **connected to others** each independently predicts enjoyment and continued play | [Ryan, Rigby & Przybylski 2006](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf) | Our weakest of the three is **choice**: every run follows one fixed route. See §3.1. |

**Lessons from specific games (case studies):**

| Game | What it does | Lesson for Stranded |
|---|---|---|
| **Heaven's Vault** | Most translations are **never confirmed**; the designers said players would otherwise brute-force answers ([interview](https://gamedeveloper.com/business/road-to-the-igf-inkle-s-i-heaven-s-vault-i-)) | Supports our no-instant-truth rule. Players can hold **competing hypotheses** and see which one predicts better. |
| **Slay the Spire** (ascension levels) | **20 levels** after the first win, each adding one rule on top of the others ([analysis](https://mechanicsofmagic.com/2021/05/25/critical-play-is-this-game-balanced-slay-the-spire/)). Critics say pure difficulty gets stale | An **Expedition Rank** ladder of *realistic* constraints, each one also unlocking something new, not just harder. |
| **Death Stranding** (asynchronous multiplayer) | Players **help strangers they never meet** (shared roads, supplies, "likes"), and only after first crossing the map alone ([explainer](https://www.cheatcc.com/articles/how-death-stranding-s-asynchronous-multiplayer-works/)) | A **connection layer** on shared systems: send supplies and preset tips, without ever giving away numbers. |
| **No Man's Sky** | The **first discoverer names** the place for everyone ([guide](https://primagames.com/tips/no-mans-sky-how-name-star-system), [forum](https://steamcommunity.com/app/275850/discussions/0/3135044721708258965)) | The first to complete the weekly system **names it** for everyone. |
| **EVE Online, Project Discovery** | Players classified **real CoRoT light curves** for exoplanet transits, hundreds of millions of times ([CORDIS](https://cordis.europa.eu/article/id/413456-online-gamers-help-analyse-big-data-science), [CCP](https://www.ccpgames.com/news/2017/eve-online-gamers-to-join-in-exoplanet-search-through-scientific-collaboration)) | **Real data** is a powerful hook. A transit chapter could use real public light curves. |
| **Kerbal Space Program** (career mode) | Players criticise the science grind and "tick-box" contracts, and **want to set their own goals** ([forum poll](https://forum.kerbalspaceprogram.com/topic/179191-poll-whats-wrong-with-stock-science/page/2), [thread](https://forum.kerbalspaceprogram.com/topic/109910-career-mode-suggestion-from-a-new-player)) | **No grind and no check-box contracts.** Long-term progress should follow the player's own goals. |
| **Pokémon GO** (Community Day) | A predictable **monthly** event, and players pushed back when it was shortened ([Automaton](https://automaton-media.com/en/news/20220324-10815/)) | A **monthly "Sky Night"** tied to real sky events (§6). |
| **phyphox** | Turns a phone's sensors into lab instruments, including a **pendulum that measures real g** ([arXiv](https://ar5iv.labs.arxiv.org/html/1804.06239), [App Store](https://apps.apple.com/app/phyphox/id1127319693)) | **"Earth missions":** do the same experiments for real with your phone (§5.4). |
| **Cozy games** | Some players find **time pressure and losing stressful**. Research is thin, but the split between player types is clear ([Utrecht thesis](https://studenttheses.uu.nl/bitstream/handle/20.500.12932/47430/Cozy_Games_Thesis-Leonardo_Trujillo%28final%29.pdf)) | A separate no-pressure **Stargazer mode** (§5.6). |

---

## 2. The player journey: where engagement is won or lost

### First 60 seconds: the hook
*Today:* title → five story cards → ECHO → pendulum. The first moment of wonder comes **too late**.
- **Open on the sky.** After a ~10-second crash cinematic, the first thing you control is **dragging a real night sky**. ECHO points out one steady blue light: *"That's where we're going."* This creates a curiosity gap in under a minute ⚪.
- Fold the story cards into that first night: ECHO speaks while you look around.

### First 10 minutes: the first win
- The first measurement (the pendulum) should give a **juicy, personal result**: "Gravity here is **1.07 g** — you'd weigh 7% more" ✅.
- The first **prediction** should come early: "The blue planet will rise at about… place your marker," then warp and see ✅.
- **Endowed progress**: the constellation starts with **G** and the ship's clock already lit ("ECHO's surviving memory"), so 2 of 20 ✓ ⚪.

### First session (20–40 minutes): a complete arc
- Each session should end on a **finished arc plus a hook** (unfinished business pulls people back): *"Year measured ✓. The blue planet slows down in 9 days — it might do something strange. Come back to see it."* ⚪
- Offer a **"Short expedition"** option (~20–30 min, some values pre-known from ECHO's memory) for phone players. ⚠️ It covers less of the chain, so Navigator and Astronomer keep the full chain.

### First week: the reasons to return
- The **daily system** (exists) plus a **weekly named expedition** with a leaderboard (§5.3).
- The **Expedition Rank** ladder after the first win (§3.4).
- **Atlas of systems** you've measured (§4.5) and the **calibration curve** (in the first document).

### Long term: identity and community
- Titles and ranks based on **honesty and precision**, not hours played.
- Chapters that teach new physics (first document §2.2), **monthly Sky Nights** tied to real astronomy (§6), co-op, classroom mode and real-world Earth missions.

---

## 3. New mechanics that live inside the physics (pass the "built into the mechanic" test)

### 3.1 More than one method for each quantity: player choice + real cross-checks ✅✅ · L
Today every run is the same nine measurements. Real astronomers had **several methods** for each quantity; let players **choose**:

| Quantity | Route A (now) | Route B (new) | Trade-off |
|---|---|---|---|
| Planet radius R₁ | Horizon dip from the hill | **Eratosthenes**: the rover drives north; compare noon shadow angles at both sites | B needs a long drive and noon timing, but no hill and no hand sway |
| Year P₁ | Star drift at dusk | **Noon shadow / season cycle** (needs axial tilt), or **sidereal vs solar day** timing | B is slower or needs very precise timing |
| Distance d | Two-site parallax with the rover | **Diurnal parallax**: one observer, evening vs morning, with the planet's rotation as the baseline (needs R₁ and the length of day) | B needs no rover, but you must correct for the planet's own motion |
| Blue planet year P₂ | Two oppositions (waits a whole synodic period) | **Retrograde rate at opposition** (one opposition plus some algebra) | B saves months of life support but is harder to get precise; an **expert shortcut** |
| Blue planet mass M₂ | Moon orbit | **Density analogy** with your home planet | B gives honestly *wider* error bars |

Why it matters:
- **Choice:** the player plans their own expedition.
- **Mastery:** each route is a skill to learn.
- **Replay:** a different route each time.
- **Real verification:** two routes to the same quantity make a **true consistency check**, which is exactly how science catches systematic errors.

### 3.2 Predict → Observe → Explain cycles ✅ · M
This expands "call your shot" from the first document with the third step.

After each reveal, ECHO asks *"Why do you think it was off?"* with three one-tap answers, for example:
- (a) the opposition date was early;
- (b) the year is too long;
- (c) the planet's orbit isn't circular.

ECHO replies with a two-sentence explanation tied to the player's own numbers. Wrong predictions are treated as reasonable, which is what POE recommends.

Scoring: accuracy multiplied by how honest the ±range was, using the same log score.

### 3.3 Observing-time planning: an allocation puzzle ✅✅ · M
Real astronomers apply to a committee for limited telescope time. Before a phase, the player gets a **calendar** with:
- dusk windows;
- clear nights (in survival mode);
- predicted oppositions (from their own model);
- rover days and life support.

They schedule measurements on it. The **readiness meter** (first document) previews how each plan would change the chance of success. This turns **error propagation into strategy**: "the distance matters 3× for the star's mass, so it gets the extra nights."

### 3.4 Expedition Rank (an ascension-style ladder) ✅ · S–M
After the first success, unlock ranks 1–20. Each adds **one realistic constraint**. Every 5 ranks also unlock something *new* (a route, a chapter twist, a cosmetic), so the ladder isn't just "harder". Examples:
- 2 · Worn stopwatch (±0.2 s button lag)
- 4 · No formula sheet
- 6 · Cloudy season
- 8 · Rover range halved
- 10 · ECHO's verify disabled
- 12 · Worse seeing (2″)
- 14 · Survival mode forced on
- 16 · Life support −25%
- 18 · You fit the drift and moon curves by hand
- 20 · Ironman, with one save

Players get an endless mastery goal without grinding. Every constraint is something real expeditions face.

### 3.5 Choosing your fuel margin: a decision built from your own error bars ✅ · S
At launch the player chooses how to **spend the margin**: save it for corrections (safe), or spend it on a **faster transfer** that saves life support and scores higher. The choice depends entirely on how much they trust their own error bars, so it is a direct use of calibration. The readiness meter shows the risk.

### 3.6 Real anomalies to spot ✅ · M
Occasional, **physically real** surprises that test whether players notice systematic errors:
- **refraction** lifting a low horizon on a hazy morning;
- a **moon occultation** hiding the moon for a night;
- **turbulent air** making one night's readings scatter;
- **dust** on the scale.

Spotting and excluding them earns a "Sharp Eye" bonus (the sanity warnings already support this). ⚠️ They must be real effects, never random noise added to readings.

### 3.7 Competing hypotheses (like Heaven's Vault) ✅ · M
Let players keep **two candidate models** side by side, e.g. "opposition on day 118" vs "day 121". The game shows which one predicts better as data arrives. This is how model selection works in real science, and it makes uncertainty something you play with.

---

## 4. Attachment: making it *their* expedition

### 4.1 Name everything ⚪ · S
Name the star, planets, moon and ship; ECHO uses the names everywhere. For shared seeds, a name generator (built from syllables) avoids moderation problems ⚠️.

### 4.2 Draw your own constellations ✅ · M
In the sky view, players can **connect stars into constellations and name them**. They persist in that system's sky, and ECHO uses them: *"The blue planet is entering the Kite."* This is historically accurate (people have always named star patterns to navigate) and practically useful (they become reference points for the tracker). It is also a strong attachment hook: their work, finished, on display.

### 4.3 The Navigator's Journal ✅ · S–M
An automatic illustrated diary of the expedition using the player's real numbers and moments ("Day 41: the swing took 2.84 s. ECHO says gravity is 7% stronger than Earth's."). It can be **exported as a PDF expedition report or certificate**, which is good for teachers, parents and portfolios.

### 4.4 People to care about ⚪ · M
Building on the cryo-pod crew member from the first document:
- **Short letters** at milestones.
- A **personality ECHO grows** from your choices (cautious vs bold).
- **Callbacks**: ECHO remembers your best measurement and your worst mistake across runs.

### 4.5 The Atlas: every system you've measured ✅ · S
Every run, **even failed ones**, adds a finished **system card** to an Atlas: your measured values, the true values, your names, your constellations and a photo. Completion keeps the IKEA effect alive, and collecting gives a reason to try new seeds and chapters.

### 4.6 Design the peak and the ending (peak-end rule) ⚪ · M
- **Peak:** a real launch sequence (countdown, ascent, engine cut-off, escape, stars). Then the **mid-course correction moment**: the screen shows how far off your aim was, with ECHO's correction drawn live. This is the most physics-meaningful dramatic beat in the game.
- **Ending on success:** entry and landing, the first view of the new world, crew reaction, the system card added to the Atlas, then the debrief.
- **Ending on failure:** a dignified, story-rich ending (drifting past the blue planet as ECHO reflects, a crew line), then one tap to **"Re-plan from the launch planner"**. In Cadet this costs a score penalty; ⚠️ Astronomer stays one-shot.
- Keep the **truth table** but lead with the story moment. Never end on a spreadsheet.

---

## 5. Many ways to play (serving different players)

### 5.1 Player profiles and what keeps each of them

| Profile | Likely players | What keeps them | Key features |
|---|---|---|---|
| **The Olympiad competitor** | BDOAA/NDMC/ROC students | Mastery, ranking, recognition | Expedition Rank, weekly leaderboard with charts, calibration titles, speedruns, other measurement routes |
| **The curious explorer** | Most new players | Discovery, beauty, story | Predictions, mystery arc, constellations, photo mode, landing |
| **The relaxed stargazer** | Younger and casual players | No pressure, creativity | Stargazer mode, constellation drawing, lessons |
| **The social player** | Friends and classmates | Comparing and helping | Share cards, friend challenges, co-op parallax, connection layer |
| **The teacher** | Schools, clubs | Control, evidence, curriculum fit | Classroom mode, fixed seeds, CSV export, journal PDF, Eratosthenes-day events |
| **The builder** | Creative players | Making things | Naming, constellations, camp and ship customisation, the Atlas |

### 5.2 Co-op parallax (two phones, two sites) ✅✅ · L
One player is at camp and one is with the rover. **Both must image at the same moment** (a shared countdown), then combine their frames in the blink comparator together. It mirrors Cassini and Richer and the real Eratosthenes school project, where each school needs its partner's measurement ([eTwinning](https://school-education.ec.europa.eu/en/etwinning/projects/eratosthenes-2024/twinspace/pages/general-evaluation)). Technically simple: a short room code over a tiny relay server, or even copy-pasted codes.

### 5.3 A connection layer like Death Stranding's (on shared seeds) ⚪/⚠️ · M
On the daily or weekly system, after you have finished it once:
- send a **supply drop** (a few days of oxygen) that appears in a random other player's survival run, and receive **"likes"**;
- leave **preset tips** at stations (Dark Souls style: "Try climbing higher", "Count more swings"). ⚠️ No free text and no numbers, so nothing leaks and nothing needs moderation;
- the first person to complete the weekly system names it for everyone (No Man's Sky style).

### 5.4 Earth missions: real experiments with your phone ✅✅ · M
Unlock real-world side missions that use the phone's sensors (accelerometer, orientation) and camera:
- **Measure Earth's g** with your phone as a pendulum (on a string), like phyphox.
- **Measure the tilt of a slope** or the sun's altitude with the inclinometer.
- **Eratosthenes day:** at local noon around an equinox, measure a stick's shadow and compare with a partner city.

Results go into a real **"Earth" page in the Atlas**, with a badge for a sensible value. Players learn that the same physics works at home. ⚠️ Phone sensors are imprecise; present results as approximate and never mix them into scored runs.

### 5.5 Real data chapter ✅✅ · L
A chapter where the "telescope" shows **real public light curves** of transiting exoplanets (from Kepler or TESS). Players find the period and size of a **real planet**, inspired by EVE's Project Discovery. Same skills as the game, real universe.

### 5.6 Stargazer mode (cozy sandbox) ⚪ · S
No life support, no fuel, no score. You get the sky, all the tools, lessons, constellation drawing, photo mode and warp. It suits younger players, teachers demonstrating in class, and anyone who finds pressure stressful. ⚠️ Keep it separate from scoring and ranks.

---

## 6. Events tied to the real sky (a reason to come back, grounded in reality) ✅

| When | Real event | In-game event |
|---|---|---|
| Around **20 March** and **22–23 September** (equinoxes) | Eratosthenes Day (schools worldwide measure Earth's size; [EPS News](https://www.epsnews.eu/2014/09/following-in-eratosthenes-footsteps/)) | Eratosthenes week: shadow-route challenge, an Earth mission, a classroom leaderboard |
| **19 February 2027** | **Mars opposition** (Mars at about magnitude −1.2; a distant opposition with a 13.8″ disk; [Sky at Night](https://skyatnightmagazine.com/advice/skills/mars-opposition), [EarthSky](https://earthsky.org/astronomy-essentials/why-is-mars-sometimes-bright-and-sometimes-faint)) | **"Our own Solar System" scenario**: measure Earth and Mars with the game's tools, plus an Earth mission to watch Mars's real retrograde loop in early 2027. This is the game's core mechanic happening in the real sky. |
| **2 August 2027** | **Total solar eclipse** (about 6 min 22 s over Luxor; [Space.com](https://www.space.com/stargazing/solar-eclipses/where-will-the-eclipse-of-the-century-be-visible-on-aug-2-2027)) | Eclipse expedition: use eclipse timing and size like Hipparchus to measure a moon's distance |
| Monthly | A planet or moon event of the month | **Sky Night**: a one-evening themed challenge and photo contest, scheduled predictably like Community Days |

---

## 7. Guardrails: engagement without manipulation
Our audience includes teenagers, and the game's theme is honesty, so:
- **Never:** loot boxes, pay-to-progress, energy timers, fear-of-missing-out items you can only get once, or guilt-tripping notifications.
- **Streaks:** optional and forgiving, with freezes. Duolingo itself warns that fear of losing a streak can stop people starting ([Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit)).
- **Notifications:** opt-in and tied to *real* content ("Opposition in your save is tomorrow").
- **Telemetry:** only gameplay metrics, stored locally or anonymised, with an opt-in for playtest export. This matters even more for a school audience.

---

## 8. Measurement plan (to prove it works)

| Metric | Target for playtests | Why |
|---|---|---|
| **Time to first fun** (first prediction resolved, or first steady reading) | under 3 min | Most churn happens in the first session |
| Flight School funnel (per step) | No step losing more than 10% | Find confusing steps (Roblox-style funnel) |
| Players back the next day / after a week | at least 30% / 12% | Above the mobile and puzzle medians above |
| **Calibration rate** (truth inside ±1σ) | Rising toward ~68% across runs | Proves the honesty skill is being learned |
| **Prediction error** | Falling across a run and across runs | The clearest proof of learning |
| Run completion | Above 60% on Cadet | Checks pacing and dead time |
| Session-end reason | Logged | Shows where to add hooks |

Each new feature should be tested as an **A/B experiment** in playtest builds (for example, predictions on vs off) against these metrics.

---

## 9. Revised roadmap (replaces §11 of the first document)

Scores: Impact (I) and Effort (E) on a 1–5 scale; L = effect on learning and realism.

| Priority | Feature | I | E | L |
|---|---|---|---|---|
| **Now** | Predict → Observe → Explain cycles (§3.2) | 5 | 3 | ✅✅ |
| | Readiness meter in the HUD (first doc §2.3) | 4 | 1 | ✅ |
| | Open the game on the night sky + early first prediction (§2) | 4 | 2 | ⚪ |
| | Juice pack: sound, vibration, precision medals (first doc §3) | 4 | 2 | ✅ |
| | Name everything + Atlas system cards (§4.1, §4.5) | 4 | 2 | ⚪ |
| | Peak-end: launch drama + failure ending + re-plan option (§4.6) | 5 | 3 | ⚪/⚠️ |
| **Next** | Other measurement routes (§3.1), starting with Eratosthenes R₁ and the retrograde-rate P₂ | 5 | 4 | ✅✅ |
| | Expedition Rank ladder (§3.4) | 4 | 2 | ✅ |
| | Constellation drawing (§4.2) + Navigator's Journal PDF (§4.3) | 4 | 3 | ✅ |
| | Stargazer mode (§5.6) + Short expedition option | 3 | 2 | ⚪/⚠️ |
| | Weekly named expedition + leaderboard charts (small backend) | 4 | 3 | ✅ |
| **Later** | Observing-time planning puzzle (§3.3) | 4 | 3 | ✅✅ |
| | Co-op parallax (§5.2) · Classroom mode | 4 | 4 | ✅✅ |
| | Earth missions with phone sensors (§5.4) | 4 | 3 | ✅✅ |
| | Chapter campaign (first doc §2.2) + real data chapter (§5.5) | 5 | 5 | ✅✅ |
| | Real-sky events calendar (§6) starting with the **19 Feb 2027 Mars opposition** | 4 | 2 | ✅ |
| | Connection layer: supplies, preset tips, naming rights (§5.3) | 3 | 3 | ⚪ |

**Hard-mode rule (unchanged):** in Astronomer and ranked play, nothing may reveal the truth early, make readings more precise without skill, or skip a measurement. Assists, rewinds, Short expeditions and pre-known values belong to Flight School, Cadet, Stargazer and clearly labelled casual modes.

---

### Sources
Habgood & Ainsworth: [SHU](https://shura.shu.ac.uk/3556/), [Zombie Division](https://shura.shu.ac.uk/id/eprint/10652) · Cutting & Iacovides 2022: [White Rose](https://eprints.whiterose.ac.uk/189921) · Wouters et al. 2013: [Utrecht](https://research-portal.uu.nl/en/publications/a-meta-analysis-of-the-cognitive-and-motivational-effects-of-seri/), [e-teaching](https://www.e-teaching.org/materialien/literatur/wouters-van-nimwegen-van-ooostendorp-van-der-spek-2013) · Clark et al. 2016: [SRI](https://www.sri.com/publication/education-learning-pubs/digital-learning-pubs/digital-games-design-and-learning-a-systematic-review-and-meta-analysis-brief/) · Scaffolding meta-analysis: [Springer](https://link.springer.com/article/10.1007/s10648-021-09655-0) · Curiosity: [Golman & Loewenstein](https://www.cmu.edu/dietrich/sds/docs/golman/golman_loewenstein_curiosity.pdf), [DiGRA](https://dl.digra.org/index.php/dl/article/download/793/793) · Peak-end: [CHI 2016](https://dx.doi.org/10.1145/2858036.2858419), [GameTek](https://gametek.substack.com/p/colonoscopies-and-board-games) · Endowed progress: [Goal pursuit](https://en.wikipedia.org/wiki/Goal_pursuit), [UX Collective](https://uxdesign.cc/endowed-progress-effect-give-your-users-a-head-start-97d52d8b0396) · IKEA effect: [Harvard DASH](https://dash.harvard.edu/handle/1/12136084), [Wikipedia](https://en.wikipedia.org/wiki/IKEA_effect) · POE: [TU Delft](https://interactivetextbooks.tudelft.nl/showthephysics/Pedagogy/PoE.html), [NZCER](https://arbs.nzcer.org.nz/node/7187) · Juiciness: [CHI PLAY 2019](https://unpaywall.org/10.1145%2F3311350.3347171), [haptics](https://uwaterloo.ca/haptic-experience-lab/projects/juicy-haptic-design-vibrotactile-embellishments-can-improve), [audio](https://eprints.staffs.ac.uk/8527/1/3677084.pdf) · Retention: [GameAnalytics Q1'24](https://gamedevreports.substack.com/p/gameanalytics-benchmarks-in-mobile), [2025 report](https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf), [Segwise](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies.md) · Onboarding: [Bugnet](https://bugnet.io/blog/how-to-measure-player-time-to-first-fun), [Roblox](https://create.roblox.com/docs/production/game-design/onboarding), [devtodev](https://devtodev.com/resources/articles/how-to-analyze-first-player-session) · SDT: [Ryan et al. 2006](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf) · Heaven's Vault: [Game Developer](https://gamedeveloper.com/business/road-to-the-igf-inkle-s-i-heaven-s-vault-i-), [Slant](https://www.slantmagazine.com/games/heavens-vault-review/) · Slay the Spire: [Mechanics of Magic](https://mechanicsofmagic.com/2021/05/25/critical-play-is-this-game-balanced-slay-the-spire/), [PCGamesN](https://www.pcgamesn.com/slay-the-spire-2/ascension-levels) · Death Stranding: [CheatCC](https://www.cheatcc.com/articles/how-death-stranding-s-asynchronous-multiplayer-works/), [MP1st](https://mp1st.com/news/death-stranding-multiplayer-to-offer-asynchronous-gameplay-no-player-will-ever-cross-paths) · No Man's Sky: [Prima](https://primagames.com/tips/no-mans-sky-how-name-star-system), [Steam](https://steamcommunity.com/app/275850/discussions/0/3135044721708258965) · EVE Project Discovery: [CORDIS](https://cordis.europa.eu/article/id/413456-online-gamers-help-analyse-big-data-science), [CCP](https://www.ccpgames.com/news/2017/eve-online-gamers-to-join-in-exoplanet-search-through-scientific-collaboration), [PC Gamer](https://www.pcgamer.com/uk/eve-onlines-project-discovery-will-let-players-search-for-real-life-exoplanets) · KSP career: [forum poll](https://forum.kerbalspaceprogram.com/topic/179191-poll-whats-wrong-with-stock-science/page/2), [forum](https://forum.kerbalspaceprogram.com/topic/109910-career-mode-suggestion-from-a-new-player) · Pokémon GO: [Automaton](https://automaton-media.com/en/news/20220324-10815/), [esports.gg](https://esports.gg/guides/pokemon/every-pokemon-go-community-day-in-history) · phyphox: [arXiv](https://ar5iv.labs.arxiv.org/html/1804.06239), [App Store](https://apps.apple.com/app/phyphox/id1127319693) · Cozy games: [Utrecht thesis](https://studenttheses.uu.nl/bitstream/handle/20.500.12932/47430/Cozy_Games_Thesis-Leonardo_Trujillo%28final%29.pdf) · Real sky: [Sky at Night (Mars 2027)](https://skyatnightmagazine.com/advice/skills/mars-opposition), [EarthSky](https://earthsky.org/astronomy-essentials/why-is-mars-sometimes-bright-and-sometimes-faint), [Space.com eclipse 2027](https://www.space.com/stargazing/solar-eclipses/where-will-the-eclipse-of-the-century-be-visible-on-aug-2-2027), [Eratosthenes (EPS News)](https://www.epsnews.eu/2014/09/following-in-eratosthenes-footsteps/) · Duolingo: [blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
