# Stranded — Design v3: the camp, the rover, the ship and the fuel

This document is a deep dive into everything the player does with their hands: driving the rover, towing the camp, flying the ship (intro, landing, hops, launch, orbits, landing on the blue planet), and the fuel, power and ice that pay for all of it. It answers one question: **how do we make these parts more fun without breaking the learning?**

It builds on [`DESIGN-V2.md`](DESIGN-V2.md) §9 (flying) and §10 (the surface). Where they disagree, **this one wins** for those sections. The ground rules of v2 §1 still hold:
- the physics is the same in every mode;
- modes change **help, scope and pressure**;
- flying must never be a way around bad measurements (v2 §9.4).

Contents:
1. What is in the game today, with real numbers
2. What other games do well (and what we take from each)
3. The big idea: a camp that runs on energy, water and propellant
4. Fuel systems: four tanks and the valves between them
5. Ice: many deposits, mined, hauled and processed
6. Power: the camp grid, the rover battery and the fuel cell
7. The rover: driving that asks for skill
8. Towing the camp
9. Moving the camp by air: hops and long relocation flights
10. The ship: intro, landing, launch, orbit, transfer and arrival
11. Making it a game: goals, scores, medals and stories
12. Every number, by mode (the balance sheet)
13. Risks and counter-arguments
14. Roadmap
15. Sources

---

## 1. What is in the game today, with real numbers

I measured these from the code. System figures come from 30 generated systems per mode (10th–50th–90th percentile), the same method as v2.

### 1.1 The facts

| | Stargazer | Cadet | Navigator | Astronomer | Legend |
|---|---|---|---|---|---|
| Surface gravity g (m/s²) | 8–10–12 | same | same | same | same |
| Total ship fuel (km/s of Δv) | 19–22–25 | 17–19–22 | 15–18–20 | 14–17–19 | 14–16–18 |
| **Spare** fuel above the ideal trip (m/s) | 4900–6700–8600 | 2900–4000–5200 | 1700–2400–3000 | 980–1350–1730 | 730–1010–1300 |
| Most fuel ice can add (m/s) | 1950–2700–3460 | 1170–1620–2070 | 430–590–760 | 150–200–260 | 70–100–130 |
| … in 100 m/s loads | 20–27–35 | 12–16–21 | 4–6–8 | 1–2–3 | 1 |
| Days per load | 1 | 2 | 3 | 4 | 5 |
| **Life support** (days) | 965–1460–1880 | 860–1310–1670 | 800–1220–1550 | 760–1160–1480 | 750–1140–1450 |
| A well-flown 5 km hop (m/s) | 1080–1200–1360 | same | same | same | same |
| … as a share of spare fuel | 14–19–25% | 23–31–42% | 40–53–71% | **70–93–125%** | **94–124–167%** |
| Hop tank (m/s), refill | 6000, nightly | 4000, nightly | 2200, over 3 days | 1400, from ice | none: launch fuel |

Other current values:
- **Rover:** 15 km/h, 120 km per charge. It recharges at camp at 10 km of range per hour (full in 12 h), always, from nowhere. Slopes slow it and drain the battery faster.
- **Towing:** 2 km/h. It is only a timer, with no energy cost and no driving.
- **Ice:** **one** ice field, always 7–9 km west of the landing area.
- **Map:** runs ±40 km, but the plain, ice field and hill all sit within ±10 km. Finds are scattered out to ±37 km.
- **The long-trip rover** (chapter 3 north–south trip, rover parallax) is a **separate system**. It drives 400 km a day (700 with the survival upgrade) and has no battery at all.
- **Flight after launch** is a **cutscene**: five text stages over an animated map. The player makes no decisions between the ascent and the landing.
- **Landing on the blue planet** reuses the prologue descent, with a beacon on flat ground.
- **Survival mode:** oxygen, food and power (%) are tracked. Oxygen is **not** connected to the ice or the fuel plant at all.

### 1.2 What this tells us

1. **Time is almost free on the surface.** Life support lasts 2–5 years, because the measuring chapters need many months of sky. Every surface action (a drive, a tow, a load of ice) costs hours to a few days, which is under 1% of the time left. So v2 §10.3's "time-versus-fuel trade-off" barely exists today. **Shortening life support is the wrong fix**: the astronomy needs the months, and you asked that play time not be limited. The right fix is to make **energy and daylight** the surface currencies (§3, §6). Days are long; sunlight on a given day is not.
2. **Ice is a button you press up to 27 times.** In Stargazer the cap is about 27 loads, one click and one day each. That is a chore, not a game.
3. **Hops are unaffordable in the two hardest modes.** v2 §10.2 assumed a 5 km hop costs 0.4–0.5 km/s, which is the textbook impulsive figure. The real flown cost, measured in the hop trials, is about 1.2 km/s, roughly three times more. In Legend, where hops burn launch fuel, a 5 km hop costs **more than all the spare fuel** in most systems. In Astronomer, once the 1400 m/s tank is empty, the same is nearly true. A hop in those modes is not a "careful decision"; it ends the run. This needs fixing (§4).
4. **The rover battery never matters.** The range is 120 km on an 80 km map, and charging is free and always on. Slopes drain more, but you can never get into real trouble.
5. **Two rovers disagree.** The surface rover has a battery; the long-trip rover drives 400 km a day without one. They should be the same machine (§7.6).
6. **Towing and processing are timers**, and flight after launch is a cutscene. These are the biggest "nothing to do" gaps.
7. **Good bones:** the descent physics, the hop autopilot, the fuel accounting for hops, the slope-aware rover drive and the separate hop tank are solid. Everything below builds on them.

---

## 2. What other games do well (and what we take from each)

| Game | What it does well | What Stranded takes |
|---|---|---|
| **Kerbal Space Program** | ISRU: drills, ore and converters that need lots of electricity and must shed heat. Ore concentration differs by place, so *where* you mine matters. Resource panels show every tank. SAS hold modes (prograde, retrograde, kill rotation). Maneuver nodes with a burn timer. | Ice deposits that differ in richness and depth. Processing limited by **power**. A clear tank panel with valves. Hold modes on the ship by difficulty. A burn bar for the transfer burns. |
| **Spaceflight Simulator** (mobile) | Simple 2D flight that teaches orbits on a phone; rovers that act as mobile fuel stores. | Keep everything 2D and phone-first. The rover can carry a small fuel-cell canister. |
| **Astroneer** | Vehicles get power from batteries or towed trailers; rovers form **trains**, and a towed vehicle's battery is shared with the tug. A winch tows what can't be tethered. | When the rover tows the camp, it draws on **the camp's own battery bank** through the hitch. A **winch** for slopes the wheels can't climb. |
| **Space Engineers** | Ice → O₂/H₂ generator → oxygen for breathing **and** hydrogen for thrusters, from one machine. The output *rate* limits what you can run. | One electrolyser feeds **both** air and fuel. Its rate, set by power, is the bottleneck. |
| **SnowRunner / MudRunner** (truck sims) | Terrain is the opponent: soft ground, traction, low gear, momentum, winching to anchors. Planning the route is half the game. | Gears (low = strong, high = fast), soft sand where you keep a steady throttle, boulder fields where you go slow, a winch, and towing that changes how the rover handles. |
| **Lunar Lander** (Atari, 1979) | Landing pads with score multipliers; fuel left is points. The whole game is one tense minute. | Landing pads and score rings for hops; medals for softness, precision and fuel. |
| ***The Martian*** (novel and film) | Survival through planning: extra batteries, solar panels laid out at each stop, an RTG for heat, oxygen and water as one chemistry problem. | Long trips are **expeditions**: charge stops, a fuel cell as the "RTG-like" boost, and air coming from the same water as fuel. |
| **Real hardware** | Apollo LRV: about 13 km/h, roughly 9 kWh of batteries, 92 km range. Curiosity: about 4 cm/s, about 100 W from its RTG, 29 m per sol on average. MOXIE: 6–10 g of O₂ per hour, limited by rover power. NASA's planned fission surface power unit: about 40 kW. Water electrolysis: about 50 kWh per kg of hydrogen (plus 8 kg of oxygen). NASA's Mars hopper study: hops of 2–15 km every 30–60 days on in-situ fuel. | Real anchors for every number in §12, so the balance sheet is **honest**, not invented. |

What we deliberately **don't** take:
- **Rocket building** (v2 decision).
- **Base building with dozens of parts.** Stranded is about measuring; the camp should stay one screen.
- **Fuel pickups or magic engine upgrades** (v2 §9.4).

---

## 3. The big idea: a camp that runs on energy, water and propellant

Today each surface system has its own invented currency: "km of range", "loads", "m/s". The proposal is **one small, real economy**, shown on one camp panel:

```
   sunlight / reactor ──► ENERGY (kWh) ──► rover battery ──► driving, towing, drilling
                               │
   ice deposits ──► WATER (kg) ┴─► ELECTROLYSER ──► H₂ + O₂
                                                  │
                         ┌────────────────────────┼─────────────────────┐
                         ▼                        ▼                     ▼
                    HOP TANK                MAIN TANKS          SPARE OXYGEN
                 (hops, relocation)     (launch: capped by mode)  (breathing air)
                         │
                         └──► FUEL CELL ──► energy (fast, lossy) ──► rover
```

Why this is better:
- **It is true.** Every arrow is real chemistry. Splitting water gives hydrogen and oxygen. A hydrogen–oxygen engine burns them at about 6 kg of oxygen per kg of hydrogen, but water holds 8 kg of oxygen per kg of hydrogen. So **making fuel from water always leaves oxygen over**: each tonne of water gives about 220 kg of spare oxygen, roughly **260 days of air for one person**. This is a lovely fact to teach, and it ties survival to the fuel plant for free.
- **Decisions come from bottlenecks**, not from timers:
  - energy (how much sun today, how big the battery);
  - water (which deposit, how far, how pure);
  - where to send the product (hop tank, main tanks or air).
- **Day and night start to matter**, which fits an astronomy game perfectly:
  - by day you drive, mine and process on solar power;
  - by night you observe and the camp runs on its batteries.
  - A *sol plan* ("drive to the ice this morning, back by sunset, observe tonight") becomes the natural rhythm of play.
- **The easy modes stay easy.** The numbers in §12 are tuned so Stargazer and Cadet rarely hit a limit. When they do, ECHO suggests the fix. You asked that easy modes let players hop without fuel worry; that promise is kept by the size of the allowances, not by removing the system.

---

## 4. Fuel systems: four tanks and the valves between them

### 4.1 The tanks

| Tank | What fills it | What uses it | Notes |
|---|---|---|---|
| **Main tanks** | Loaded at the start (the mode's fuel allowance), plus plant top-ups up to the mode's cap | Launch, transfer, corrections, capture | **The measurement chain lives here.** Its cap protects v2 §9.4. |
| **Hop tank** (landing thrusters) | The mode's allowance (§12), **plus the plant, uncapped** | Hops and relocation flights | Can never feed the main tanks, so it can never rescue a bad launch plan. |
| **Plant buffer** | The electrolyser | Pumped to hop or main tanks by the player | Holds a few tonnes. In the hard modes the hydrogen slowly boils off (§4.3). |
| **Oxygen store** (survival) | Spare oxygen from the plant | Breathing | Only shown with survival on. |

### 4.2 The valves (the one new decision)

One small panel on the camp screen, like KSP's resource panel but with only three switches:

1. **Plant → hop tank / main tanks / oxygen.** A three-way slider; the default is set by mode. The main-tank share stops at the mode's cap; past that, the slider greys out with one line from ECHO: *"The main tanks are at the limit this mission allows. More ice can still fill the hop tank or the air store."*
2. **Main → hop crossfeed.** **Closed by default.** Opening it shows the real cost: *"This lets hops burn launch fuel. A 5 km hop takes about 1.2 km/s, which is 90% of our spare."* This replaces today's automatic launch-fuel draw in Astronomer, so no one loses a run by accident.
3. **Hop tank → fuel cell → rover.** A charge button on the rover (§6.3).

There is **no hop → main valve**. That is the guardrail: the plant can pay for exploring without limit, but only up to the cap for the flight home.

### 4.3 Small realities that make the tanks feel alive

- **Boil-off** (Navigator and up). Liquid hydrogen slowly warms and escapes; real cryogenic stages lose a small share per day. In the game the plant buffer loses about 0.5% a day in Navigator and 1% in Astronomer and Legend; the ship's insulated main tanks lose nothing. This gives stockpiling a cost and makes "use it soon" a real reason to plan. It is off in Stargazer and Cadet.
- **Dust on solar panels** (survival). Panels lose a little power each sol, and dust devils clean them now and then. Both happened to the Spirit and Opportunity rovers. Cleaning them is a short task.
- **Fuel shown in two units.** The ship's tanks show m/s (as the launch planner already does). Water, oxygen and the plant show kg. The conversion is shown honestly: the Kestrel masses about 35 t, so with a hydrogen–oxygen engine (exhaust speed about 4.4 km/s) **1 t of water ≈ 100 m/s**. That matches today's 100 m/s "load", so the current balance carries over.

### 4.4 Fixing hops in Astronomer and Legend

With the rules above:
- Hops in every mode use the **hop tank**.
- In Astronomer and Legend the hop tank starts small (or empty in Legend) and fills **only from the plant**.
- A 5 km hop therefore costs about **12 t of ice and a few weeks of processing**: a real expedition project, not a run-ending accident.
- Tired of waiting? Tow the camp instead: slow, but it costs no fuel.
- The crossfeed (4.2) remains for players who really want to spend launch fuel, with the honest warning.

---

## 5. Ice: many deposits, mined, hauled and processed

### 5.1 Many deposits

You asked for multiple ice points, because the camp can move. Each system gets **5–8 deposits** spread over the whole strip, plus large ones off the strip (reached by relocation flights, §9.3). Each deposit has:

| Property | Range | Effect |
|---|---|---|
| **Size** | 2–40 t of water | Deposits run out, which is a reason to move the camp |
| **Purity** | 20–90% water in the dug material | Low purity = more digging per tonne |
| **Depth** | 0 (surface frost) to 2 m (buried) | Buried ice needs the drill: slower, more energy |
| **How it is found** | visible frost, or found by the scanner | Buried deposits show only after a scan pass, so exploring pays |

**Guarantees:**
- One small, pure surface deposit is always within 3 km of the landing plain, so nobody is stuck.
- One rich deposit is always near the hill, so the "measure" site and the "fuel" site can be the same camp.

### 5.2 Getting the water

There are three steps, each one a visible action rather than a timer:
1. **Prospect:** drive over it with the scanner, or drill a core. You learn its purity and depth, shown as a small core-sample picture.
2. **Mine:** park the rover with its scoop or drill. It fills its 500 kg bin at a rate set by purity, depth and power.
3. **Bring it home:**
   - **haul** the bin to camp (round trips; driving them yourself is optional), or
   - **move the camp onto the deposit**, which needs no hauling and is the reason to tow or hop.

### 5.3 Processing

- The electrolyser runs **continuously while it has water and power**. There is no "process a load" button pressed 27 times; you set it running.
- Its rate is set by energy:
  - real electrolysis takes about 50 kWh per kg of hydrogen, which is about **5.5 kWh per kg of water**;
  - a tonne therefore needs about 5500 kWh;
  - the plant's average power by mode (§12) gives 1–6 sols per tonne, the same pace as today's 1–5 days per load.
- The progress bar shows tonnes processed and where the output is going (§4.2).
- On the night side the plant slows or stops, unless the mode's plant has a reactor (Stargazer and Cadet: yes; harder modes: solar only). This gives **day/night planning**.

### 5.4 Air from ice (survival)

With survival on, the electrolyser's spare oxygen goes to the air store (about 260 days of air per tonne of water). ECHO points it out once: *"Every tonne we split for fuel also leaves enough oxygen to breathe for most of a year."* In the hard modes, this is how a player recovers from an oxygen leak, by working rather than by luck.

---

## 6. Power: the camp grid, the rover battery and the fuel cell

### 6.1 The camp grid

| | What it is | Real anchor |
|---|---|---|
| Solar array | Daily energy depends on the star, the latitude, the season, dust and storms | Spirit and Opportunity: daily output followed dust and season |
| Reactor (easy modes only) | A steady supply, day and night | NASA's planned fission surface power unit: about 40 kW |
| Battery bank | Stored in the habitat; it comes along when towed | — |
| Base load | Life support and heaters | — |

The camp screen shows one bar: **today's energy**, made versus used. Trackers, the plant, charging and the greenhouse are listed as loads you can switch off. This replaces today's "power %" in survival and extends it, lightly, to every mode. (Without survival, the camp never runs out of power for life support; only the plant and charging can be starved.)

### 6.2 The rover battery

- Range is measured in **kWh**, not km:
  - **10 kWh**, similar to the Apollo rover's batteries;
  - about **0.08 kWh/km** on flat ground, so about 125 km per charge (close to today's 120 km);
  - **climbing** costs extra, in proportion to height gained (real energy m·g·h);
  - **soft ground** costs more per km;
  - **towing** costs much more (§8).
- **Charging:**
  - at camp, from the grid, through a 5 kW charger: about 2 hours, if the grid has power to spare (not at night on a solar-only camp, not in a storm, and not while the plant takes everything);
  - in the field, from the rover's **small solar wing** at a trickle of about 1.5 kWh per sol: a stuck rover can always crawl home, but it takes days.

### 6.3 The fuel cell: your idea, made real

You suggested the rover take a little fuel from the ship and turn it into electricity, so it doesn't wait on the solar panels. That is exactly a **fuel cell**: hydrogen and oxygen in, electricity and water out. It is what powered Apollo and the Space Shuttle.

| | Value | Why |
|---|---|---|
| Energy out | about 2.5 kWh per kg of hop propellant | A fuel cell is about 55% efficient |
| Full rover charge | about 4 kg of propellant, **under 1 m/s** of the hop tank | Honest: chemical energy is dense |
| Charge time | about 2 hours (5 kW fuel cell), **anywhere** | In the field the only other source is the solar wing: about a week for a full charge |
| Round trip | electrolysis then fuel cell keeps only about 40% of the energy | A real lesson about losses |
| Bonus | the water comes back and can be split again | Apollo crews drank fuel-cell water |

Its value is **in the field and at night**: far from camp, in a storm, or on a solar-only camp after dark. So the trade-off is **energy and time, not fuel**:
- it is cheap in Δv but drains the plant's hard-won hydrogen;
- in Legend, with no hop allowance, every kg still comes from the plant.

It also allows a **"fuel-cell canister" on the rover** for long expeditions: Watney's extra battery, but real.

---

## 7. The rover: driving that asks for skill

Today: hold to drive; slopes slow you. The proposal adds **terrain types, gears, a winch and honest momentum**, in the spirit of SnowRunner, but in 2D side view and with one thumb.

### 7.1 Terrain the player can read

| Terrain | How it looks | How it behaves | Skill |
|---|---|---|---|
| **Firm plain** | smooth, light | full speed | none |
| **Boulder field** | scattered rocks | **too fast = damage** (a wheel takes a knock; three knocks = a repair job) | slow down, pick the moment |
| **Soft sand / dune** | rippled, darker | wheels slip; **stopping can bog you down** | steady throttle; keep moving; low gear |
| **Rock ledge / crater lip** | a short step 0.3–1.5 m high | needs a **run-up** to climb | gain speed before it |
| **Steep slope** | grade colour on the HUD | above the traction limit the wheels spin | low gear, the winch, or another route |
| **Ice** | blue-white frost | low traction, but this is the treasure | gentle throttle |

### 7.2 Momentum, honestly

At rover speeds momentum only helps for **short** obstacles:
- at 15 km/h (4 m/s), the kinetic energy lifts the rover about **v²/2g ≈ 0.8 m** at g = 10;
- that is enough for a ledge or a dune crest, not a hill.

The game should show this honestly:
- a run-up gets you over a 1 m lip;
- a 300 m hill needs **low gear or the winch**, never just speed.

This is your "gain speed to pass rocky ground" idea, kept true. A one-line Codex card teaches why (*"Kinetic energy ½mv² becomes height mgh: v²/2g"*), connecting to the pendulum chapter.

### 7.3 Gears and controls

- **Two gears.** **High:** 15 km/h, weak on slopes. **Low:** 5 km/h, about three times the pulling force. Shown as one big toggle.
- **Throttle**, not just on/off: drag on phones, W/S or arrow keys on desktop.
- **Brake** (and a downhill hill-hold, which matters when towing).
- **Headlights** at night. **Navigate by stars**, as v2 §10.1 planned: the compass needs a star fix at night.
- **Winch:** fire an anchor up to 50 m ahead into rock, then reel in slowly at high energy cost. It gets you up anything, slowly.

### 7.4 Assist by mode (help, not physics)

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Traction control (auto-feathers the throttle in sand) | ● | ● | ◐ (warns) | ○ | ○ |
| Auto gear | ● | ● | ○ | ○ | ○ |
| Damage from rocks | no; ECHO slows you | a warning, then a knock | knocks | knocks | knocks |
| Route preview (grade colours ahead) | ● | ● | ● | ◐ (near only) | ○ |

### 7.5 Things worth driving to

- **Ice deposits** (§5), found by scanning.
- **Finds:** the existing parts, meteorites and clues.
- **Overlooks:** high points with a wide view and a photo moment; some improve the horizon method.
- **Dark-sky spots:** lower haze and better seeing, shown as a smaller noise in Observatory readings.
- **Halcyon debris:** story beats.
- **A scan pass** reveals buried ice along the route, so driving is how you prospect.

### 7.6 One rover for everything

The long-trip rover (chapter 3's north–south trip, rover parallax) should become **the same machine**:
- it drives by day (about 10 hours of sunlight on a typical sol at 15 km/h is about 150 km);
- it charges at night from its solar wing and a carried fuel-cell canister.

Today's 400 km/day assumes driving 24 hours nonstop with no battery. The honest figure is about **120–180 km per sol**:
- a 1000 km Eratosthenes trip takes about a week instead of 2.5 days;
- that is still tiny against 2–5 years of life support.

The validation bot's trip timings must be updated with this change (§13).

---

## 8. Towing the camp

Towing today is a timer. Physically it is the hardest thing the rover does: the habitat masses about 15 times the rover.

### 8.0 A decision first: what exactly is towed?

Today towing moves the whole camp, and the camp *is* the ship, so the rover drags a 35 t rocket on its landing legs. That isn't believable. Two honest options:
- **A (recommended): the camp is a habitat trailer, and the ship is parked.** You tow the 12 t habitat with the plant and instruments. The ship stays where it landed until you hop it to join the camp (or the camp tows back to it). Launch needs the two together.

  This adds a nice choice ("tow the camp to the ice now, bring the ship over later") and makes the rover rendezvous of §9.2 natural.
- **B: the ship rides on a wheeled cradle.** You tow everything, about 50 t, at roughly four times the energy per km of option A. It is simpler for the code (the camp stays one place), but towing becomes very slow in the hard modes.

The numbers below assume **A**.

### 8.1 What towing costs (honest numbers)

- **Rolling resistance** on loose ground is about 10% of the weight. Towing a 12 t habitat at g = 10 takes about 12 kN, which is **about 4–5 kWh per km** on the flat, more uphill.
- The rover's 10 kWh battery alone would last about 2 km. So, as in Astroneer, **the tow draws from the camp's battery bank through the hitch**.
- At 2 km/h a 10 km tow is about 5 hours of driving and about 50 kWh: one full day on a well-charged bank.
- **A full bank tows about 20–30 km in the hard modes** (§12.3). Longer moves become **multi-sol caravans**: drive by day, stop, unfold the panels, recharge. This matches v2's original "days of slow driving", and now there is a reason.
- **At night the caravan stops, and you observe from wherever you are.** Observing from a new spot along the way is a feature, not a delay.

### 8.2 How it drives

- **Heavier:** it accelerates slowly and takes a long time to stop. **Downhill runaway** is the danger: brake early or the hab jack-knifes (a repair job).
- **Low gear required** on any real grade.
- **Sand with the hab** in tow: keep moving, or you bog down and need the winch.
- **Rock fields:** above walking pace the hab takes knocks.
- **Ledges can't be jumped** with a hab. Find the gap (the route preview shows it) or winch.
- **"Let it drive itself":** the rover can tow on autopilot along a safe route at the safe speed, which is slower. Driving it yourself is faster if you are good. This is the same "ECHO or you" choice as the hop and the ascent, and it keeps the feature optional.

### 8.3 Assist by mode

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Energy per km of towing | ×0.5 (lighter "expedition hab") | ×0.7 | ×1 | ×1 | ×1 |
| Jack-knife / runaway | can't happen | warned | warned | possible | possible |
| Autopilot tow | ● | ● | ● | ● | ● (slow) |

The Stargazer and Cadet hab being lighter is a labelled allowance, like the hop tank. The physics of driving stays the same.

---

## 9. Moving the camp by air: hops and long relocation flights

### 9.1 What a hop already is

The ship *is* the camp: when you hop, the camp moves (this already works). What it lacks is a **"packing" step**, and a reason to land precisely.

### 9.2 Hops, improved

- **Pack up first:**
  - the rover drives into the bay (it rides along for a little more fuel), or it stays behind and **drives to meet you**, which is a fun rendezvous;
  - trackers stop, and the plant and solar wings fold.
  - With the rover aboard a hop costs about 3% more fuel (the rover is about 2% of the ship's mass).
- **Landing pads.** When you pick a target, ECHO scans and marks 1–3 safe pads near it. Landing on a pad scores (§11); landing anywhere flat is fine.
- **Throttle**, not just on/off (§10.2), and hold modes by difficulty.
- **Medals per hop:** softness, precision and fuel left, Lunar Lander style. "Let ECHO fly" still earns the trip, but no medal.
- **The hop fuel is now real** (§4): from the hop tank, which the plant can refill without limit in every mode.

### 9.3 Long relocation flights: the whole camp, anywhere on the planet

This is your bigger idea: fly the whole camp far away, not just along the landing strip.

**What it costs.** A ballistic flight between two points on a planet of radius 7000 km and g = 10 needs, before losses, both ways (launch and landing):

| Range | Ideal Δv (both burns) | Realistic (with losses; to be measured with the hop autopilot) |
|---|---|---|
| 5 km | 0.45 km/s | about 1.2 km/s (measured, §1) |
| 50 km | 1.4 km/s | about 2 km/s |
| 200 km | 2.8 km/s | about 3.4 km/s |
| 500 km | 4.4 km/s | about 5 km/s |
| 1000 km | 6.1 km/s | about 7 km/s |
| orbit | 8.4 km/s | (the ascent) |

So a 500 km relocation costs about **50 t of water**:
- in Stargazer that is about 50 sols of a busy plant;
- in Legend it is most of a year of plant work: possible within the 2–4 years of life support, but a real commitment.

That is exactly right: a big goal you **earn by running the camp well**, not a button.

**Why go?** Each destination must be worth the effort:

| Destination | What it gives |
|---|---|
| **Polar ice cap** | Huge, pure ice (the best fuel site); a sky where the pole star stands high, which makes latitude measurements easy; long winter nights for observing |
| **High plateau** | Thinner air: better seeing, sharper star positions, less refraction (a cleaner horizon method) |
| **The Halcyon's crash site** | The story's turning point: logs, parts, a clue about Mira |
| **Far longitude** | A long-baseline second site for parallax or timing measurements |

**How it flies.** It reuses what we have: a short ascent arc (the ascent screen, suborbital), a coast with the planet's curve visible, and an entry and landing (the descent screen with a new terrain). "Let ECHO fly" works throughout.

**The engineering catch.** Today the observing site is part of the generated system. To relocate, the **current site** must move into the game state, and every measurement must record where it was taken. That touches many tools, so this is the last phase of the roadmap (§14) and needs its own test pass across all chapters.

---

## 10. The ship: intro, landing, launch, orbit, transfer and arrival

### 10.1 The intro (prologue)

Already strong after the recent redraw. Additions:
- **An orbital scan before the deorbit burn:** a short pass over the region, where the scanner paints flat ground, ice and the hill. You pick the landing region, and the descent then starts above it. It is a KSP-like moment of choice, and it teaches what the scanner shows.
- **ECHO's damage report** after touchdown sets the first goals, presented as a **"camp setup" checklist** (optional, with a skip, because you asked that tutorials be optional):
  1. unfold the solar wings;
  2. unload the rover;
  3. drive to the near ice deposit;
  4. start the plant.

  Each step teaches one system in under a minute.
- **The landing medal** (softness, precision) shows right away, so the first thing the player earns is for flying well.

### 10.2 Ship controls (the descent, hops and arrival)

| Control | Today | Proposed |
|---|---|---|
| Throttle | on/off (hold BURN) | **variable**: a slider on phones, W/S steps on desktop, plus full and cut keys |
| Attitude | rotate left/right; the assist levels the ship in easy modes | **hold modes**: Stargazer and Cadet get *level* and *retrograde hold*; Navigator gets *kill rotation*; Astronomer and Legend get none |
| Prediction | Cadet: impact point shown | Unchanged by mode; add a **suicide-burn marker** in easy modes ("start braking here") |
| Camera | auto zoom | add a manual zoom out and a "show the flag" toggle |
| Legs / lights | automatic | lights on by key (night landings look great) |

### 10.3 Launch

- **A countdown with holds:**
  - weather from the anomaly system (wind gusts hold the launch, and you choose to wait or go);
  - a final checklist (tanks, crew pods) that summarises the expedition.
- **Max-Q:** a real feature of every launch. The guide line suggests throttling back through the thickest air; ignoring it heats the ship and costs a little fuel. It is a one-line lesson.
- **Score the ascent:** fuel saved against ECHO's profile is already computed. Give it a medal and a personal best per system.

### 10.4 Orbit, departure, cruise and arrival: from cutscene to four short scenes

This was planned in v2 §9.2 and is the biggest gap today. Each scene is under a minute, every one can be handed to ECHO, and each connects to measurement:

1. **Parking orbit and the departure burn.**
   - Time-warp to the burn point (a marker on the orbit), then burn: start on the marker, cut when the bar fills, as with KSP's maneuver nodes.
   - Starting early or late adds an error that the mid-course correction will pay for, computed honestly by the existing launch simulator.
2. **Cruise and optical navigation.**
   - Take two or three **sightings**: centre the blue planet in the finder and log it.
   - Each sighting shrinks the uncertainty of the correction burn.
   - Skipping them is allowed, but the correction costs more. Measuring, again, pays.
3. **The mid-course correction.** ECHO computes the burn; you point and burn until the residual reaches zero, or let ECHO do it.
4. **Arrival choice:**
   - **capture** into orbit (fuel);
   - **aerobrake** (a heat gauge and a narrow corridor, reusing the entry screen, cheap but risky; needs an atmosphere);
   - **direct entry** (cheapest, hardest landing).

   Then, from orbit, an **orbital scan of the landing area**, as in the intro, so the last landing is a choice too.

The existing Flight map stays as the background of all four scenes.

### 10.5 Landing on the blue planet

- It already reuses the descent with the target's gravity. Add the **orbital scan** (above) and **2–3 named pads** near the beacon.
- The final medal counts for the chapter score, as the landing bonus does today (60 / 20 points).
- At the target there is **no hopping or plant**. The run ends, so the surface systems stay on the home planet. (Free Roam could later allow exploring the target.)

---

## 11. Making it a game: goals, scores, medals and stories

The rule: **side goals reward skill and curiosity but never outweigh measuring.** Medals give small, capped bonuses, as the landing bonus already does.

### 11.1 Medals (bronze / silver / gold)

| Activity | Measured by |
|---|---|
| Every landing (prologue, hop, relocation, arrival) | touchdown speed, distance from the pad, fuel left |
| The ascent | fuel saved against ECHO's profile |
| Each departure burn | timing error |
| Each tow | time, energy used, no knocks |
| Each rover expedition | distance, finds, energy left |

Personal bests are kept per system seed, with a "ghost" line of your best hop on the next attempt.

### 11.2 Expedition goals (optional, shown in the camp log)

A short, rotating list of three, like daily challenges but tied to this world:
- "Prospect three ice deposits."
- "Land a hop within 10 m of a pad."
- "Tow the camp to the foot of the hill without a knock."
- "Make 5 t of water into propellant."
- "Observe from an overlook."
- "Reach the Halcyon wreck" (relocation phase).

Each gives a few points and a Codex card. They connect to the existing achievements.

### 11.3 Events that make the surface feel alive (survival on, mostly)

| Event | Effect |
|---|---|
| **Dust devils** | Clean the solar panels (real, on Spirit) |
| **Dust storms** | Already in the game; now they also stop solar processing and towing |
| **A rockfall on the route** | A new ledge appears; find another way or winch |
| **Frost mornings** | Ice deposits show up from a distance at dawn (a hint, not a cheat) |
| **Boil-off warnings** | "Use the hydrogen in the plant buffer within a week" |

### 11.4 Story hooks

Mira's journal and the Halcyon's logs can mark the surface:
- *"I left a fuel cache on the north ridge"* is an ice-free fuel find, story-gated, once per run;
- the crash site is a relocation destination.

This gives exploration a narrative pull, as v2 §8 wanted.

---

## 12. Every number, by mode (the balance sheet)

All values follow v2 §1: the physics is identical, and allowances are labelled. Rates are per **sol** (one local day).

### 12.1 Energy

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Plant power (average) | about 230 kW, reactor (day and night) | about 115 kW, reactor | about 75 kW, solar farm (nothing at night) | about 60 kW, solar | about 40 kW, solar (the size of NASA's planned fission unit) |
| Camp battery bank | 300 kWh | 200 kWh | 150 kWh | 120 kWh | 100 kWh |
| Rover battery | 10 kWh | 10 | 10 | 10 | 10 |
| Rover charge at camp | about 2 h, any time | about 2 h, any time | about 2 h by day | about 2 h by day | about 2 h by day |
| Fuel cell (rover charge from the hop tank) | ● | ● | ● | ● | ● (plant fuel only) |

### 12.2 Ice and fuel

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Deposits on the strip | 7–8 | 6–7 | 5–6 | 5 | 5 |
| Total water on the strip | about 150 t | about 120 t | about 90 t | about 70 t | about 60 t |
| Sols per tonne processed | **1** | **2** | **3** | **4** | **5–6** |
| Main-tank cap from ice (share of spare) | 40% | 40% | 25% | 15% | 10% |
| Hop tank allowance | 6000 m/s, nightly | 4000 m/s, nightly | 2200 m/s, refills over 3 sols | 1400 m/s, refills **from the plant only** | **0**, plant only |
| Plant → hop tank | uncapped | uncapped | uncapped | uncapped | uncapped |
| Main → hop crossfeed | open (no fuel worry) | open (no fuel worry) | closed by default | closed by default | closed by default |
| Boil-off of the plant buffer | 0 | 0 | 0.5%/sol | 1%/sol | 1%/sol |
| Spare O₂ per tonne of water | about 260 person-days (shown with survival on) | same | same | same | same |

*Why these numbers:*
- **Sols per tonne** keep today's 1–5 days per 100 m/s load, now explained by plant power (about 5500 kWh per tonne of water) and given a reason (reactor or solar). The bigger plants of the easy modes are a labelled allowance, like the hop tank.
- **The main-tank cap** keeps today's v2 values exactly, so the validated success rates (v2 §3) don't move.
- **A 5 km hop (about 12 t of water)** therefore takes about 12 sols of processing in Stargazer (who doesn't need to: the nightly allowance covers it), about 36 in Navigator, and about 48 in Astronomer. Against 2–5 years of life support, that is a real but fair price in the hard modes.

### 12.3 Movement

| | SG | Ca | Na | As | Le |
|---|---|---|---|---|---|
| Rover top speed (high / low gear) | 15 / 5 km/h | same | same | same | same |
| Rover range, flat | about 125 km | same | same | same | same |
| Towing, energy per km (flat) | about 2.5 kWh | about 3.5 kWh | about 5 kWh | about 5 kWh | about 5 kWh |
| Towing range on a full bank | about 120 km | about 55 km | about 30 km | about 24 km | about 20 km |
| A 10 km tow | half a sol | half a sol | half a sol | half a sol, if the bank is full | one sol |
| Long trips (chapter 3) | 150 km/sol | 150 km/sol | 120 km/sol | 120 km/sol | 120 km/sol |
| Life support counted during hops | no | no | yes (minutes) | yes | yes |

### 12.4 Time check: is the lifetime right?

- **Life support, 2–5 years:** **keep it.** It exists so the astronomy (oppositions, a year of parallax, the giant's orbit) can be measured. The surface economy above gives the days *inside* that lifetime their value, without shortening play.
- **Per-action times after this change:**
  - a 10 km drive: under an hour;
  - a 10 km tow: half a sol to a sol, and longer moves need recharge stops;
  - a tonne of water: 1–6 sols;
  - a 500 km relocation: weeks to months of plant work, flown in about 15 minutes.

  These are all small against the deadline but large enough to plan around. Measuring still decides whether you get home.
- **Survival mode:** oxygen now has a working source (the plant), so survival in Navigator and up rewards running the camp well, not just luck with leaks.

---

## 13. Risks and counter-arguments

1. **"This turns an astronomy game into a logistics game."** It is a real risk. The guards:
   - the main-tank cap (measuring still decides the flight home);
   - optional side goals;
   - "Let it drive itself" and "Let ECHO fly" everywhere;
   - the easy modes' allowances.

   A player can still ignore the camp almost entirely in Stargazer and Cadet.
2. **Too many numbers on screen.** Show **one camp bar** (energy today) and **one plant card**. The full tank panel opens only when you tap it. Coaching modes explain each number once.
3. **Changing the long-trip rover's speed changes chapter 3 timings.** The bot in `scripts/validate.ts` must be re-run, and the success rates of v2 §3 re-checked. Life support is long enough that this should not change outcomes, but it must be measured, not assumed.
4. **Splitting the camp from the ship (§8.0, option A)** means the camp's position and the ship's position become two values. Today they are one (`camp.x`); the launch, hop and map code must learn the difference.
5. **Relocation flights touch every measuring tool**, because the site moves. This is why it comes last. It needs a "site history" in the state, and a test that each chapter's chain still closes (`tests/chain.test.ts`) when the camp moves mid-run.
6. **Save compatibility.** New state fields need defaults in the persisted store ("stranded-save-v1"), so old saves load: one deposit becomes the first of the new list, and loads convert to tonnes.
7. **Phones.** Gears, throttle and winch must fit one thumb. Every new control gets a big on-screen button and a keyboard key, and is tested at phone width, as the rover drive was.
8. **Is a fuel cell too cheap?** In real Δv terms, yes: under 1 m/s per charge. It is kept honest by charge time, the round-trip loss, and the fact that in the hard modes the hydrogen comes from slow plant work. If playtests show it makes solar pointless, the fix is a smaller fuel cell (slower), not fake chemistry.

---

## 14. Roadmap

Each phase is playable on its own and ends with tests, a browser check (desktop and phone) and a push.

**Phase A: the economy and the balance fixes (the most value for the least risk)**
1. Fuel tanks and valves (§4): the hop tank fills from the plant, uncapped in every mode; a crossfeed valve, closed by default from Navigator up; Astronomer and Legend hops fixed.
2. Multiple ice deposits with size, purity and depth (§5.1); the near-plain and near-hill guarantees.
3. A continuous electrolyser limited by power; output routing; no more repeated clicks (§5.3).
4. Spare oxygen to the air store in survival (§5.4).
5. The rover battery in kWh; charging limited by the grid; a solar trickle (§6.2).
6. The fuel cell (§6.3).
7. Save migration and new tests (economy, the caps, the guarantees).

**Phase B: the rover and towing as driving**
1. Terrain types (rocks, sand, ledges, slopes, ice) on the strip (§7.1), with honest momentum (§7.2).
2. Gears, throttle, brake, headlights and the winch (§7.3); assists by mode (§7.4).
3. Towing as driving: the habitat trailer separate from the ship (§8.0), energy through the hitch, mass, runaway, the autopilot tow (§8).
4. Prospecting with the scanner, the drill and core samples; overlooks and dark-sky spots (§5.2, §7.5).
5. One rover model for the long trips (§7.6); re-run the validation bot.

**Phase C: the ship, start to finish**
1. Variable throttle and hold modes (§10.2).
2. Landing pads and medals for every landing (§9.2, §11.1); packing the camp for a hop, and the rover rendezvous.
3. The orbital scan in the intro and at arrival; the camp-setup checklist (§10.1).
4. The launch countdown and Max-Q (§10.3).
5. The four flight scenes: departure burn, sightings, correction, arrival choice (§10.4).

**Phase D: long relocation flights (the big one)**
1. Move the observing site into the game state, with a site history per measurement.
2. Suborbital flights reusing the ascent and descent; destinations (polar cap, plateau, Halcyon site, far longitude) (§9.3).
3. Full chain tests with the camp moving mid-run, in every chapter.

**Phase E: polish**
1. Expedition goals and events (§11.2, §11.3).
2. Story hooks (§11.4).
3. Ghosts and personal bests.
4. README and in-game mode descriptions updated with the final numbers.

---

## 15. Sources

**Games**
- [KSP wiki: ISRU](https://wiki.kerbalspaceprogram.com/wiki/ISRU) and community analyses of [drill power](https://forum.kerbalspaceprogram.com/topic/129304-proper-isrudrill-usage) and [converter heat](https://forum.kerbalspaceprogram.com/topic/145900-mining-drillsisru).
- [Spaceflight Simulator wiki: rovers](https://spaceflight-simulator.fandom.com/wiki/Rovers).
- Astroneer wiki: [Medium Rover](https://astroneer.wiki.gg/wiki/Medium_Rover), [Large Rover](https://astroneer.wiki.gg/wiki/Large_Rover), [Tether](https://astroneer.wiki.gg/wiki/Tether).
- Space Engineers wiki: [O2/H2 Generator](https://spaceengineers.wiki.gg/wiki/O2_H2_Generator), [Ice](https://spaceengineers.wiki.gg/wiki/Ice).

**Real hardware**
- MOXIE: [Wikipedia](https://en.wikipedia.org/wiki/MOXIE), [JPL](https://www.jpl.nasa.gov/news/nasas-perseverance-mars-rover-extracts-first-oxygen-from-red-planet/).
- Curiosity: [driving speed (Planetary Society)](https://www.planetary.org/articles/06161423-curiosity-update-sols-645-661), [JPL mobility trends](https://www-robotics.jpl.nasa.gov/media/documents/2020-mobility-trending.pdf), [power and speed (Mobility Engineering)](https://www.mobilityengineeringtech.com/component/content/article/42079-sae-ma-01276).
- [NASA Glenn Mars hopper study (NTRS)](https://ntrs.nasa.gov/citations/20120004103).
- Water electrolysis energy: [planete-mars.com, fluids production](https://planete-mars.com/a-mars-colony-a-tentative-technical-analysis/13); [low-temperature ISRU paper (arXiv 2404.00800)](https://arxiv.org/pdf/2404.00800).
- *The Martian*'s power plot: [LitCharts, the RTG](https://litcharts.com/lit/the-martian/symbols/the-rtg).
- Rover traction on slopes and loose soil: [Frontiers in Robotics and AI (2024)](https://www.frontiersin.org/journals/robotics-and-ai/articles/10.3389/frobt.2024.1320261/pdf).

**From memory, not looked up for this document**
- Apollo LRV (about 13 km/h, roughly 9 kWh of silver-zinc batteries, 92 km range).
- NASA's fission surface power target (about 40 kW).
- Apollo and Shuttle fuel cells.
- SnowRunner and Lunar Lander mechanics.

Check these before quoting them in the game.
