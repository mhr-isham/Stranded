# Stranded — Engagement & Gamification Review

*How to make players want to keep playing — and which ideas would cost us learning or realism.*

Legend used throughout:

| Mark | Meaning for learning / realism |
|---|---|
| ✅ | **Strengthens** the learning or the realism |
| ⚪ | Neutral — pure fun, presentation or motivation |
| ⚠️ | **Compromises** learning or realism → keep it out of hard modes (or only in Flight School / Cadet / a clearly labelled sandbox) |

Effort: **S** ≈ a day, **M** ≈ a few days, **L** ≈ a week or more.

---

## 1. Honest audit of the game as it stands

What already works (keep and build on):

- **A real "aha" chain.** Twinkle test → retrograde loop → parallax jump → Kepler → launch. Each step is a genuine discovery, the same way Outer Wilds makes *knowledge* the only real progression ([review](https://gamegeeker.com/de/games/outer-wilds/review?market=DE), [SFRA Review](https://sfrareview.org/wp-content/uploads/2020/12/50.4.32.pdf)).
- **The constellation sheet** works as a visual "rumour map" of what you know. It is our most distinctive screen ([essay on the Ship Log](https://archania.org/p/the-symbolic-world/symbolic-works/video-games/outer-wilds)).
- **Honest-error scoring** (log score) is unusual and valuable. It is exactly what calibration games such as Critch's Credence Game train ([acritch.com](https://acritch.com/credence)).
- **Productive failure.** Bad numbers make the launch fail in a way you can explain. Kapur's research says struggling before instruction deepens learning ([Kapur PF overview](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-productive-failure-kapor.pdf)).
- **Flight School** onboards beginners, and fresh seeds plus the daily system give replay.

Where players will drift away (the problems this review targets):

| # | Problem | Why it hurts engagement |
|---|---|---|
| P1 | **One long run, one verdict at the end.** A careful run takes 60–120 min and the truth is revealed only after launch. | Feedback is delayed for an hour or more. Failure at minute 90 feels like wasted time instead of a lesson. |
| P2 | **Every run is the same nine measurements in the same order.** | The second and third runs feel like chores. Mars Horizon draws the same criticism, that repetitive gameplay stops replays ([Mars Horizon page/reviews](https://www.gog.com/game/mars_horizon)). |
| P3 | **Passive waiting.** Warping months to the next opposition is watching, not playing. | It creates dead time, and that is when people close the tab. |
| P4 | **Almost nothing carries over between runs** (achievements only). | There is no reason to come back once you've "won" once. |
| P5 | **Thin story and stakes.** ECHO is helpful but has no arc, and there is no one to save and no mystery. | Players don't attach to anything. |
| P6 | **Players don't feel connected to each other.** There is a share card, but no leaderboard, no friends and no comparison. | There is no social pull or bragging loop. |
| P7 | **No payoff moment.** Arrival is a line of text; there is no landing, no new world, no photo. | The emotional climax is missing. |
| P8 | **Little "juice" in tools** (sound, haptics, feel). | The tools feel like forms rather than instruments. |

The recommendations below are organised by the three needs that self-determination theory links to sustained play: **competence, autonomy, relatedness** ([Ryan, Rigby & Przybylski 2006](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf); [PENS](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)). They are also checked against the motivation clusters that real player populations split into (discovery, mastery, completion, story, social, creativity…) ([Quantic Foundry](https://quanticfoundry.com/)).

---

## 2. The big ideas (highest impact)

### 2.1 "Call your shot": predictions as a core mechanic ✅ · M

**What:** At key moments the game asks you to **commit to a prediction from your own numbers before the sky reveals it**:
- "When will the next opposition happen?"
- "Where will the blue planet be against the stars in 30 days?"
- "When will the moon reach greatest elongation?"
- "How long until sunrise?"

You place a marker or enter a date, warp, and the sky shows how close you were. Points scale with accuracy, and an honest ± earns a bonus.

**Why:** It fixes P1 and P3 together. Feedback arrives every few minutes instead of once per run, and warping becomes a tense *reveal* instead of dead time. It is the scientific method as a game loop: model → predict → test. Every prediction exercises the player's own model, so it **teaches**, and it never leaks the truth before you commit.

**Realism:** fully realistic. This is how astronomy actually validated Kepler and Newton.

### 2.2 A campaign of star systems, each teaching one new idea ✅ · L

Replace "the same system with new numbers" (P2) with a **chapter structure**, like Celeste's chapters each built around one new mechanic. Each new system adds **one** twist:

| Chapter | Twist | New thing learned |
|---|---|---|
| 1 | Current game | The full chain |
| 2 | **No moon** on the blue planet | Estimate M₂ from density and analogy, with honestly *wider* error bars; uncertainty you can't measure away |
| 3 | **Thick atmosphere** | Refraction lifts the horizon, so the hill gives a biased R unless you correct it; systematic error |
| 4 | **Eccentric orbits** | The year still works but distances change; why Kepler's first law matters |
| 5 | **Inner target planet** | Elongations instead of oppositions; transit parallax (the doc's original route) |
| 6 | **A third planet** | A gravity assist slingshot as an optional fuel saver |
| 7 | **Red-dwarf star** | Short year, flares in survival mode, a tidally-locked world |
| 8 | **Binary star** | Two suns in the sky; the barycentre |

Each chapter brings a new lesson card, new codex history (Brahe, Halley, Herschel…) and a new achievement set. Free-play "random system" stays for replay.

**Realism:** all of these are real physics. Each needs engine work, but the generator, solver and validator approach already supports adding them.

### 2.3 Mission readiness meter: earlier, honest feedback ✅ · S

We already run a Monte-Carlo "chance of success" in the launch planner. **Show it from day one** as a HUD gauge: "If you launched on today's numbers, ECHO estimates a 23% chance of reaching orbit." Every measurement visibly moves the needle.

It uses only the player's own values and error bars, never the truth, so it is realistic. It also teaches that a vague estimate (big ±) lowers readiness, and *why* each measurement matters.

### 2.4 Give the player someone to save, and a mystery ⚪ (✅ if clues are physics) · M–L

Fixes P5. Two threads:
1. **Stakes:** one crew member is in a damaged cryo-pod and wakes for short conversations at milestones. They ask about the sky and react to your discoveries. This gives a *person* to bring home and a reason for the life-support clock beyond a number.
2. **Mystery:** why did the jump drive misfire *here*? ECHO's memory restores fragment by fragment as you complete chapters, the way Hades makes each return to the hub advance the story ([analysis](https://www.summerengine.com/templates/rpg/action-rpg/hades-style)). Make the clues **physical**: an unexplained regularity in the moon's orbit, a radio burst timed to opposition, an artificial satellite caught in the micrometer. Players solve them with the same tools, so the story *rewards* measuring.

**Watch out ⚠️:** keep the mystery out of the measurement physics. No alien tech that changes g or orbits. The sky must stay honest.

### 2.5 The arrival you earned ⚪ · M

Fixes P7. After a successful capture:
- A **descent and landing** sequence through the blue planet's atmosphere, using the heat-shield angle you choose (an "entry corridor" too steep or too shallow).
- Then a **first look at the new world**: oceans, the home star now smaller in the sky, and *your* home planet as a reddish dot.
- **Photo mode** for this view and for any sky view.
- An epilogue card that changes with grade, fuel left, crew status and choices.

**Realism:** a real entry-corridor model is simple (flight-path angle vs heating/skip-out) and adds learning ✅. Keep it out of scoring if it stays a cinematic.

### 2.6 Calibration profile across runs ✅ · S–M

Make **honesty** the headline stat, because it is what this game teaches that nothing else does.
- After every run, plot "how often the truth fell inside your ±" against the ideal 68%. Across runs this builds a **calibration curve**, as in credence/calibration training ([Credence Game](https://acritch.com/credence), [LessWrong report](https://www.lesswrong.com/posts/e9x6TKESmwCDToTcv)).
- Titles follow: "Over-confident Cadet" → "Honest Navigator" → "Calibrated Astronomer".
- This gives long-term mastery and identity (P4) without inflating difficulty.

---

## 3. Moment-to-moment fun ("juice") ⚪ · S each

Small things that make tools feel like instruments (P8):

- **Sound per tool:** the pendulum creak and tick, the theodolite click detents, the telescope drive whir, the rover radio blip, and the stopwatch beep.
- An **adaptive ambient score** that swells at dusk, at retrograde and at launch.
- **Haptics on phones** (Vibration API): a tick on each counted swing, a bump when the instrument hits a scale division, and a rumble at launch.
- **Precision medals per reading**, judged against the *player's own spread*, never against the truth (so nothing leaks):
  - ◆ steady: the reading is within your scatter;
  - ◆◆ sharp: you have halved your scatter;
  - ◆◆◆ textbook: at the instrument's limit.
- **Constellation ignition:** when a star lights up on the sheet, lines draw in and the LAUNCH node pulses brighter as readiness grows.
- **Camp life:** the camp changes as you progress (repaired antenna, greenhouse growing, rover tracks, tally marks on the ship). The hub becomes a visual record of your expedition.
- **Time-lapse sky toggle** while warping: star trails, the planet's loop drawn live on the sky, and moon and planet glints.

---

## 4. Turning waiting into playing (fixes P3)

| Idea | Learning/realism |
|---|---|
| **Predictions** during every long warp (§2.1) | ✅ |
| **Sky events worth stopping for:** meteor showers, the moon of the blue planet passing behind it (an *occultation*, a bonus timing for Pₘ), conjunction glare, aurora | ✅ if events are real astronomy |
| **"Wake me when…" alarms:** "at the next stationary point", "at dusk", "when the rover arrives". Warp is fast but stops at the interesting moment | ✅ (teaches what matters) |
| **Side measurements:** sidereal vs solar day, latitude from the pole star, rotation period from star trails. Optional, they feed **consistency checks** | ✅ |
| **Survival chores** in survival mode (already built) as short, decision-heavy interrupts | ⚪ |

**Avoid ⚠️:** filler mini-games unrelated to astronomy (e.g. a reaction-time arcade game). They break the doc's principle that "the player's skill is choosing the event, not winning a click race".

---

## 5. Replay & progression (fixes P2, P4)

| Idea | Effort | Player type | Learning/realism |
|---|---|---|---|
| **Challenge levels**: bite-size puzzles (2–5 min), e.g. "Measure g within 0.2% in 3 tries", "Find the planet before dawn", "Get R₁ from only the boulder field". Three-star ratings | M | mastery, completion | ✅ |
| **Efficiency histograms** after each challenge: where your precision, days used and fuel left sit among other players, as in Zachtronics games ([Zachtronics](https://en.wikipedia.org/wiki/Zachtronics), [Opus Magnum discussion](https://forum.quartertothree.com/t/opus-magnum-from-zachtronics-of-spacechem-infinifactory-fame/132014/35)). Players replay to climb | M (needs small backend) | mastery, competition | ✅ (use the log score, not raw accuracy) |
| **Mission modifiers** (roguelite style): "Broken stopwatch (±0.3 s)", "Rover limited to 1500 km", "Half life-support", "Cloudy season". Each multiplies the score | S–M | mastery, novelty | ✅ (they're realistic constraints) |
| **Blind / NG+ mode**: no formula sheet, no auto-fit; you fit the year drift and the moon wave yourself | M | mastery | ✅✅ |
| **Codex completion & history cards** for every chapter, with "first measured by…" scientists | S | completion, discovery | ✅ |
| **Ship & camp cosmetics** (paint, flags, ECHO avatar colours) from achievements | S | creativity, completion | ⚪ |
| **Tool upgrades that carry between runs** (better lens, tripod, longer rover range) | S | progression | ⚠️ They make later runs easier, which hides skill. Make them **side-grades or time-savers** (e.g. faster climbing), never better precision, or turn them off in Astronomer / ranked play |
| **ECHO memory fragments** (§2.4) as the meta-progression spine | M | story | ⚪ |

---

## 6. Social, sharing & relatedness (fixes P6)

| Idea | Effort | Learning/realism |
|---|---|---|
| **Name your system** (star, planets, moon). Names appear on the sheet, share card and debrief: ownership and attachment | S | ⚪ |
| **Better share card**: a spoiler-free emoji grid (already in) plus an image card with your constellation, grade and named system. The Wordle lesson: shareable, spoiler-free, the *same puzzle for everyone* ([analysis](https://dinogame.gg/blog/why-wordle-blew-up/), [growth figures](https://www.aol.com/news/wordle-brought-tens-millions-users-150000203.html)) | S | ⚪ |
| **Weekly expedition**: one seed per week, with a global leaderboard and histograms. Needs a tiny serverless store (e.g. a Cloudflare Worker + KV) and no sign-in, just a nickname | M | ✅ (score = log score + fuel) |
| **Challenge a friend**: a link with a seed and your result ("beat my calibration on system *Aurelia*") | S | ⚪ |
| **Two-player co-op parallax**: one player at camp, one with the rover, each imaging at the same instant on their own device, then combining the measurements. It mirrors Cassini & Richer, and the real Eratosthenes school project pairs schools so each needs its partner's measurement ([eTwinning project](https://school-education.ec.europa.eu/en/etwinning/projects/eratosthenes-2024/twinspace/pages/general-evaluation)) | L | ✅✅ |
| **Classroom mode**: a teacher sets a seed; students' results gather in a class histogram; results can be exported as CSV. A natural fit for the international Eratosthenes Experiment community ([EPS News](https://www.epsnews.eu/2014/09/following-in-eratosthenes-footsteps/)) | M–L | ✅✅ |
| **Ghost data**: after you finish, see where other players marked the opposition or set the wires | M | ✅ after finishing. ⚠️ during a run it leaks answers, so never show it before submission |

---

## 7. Retention without dark patterns

| Idea | Note |
|---|---|
| **Daily system streak** with a gentle "streak freeze" | Duolingo reports streaks plus freezes help habit formation, but also warns that fear of losing a streak can stop people starting at all ([Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)). Keep it optional and forgiving; don't guilt-trip. ⚪ |
| **PWA install + offline play**, plus optional reminders ("The blue planet reaches opposition tomorrow in your save") | ⚪ |
| **Resume-anywhere saves + "Previously on…" recap** when you return after days away | ⚪; it reduces drop-off on long runs |
| **Session-sized chapters**: always end a sitting at a satisfying point ("Year measured ✓") | ⚪ |
| **Never**: loot boxes, paid boosts, energy timers | They contradict the game's honesty theme |

---

## 8. Accessibility & difficulty (all players)

Celeste's Assist Mode shows you can widen access while still saying "difficulty is essential" and recommending first-timers try without it ([analysis](https://blogs.tuni.fi/playlab/features/too-steep-a-hill-to-die-on-celeste-assist-mode-and-accessibility/), [New Normative](https://newnormative.com/2018/01/25/celestes-assist-mode-brings-welcome-accessibility-options)).

| Assist | Learning/realism |
|---|---|
| Larger reticles and touch targets; colour-blind palettes; dyslexia-friendly font; reduced motion | ⚪ |
| Text-to-speech for ECHO; captions for all sounds | ⚪ |
| **Swing auto-counter** (taps for you) | ⚠️ It removes the reaction-time lesson. Allow it, but mark runs "assisted" and exclude them from ranked play |
| **Hand-sway off** on the hill | ⚠️ Same: assisted runs only |
| **Slower real-time** for the pendulum (0.5×) | ⚠️ minor, as above |
| **Bigger fuel margin / longer life support** sliders | ⚠️ Cadet only |

The rule: **assists change how hard it is to act, never what the sky does.** Physics, truth and scoring rules stay identical, and ranked or Astronomer play uses no assists.

---

## 9. Ideas to avoid or restrict (they cost learning or realism)

| Tempting idea | Problem | If you still want it |
|---|---|---|
| Random noise added to measurements "for variety" | Breaks the core principle: error should come from *how you use the tool* | Never. Use realistic modifiers (a worn stopwatch, wind sway) that players can *see and counter* |
| Instant "is this right?" checks that reveal the truth | Kills the honesty loop and calibration | Keep the costly ECHO verify, Obra Dinn-style batch confirmation ([rule of three](https://filmstories.co.uk/?p=83249)) only in Cadet/Navigator, and disable it in Astronomer |
| Upgrades that improve precision permanently | They replace skill with grinding | Side-grades only, or turn them off in ranked/Astronomer |
| Combat, aliens that alter physics, warp drives as gameplay | Breaks realism | Keep sci-fi only as framing (the crash), never in measurement or flight physics |
| Reaction-time arcade scoring | Rewards click speed, not judgement (contradicts the design doc) | Only the pendulum, where reaction time *is* the physics lesson |
| Leaderboards ranked on raw accuracy | Rewards lucky guesses and over-tight error bars | Rank by the **log score** (honesty-aware) plus fuel left |
| Showing other players' answers during your run | Leaks the answer | Only after you submit |
| Auto-fits / "Do it for me" outside Flight School | Removes the learning | Keep them in Flight School; the Cadet fit stays but with the player choosing the data |
| Overly long cinematics | Pacing | Always skippable |

---

## 10. What to measure (so we know it works)

Measure this with local telemetry now, and in playtests with BDOAA/NDMC/ROC:
- **Flight School funnel:** the step where people quit (we already have step IDs).
- **Run completion rate** and **minutes to first launch**.
- **Day-1 / day-7 return** (the share of players who come back on the next day / within the next week; PWA or local timestamp).
- **Calibration rate:** the share of entries inside ±1σ (should rise across runs).
- **Prediction accuracy** over time (should rise) — the clearest proof of learning.
- **Session length** and where warps are abandoned (dead-time hot spots).

---

## 11. Recommended roadmap

| Phase | Contents | Why first |
|---|---|---|
| **Next (1–2 weeks)** | §2.1 Predictions · §2.3 Readiness meter · §3 juice pack (sound, haptics, precision medals) · name your system + share image · §2.6 calibration profile | Biggest fix to feedback delay and dead time for small cost; all ✅ or ⚪ |
| **Then** | §2.5 landing + photo mode · §2.4 crew and ECHO memory arc · challenge levels with three-star ratings · mission modifiers · assists | Payoff, story and replay |
| **Later** | §2.2 campaign chapters (moonless, refraction, eccentric, inner target, assist, red dwarf, binary) · weekly leaderboard and histograms (small backend) · co-op parallax · classroom mode | The largest effort; turns Stranded into a series |

All of the "Next" items **reinforce** the learning goals. None of them touches the honesty of the physics.

---

### Sources consulted

- Outer Wilds Ship Log / knowledge progression: [GameGeeker review](https://gamegeeker.com/de/games/outer-wilds/review?market=DE), [SFRA Review](https://sfrareview.org/wp-content/uploads/2020/12/50.4.32.pdf), [Archania essay](https://archania.org/p/the-symbolic-world/symbolic-works/video-games/outer-wilds), [Steam discussion](https://steamcommunity.com/app/753640/discussions/0/2965021152086588671)
- Kerbal Space Program & failure: [Substack "explosions are great"](https://1517.substack.com/p/explosions-are-great-actually), [ScreenWise parent guide](https://screenwiseapp.com/guides/the-parents-guide-to-learning-real-rocket-science-through-ksp), [KSP forum](https://forum.kerbalspaceprogram.com/topic/42206-fails-turning-into-success)
- Zachtronics histograms: [Wikipedia](https://en.wikipedia.org/wiki/Zachtronics), [Quarter to Three](https://forum.quartertothree.com/t/opus-magnum-from-zachtronics-of-spacechem-infinifactory-fame/132014/35), [Kaizen review](https://gamecritics.com/ben-schwartz/kaizen-a-factory-story-review/)
- Wordle: [AOL/TechCrunch](https://www.aol.com/news/wordle-brought-tens-millions-users-150000203.html), [dinogame.gg](https://dinogame.gg/blog/why-wordle-blew-up/)
- Productive failure: [Kapur overview (UNH)](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-productive-failure-kapor.pdf), [Bold Science interview](https://boldscience.org/we-can-take-this-powerful-mechanism-and-deliberately-design-it-to-learn)
- Hades meta-progression: [Summer Engine analysis](https://www.summerengine.com/templates/rpg/action-rpg/hades-style), [GameGeeker review](https://gamegeeker.com/games/hades/review?market=US)
- Calibration: [Credence Game](https://acritch.com/credence), [LessWrong](https://www.lesswrong.com/posts/e9x6TKESmwCDToTcv)
- Motivation research: [Ryan, Rigby & Przybylski 2006](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf), [PENS](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/), [Quantic Foundry](https://quanticfoundry.com/)
- Celeste Assist Mode: [Tampere PlayLab](https://blogs.tuni.fi/playlab/features/too-steep-a-hill-to-die-on-celeste-assist-mode-and-accessibility/), [New Normative](https://newnormative.com/2018/01/25/celestes-assist-mode-brings-welcome-accessibility-options)
- Obra Dinn confirmation: [Film Stories](https://filmstories.co.uk/?p=83249), [Hardcore Gaming 101](https://www.hardcoregaming101.net/return-of-the-obra-dinn/)
- Duolingo streaks: [Duolingo blog](https://blog.duolingo.com/how-duolingo-streak-builds-habit)
- Space-game comparisons: [Juno: New Origins (Steam)](https://store.steampowered.com/app/870200), [Mars Horizon (GOG)](https://www.gog.com/game/mars_horizon)
- Eratosthenes school project: [eTwinning 2024 evaluation](https://school-education.ec.europa.eu/en/etwinning/projects/eratosthenes-2024/twinspace/pages/general-evaluation), [EPS News](https://www.epsnews.eu/2014/09/following-in-eratosthenes-footsteps/)
