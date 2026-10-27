# Stranded — Story bible

The story that runs through the prologue and all nine chapters (see [`DESIGN-V2.md`](DESIGN-V2.md) §7–8). This is the source of truth for characters, plot, tone and every scripted line. Lines that are already in the game are marked **(in game)**.

---

## 1. Rules for the story

1. **Every clue is a measurement.** The mystery is solved with the same tools as the navigation: periods, angles, parallax, orbits. No clue is ever "found a note that explains everything".
2. **The story never interrupts a measurement.** Scenes play at natural pauses: arrival, the end of an act, launch, landing.
3. **The story never gives away numbers.** No character ever says a value the player is meant to measure.
4. **One piece of fiction: the fold drive.** It moves the ship *between* star systems. Everything that happens *inside* a system is real physics.
5. **Written for adults, readable by teenagers.** Understated, dry, warm underneath. No exclamation-mark cheerleading, no baby talk, no villains twirling moustaches.
6. **Every scene can be skipped.** Skipped scenes stay readable in the Codex under *Logs*.
7. **Same story in every mode.** Only ECHO's *coaching* lines change with the mode; story lines don't.

---

## 2. The premise

**The Kestrel** is a small survey ship: a lander-sized hull built around an experimental **fold drive**, with four crew in cryo-sleep for the long legs and one navigator awake. That navigator is the player.

On its first long test fold, the drive **misfires**. The Kestrel drops out somewhere unknown, deep inside a star system, and comes down hard on the first planet it hits.

What still works:
- The hull, the heat shield and the engines.
- One fixed load of fuel.
- The cryo-pods.
- **ECHO**, the navigation intelligence, though most of its memory is corrupted.

What doesn't:
- The star catalogue.
- The long-range radio.
- The fold drive's navigation computer.

**The fold drive can be repaired, but not aimed blind.** It needs:
- parts, which the Kestrel doesn't carry;
- a **calibration**: precise measurements of the system it is folding *from*. Its star's mass, the planets' orbits, the ship's place in it.

**So the measurements you take are not just for the next flight; they are the drive's calibration for the next jump.** That's why every chapter starts again with a pendulum and a night sky.

**Why go to the blue planet?** On the first night ECHO picks up a faint, regular radio pulse from the blue planet. It is a **beacon**, of a design forty years old: the **Halcyon's**.

---

## 3. Characters

### The Navigator (the player)
- Never seen and never named by default (the player can name themselves; §DESIGN-V2 4.1). No gender; ECHO calls them "Navigator".
- Defined by what they *do*: careful, honest about their error bars. ECHO's respect grows with the player's calibration, not with their score.

### ECHO
- The Kestrel's navigation intelligence: precise, dry, quietly funny, honest to a fault about uncertainty.
- Starts damaged: short-term memory gaps, odd déjà vu (*"Hello again, Navigator"*, **(in game)**, said to someone it has never met).
- **Grows across the game:** each repaired memory block adds a capability (better predictions, voice quality, opinions) and a fragment of a memory that isn't the Kestrel's.
- **The secret (revealed in chapter 8):** ECHO's core was built from the navigation intelligence recovered from the Halcyon's first beacon. Its corrupted memories are the Halcyon's. It has been here before, with another navigator.

### Commander Ira Vale
- The Kestrel's commander, in cryo. **Her pod is failing**, which is why life support is limited.
- Wakes for a minute or two once per chapter, when ECHO risks a partial thaw to check her. Dry, tired, very good at her job, protective of the crew.
- She is the person the player is saving. She doesn't give orders about measurements ("You're the navigator. Navigate.").

### The sleeping crew
Three more pods: **Tomas Rhee** (engineer), **Ada Okoye** (medic) and **June Halverson** (geologist). Mostly asleep. Each wakes once in the campaign, at the chapter that needs their skill:
- Ada, when Vale's pod gets worse (chapter 4);
- Tomas, for the slingshot (chapter 7);
- June, for the ice (any chapter with fuel-from-ice).

### Mira Sato, navigator of the Halcyon
- The Halcyon vanished forty years ago on the same test route. Mira was its navigator.
- **She is never on screen.** We meet her only through her **journal**, found in the caches the Halcyon left in every system.
- She is the player's mirror: she did the same measurements with worse equipment, made mistakes, and wrote honestly about her error bars. Her entries are short, wry and human.
- Her journal is the emotional spine of the game. **Bringing it home is the ending.**

---

## 4. The plot, chapter by chapter

Each chapter has: the **cache** the Halcyon left (the reason to fly to the target), the **physics clue** (the mystery thread), **Mira's journal entry**, a **Vale wake-up**, and **ECHO's repaired memory**.

| # | Chapter | Why fly to the target | The physics clue | Mira's journal (theme) | Vale | ECHO gains |
|---|---|---|---|---|---|---|
| P | Fall | — | — | — | Pod alarm; she doesn't wake | Attitude control; voice |
| 1 | First Light | The beacon on the blue planet | A faint "star" that moves against the others. Its period shows it's **in orbit**: a dead Halcyon relay satellite | "Day 1. The sky is wrong and I'm the only one who can fix it." | First wake-up: "How long?" / "Long enough to measure a planet." | Predictions |
| 2 | The Silent Planet | Halcyon cache with fold-drive coils on the moonless planet | Your probe photographs debris in orbit; its **orbit decay** shows it has been there decades | On weighing a planet with a probe: "We threw our last probe at it. It came back with a number." | Asks about the crew; worried about Ada | Better tracking fits |
| 3 | Thick Air | Cache on the target; the drive needs its high-grade ice | A **stone cairn and stick** with scratched noon-shadow marks: someone did Eratosthenes here | "The air lies about the horizon. Use the sun instead." (her method is the player's new one) | Notices the player looks tired; jokes about the coffee | Refraction model |
| 4 | The Long Ellipse | The cache is at the target's farthest point; time matters | A recorded **star map** whose stars are slightly off. The shift is **proper motion**, which dates the map to about 40 years ago | Mira loses a crewmate here. The entry is short | Vale's pod worsens; **Ada wakes** and buys time | Ellipse fitting |
| 5 | Inward | The Halcyon's mid-route beacon orbits the inner planet | Timing a **transit** of the beacon's planet reveals the beacon's own orbit | "Inner planets never stand opposite the sun. You have to catch them at the edge." | Calm wake-up; asks the player about home | Elongation geometry |
| 6 | Red Dwarf | Cache on the locked planet's twilight band | A flare warning in the Halcyon log with **real flare statistics**; the player can check them | Mira writes about fear: the flares and the dark side | Brief; Vale is weaker | Flare forecasting |
| 7 | Slingshot | The drive needs a part from a cache too far for the fuel | Halcyon's route used the same slingshot; its old trajectory still predicts where its spent stage is | "We borrowed speed from a giant. I hope it didn't notice." | **Tomas wakes** to rebuild the drive | Multi-leg planning |
| 8 | Lost Among Stars | No target planet: the question is where *we* are | **Stellar parallax** of nearby stars: matched against Mira's final sightings | The last entries from deep space; she knows where home is | Vale asks ECHO directly what it is | **The reveal:** ECHO remembers being the Halcyon's nav AI |
| 9 | Home | Stranded on **Mars**; Earth is the target | Mira's final camp on Mars; her last measurement, finished by you | The final entry: addressed to "whoever reads this next, Navigator" | Vale's last wake-up before Earth | ECHO is whole |

### The ending (chapter 9, success)
1. The flight from Mars to Earth: the real planets, the player's own numbers.
2. Earth's blue limb, the entry glow, a landing the player flies.
3. Vale's pod opens in Earth gravity. She says one line (§5.4).
4. ECHO, with all its memory, says its last line: not a farewell but a navigator's report.
5. The final card: *"Halcyon journal — delivered."* Your values compared with NASA's real ones for Earth and Mars.

### Failure endings
Failure is part of the story, never a "Game Over" screen:
- **Flyby:** *"We passed close enough to see the clouds. Then we kept going."* ECHO counts what remains. Vale, if awake: *"Again, then. Better."*
- **Lost:** ECHO and the Navigator drift; ECHO reads out one of Mira's entries.
- **Air ran out:** ECHO puts everyone into deep cryo with the last power. *"Someone will find the beacon. Someone always finds the beacon."* This line is also the start of the Halcyon's story, which makes it land harder after chapter 8.

In modes with a rewind, the failure scene plays first, then the rewind offer.

---

## 5. Script samples

### 5.1 Prologue opening (DESIGN-V2 §9.1)
> *(alarms; tumbling stars)*
> ECHO: Fold exit — irregular. Spin rate high. Navigation… not found.
> ECHO: Controls are not responding. Don't fight it. Not yet.
> *(10 seconds)*
> ECHO: Attitude thrusters online. Navigator — stop the spin. Push against it, gently.
> ECHO: Good. We're falling toward the nearest planet. Better to fall on purpose. Point retrograde.

### 5.2 First night
> ECHO: Hello again, Navigator. *(pause)* I don't know why I said "again."
> ECHO: There's a pulse on the radio. Very regular, very old. It's coming from the blue planet.

### 5.3 A Mira Sato entry (chapter 1 cache)
> *Halcyon, navigator's journal. Day 63.*
> *Measured the year three times. Got three answers. Averaged them and wrote down an error bar I'm not proud of. It's honest, though. Honest is the only thing out here that doesn't run out.*

### 5.4 Vale's last line (chapter 9)
> VALE: Is that Earth?
> NAVIGATOR *(choice)*: "Within my error bars." / "Yes."
> VALE: *(either)* …Good enough for me.

---

## 6. Tone guide for ECHO (all modes)

| Do | Don't |
|---|---|
| Use numbers and units: "1.07 g. You'd weigh 7% more here." | "Wow, great job!!" |
| Admit uncertainty: "Probably. I'd want another night." | Pretend to know the truth |
| Dry humour, sparingly: "The pendulum doesn't care how you feel about it." | Jokes that mock the player |
| Short sentences | Lectures (that's what the Codex lessons are for) |
| Respect the player's choices: "Your call." | Nag or guilt |

**Coaching vs story:**
- *Coaching* lines (what to do next, "it's going backwards!") speak only in Stargazer, Cadet and Navigator. In Astronomer and Legend, ECHO does arithmetic and stays quiet **(in game)**.
- *Story* lines play in every mode.

### Reminders and notifications (your comment on guardrails)
You decided reminders in ECHO's voice are fine. They should stay **in character and adult**: specific, useful and calm, never pleading.

| Good | Avoid |
|---|---|
| "Opposition in 2 days. The blue planet will be as close as it gets. — ECHO" | "ECHO misses you 😢" |
| "Commander Vale's pod has 41 days left. The window opens in 38." | "Don't let Vale die!!!" |
| "Clear skies forecast tonight over camp. Good seeing." | "Come back now or lose your streak!" |

Reminders are opt-in, at most one a day, and always about something real in the player's save.

---

## 7. What is already in the game
- The opening ship log was rewritten to this story (the Kestrel, the fold drive, Commander Vale's pod and the Halcyon beacon) **(in game)**.
- ECHO's "Hello again, Navigator" welcome **(in game)**: the first hint of the chapter 8 reveal.
- ECHO's quiet welcome in Astronomer and Legend **(in game)**.
- Failure scenes in the debrief **(in game, short versions)**.

To write next: the full prologue script, every Mira Sato entry (about three per chapter), Vale's wake-ups, and ECHO's per-chapter repaired-memory lines.
