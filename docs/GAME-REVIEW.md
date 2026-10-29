# Stranded: complete game review and discussion register

**Reviewed:** 29 October 2026. **Implementation baseline:** `45e92c6` (including the published audio refresh).

**Purpose:** one place to discuss the game before authorizing further implementation. This is an assessment and a set of recommendations, **not an approved specification or an instruction to implement every suggestion**. The preserved [story bible](STORY.md) remains the narrative reference; discrepancies with the shipped scripts are identified below.

The review consolidates the six former planning, design, engagement and story documents by topic. Repeated proposals are combined; alternatives, rejected ideas, tiny presentation details and unresolved decisions are retained. Old checkmarks are not evidence of completion. The replaced documents remain available in [Git history at the reviewed baseline](https://github.com/mhr-isham/Stranded/tree/45e92c611af0da842474a726fa08487ea728d7ff/docs).

## How to discuss this report

Refer to a point by its identifier, for example **SCI-06**, **ECON-12** or **CHAR-03**. A comment can accept, change, reject or defer that point. We should record decisions next to the relevant point rather than creating another competing design document.

Status vocabulary:

- **Present:** a concrete implementation exists and its main behavior matches the stated intent. This does not mean flawless.
- **Partial:** implemented foundations exist, but a material part of the proposed experience is missing or inconsistent.
- **Absent:** no corresponding implementation was found.
- **Alternative:** an earlier idea was replaced or deliberately excluded; absence is not automatically a defect.
- **Unverified:** a behavioral, scientific or engagement claim requires additional evidence.

**Evidence boundary:** code and tests establish current mechanisms; targeted runtime probes establish particular failures; engagement predictions are design judgments. This is not a human playtest of every chapter, seed, device and mode. No honest review can guarantee that every player will enjoy a feature or that no undiscovered bug remains.

## Contents

1. [Direction and priorities](#1-direction-and-priorities)
2. [Ways to play, modes and teaching](#2-ways-to-play-modes-and-teaching)
3. [Science, tools and measurement quality](#3-science-tools-and-measurement-quality)
4. [Predictions, planning and time](#4-predictions-planning-and-time)
5. [Campaign: every chapter](#5-campaign-every-chapter)
6. [Ship: the complete flight](#6-ship-the-complete-flight)
7. [Surface exploration and towing](#7-surface-exploration-and-towing)
8. [Energy, water, oxygen and fuel](#8-energy-water-oxygen-and-fuel)
9. [Balance numbers and scientific corrections](#9-balance-numbers-and-scientific-corrections)
10. [Story, characters and emotional involvement](#10-story-characters-and-emotional-involvement)
11. [Rewards, identity and replay](#11-rewards-identity-and-replay)
12. [Presentation, audio and accessibility](#12-presentation-audio-and-accessibility)
13. [Saving, reliability and engineering](#13-saving-reliability-and-engineering)
14. [Different players and sustained enjoyment](#14-different-players-and-sustained-enjoyment)
15. [VPS and Cloudflare opportunities](#15-vps-and-cloudflare-opportunities)
16. [Playtesting and evidence](#16-playtesting-and-evidence)
17. [Issue register and implementation sequence](#17-issue-register-and-implementation-sequence)
18. [Decisions to discuss](#18-decisions-to-discuss)
19. [Evidence index and research](#19-evidence-index-and-research)

## 1. Direction and priorities

### DIR-01 — What is already special

**Present. Keep and strengthen.** The strongest loop is *observe → measure → commit to a model → predict → navigate → understand the miss*. Hand-operated instruments, the dependency constellation and honest error bars give Stranded an identity beyond a conventional space game. The engine has circular/elliptical ephemerides, Lambert planning, observer geometry, gravity assists and uncertainty propagation. Preserve this foundation.

The best emotional promise is equally distinctive: your measurements keep people alive and finish another navigator's journey. Surface logistics and manual flight should make that promise tangible, rather than become separate games that delay it.

### DIR-02 — The central problem

The game has more implemented systems than its presentation currently connects. A player can measure, drive, process ice, read a log and watch a transfer without understanding how these activities affect one another. Adding more buttons will not solve that. Prioritize visible consequences: a better sighting changes a predicted corridor; a journey finds an observing site; a crew member reacts to a decision; a repaired instrument changes the camp.

### DIR-03 — Principles to preserve and clarify

| Principle | Current condition | Judgment and proposed rule |
|---|---|---|
| Same physical laws across difficulty | Shared engine exists; environmental frequencies and some corrections differ by mode | Keep the same equations. Label different hardware/allowances; distinguish assistance from removing a physical effect. |
| No truth before commitment | Mostly protected in ordinary play; paid verification and tutorial helpers are explicit exceptions | State those exceptions honestly. Free Roam can show truth; ranked runs cannot. Never imply a predicted path is the true path. |
| One new idea at a time | Chapters have focused twists; beginners still see many controls | Keep the chapter structure; disclose tools and resource details when relevant. |
| No quizzes in ordinary gameplay | Present direction | Explain after observations. Research concept questions can exist in an optional playtest, outside the story. |
| Physics inside a system; fold drive between systems | Broad direction, with simplified/arcade flight portions | Mark approximations. Do not advertise every visual or mechanic as a validated physical simulation. |
| No combat, altered-gravity aliens or magic performance boosts | These are not current mechanics | Keep excluded. Mystery can concern human choices and old hardware without breaking the sky. |
| No mandatory grind or manipulative retention | No monetized pressure systems | Keep warp available. Processing months must not require months of real waiting or repetitive clicking. |
| Optional instruction and manual control | Partial | Make teaching optional and preserve equivalent information in the Codex. Decide which scored modes genuinely require manual flight. |

### DIR-04 — Recommended priority

First repair progression and trust failures; then improve early discovery, event navigation and story pacing; then finish measurement-linked flight; then prototype the resource economy; only then broaden terrain, relocation and online features. This is my recommended order, not an implementation commitment. Building all proposed logistics first would be a large, risky diversion from the game's most memorable moments.

## 2. Ways to play, modes and teaching

Evidence: [Title](../src/ui/Title.tsx), [mode rules](../src/game/modes.ts), [tutorial](../src/game/tutorial.ts), [lessons](../src/ui/tutorial/lessons), [missions](../src/game/missions.ts).

| ID | Feature and current condition | Assessment and proper next implementation |
|---|---|---|
| MODE-01 | **Present:** Campaign, Single Expedition, Flight School and Free Roam entry points | Keep four clearly distinct promises: story journey, replay challenge, guided learning, creative sandbox. Explain score/deadline before starting. |
| MODE-02 | **Partial:** Expedition supports random/daily/numeric seeds, but only chapter-1-style systems | Add a twist selector for completed chapters, with a preview of the new method. Encode twist, mode and engine version in shared run identity. |
| MODE-03 | **Present:** nine campaign chapters, per-chapter mode selection and unlocks | Keep. Avoid implying all chapter-specific teaching or flight features are finished just because chapters are selectable. |
| MODE-04 | **Partial:** Free Roam removes score/deadline and offers truth overlay; inherits prologue and much coached structure | Open directly into a chosen learned system; optional landing rather than compulsory framing. Offer tool unlock policy explicitly. Add photos/constellations and target exploration only as separate approved work. |
| MODE-05 | **Present:** five difficulty configurations | Five is sufficient. Do not add more top-level modes until player evidence shows a missing audience. Challenges can supply expert variation. |
| MODE-06 | **Present:** Stargazer has generous margins, free hints, unlimited rewinds | Preserve a scored gentle expedition, distinct from unscored Free Roam. Avoid promising literally impossible-to-fail if failure remains possible. |
| MODE-07 | **Present:** Cadet coaching, warnings, five verifies, one free rewind | Good entry mode. Show a single practical next goal and let players explore without receiving a wall of instructions. |
| MODE-08 | **Present:** Navigator has goal-oriented missions, two verifies, three saves and one −150 rewind | Good standard challenge. Audit helpers that currently also give the Cadet-only own-fit nudge. |
| MODE-09 | **Present:** Astronomer hides missions/hints/verifies, formulas initially off, no rewind | Preserve arithmetic and lessons. Disabling instruction should not disable usability, access needs or accurate labels. |
| MODE-10 | **Partial:** Legend locks formulas, forces survival and removes warnings, but automated ascent remains selectable | Either enforce its manual promise or revise the promise. Do not silently change it during this review. |
| MODE-11 | **Partial:** training has Basic Training plus chapter lesson content, but no proper Flight School module library | Build a chapter/module index, unlock rules and completion state. Present “Train first / Jump in”; remember skipping and offer help once after prolonged lack of progress. |
| MODE-12 | **Partial:** interactive estimation lesson exists; first two predictions are not jointly practiced in Basic Training | Add a short non-scored estimate from actual readings, then a reveal. Teach line extension, ratios and bracketing rather than date guessing. |
| MODE-13 | **Partial:** mission lists constrain next tasks; the initial HUD is not limited to time, air, companion and sheet | Use progressive introduction of warp, readings and launch. Allow experienced players to show all controls immediately. |
| MODE-14 | **Partial:** complications are partly corrected/suppressed in easier modes | Explain corrected observations once and keep raw/corrected provenance. A uniform correction ladder is easier to understand than different invisible rules per tool. |
| MODE-15 | **Alternative:** old Ironman tier, binary-star chapter sequence, unscored “Stargazer”, twenty-rank ladder and pre-known-value Short Expedition | Retain the current five modes, Free Roam and combinable challenges. Short sessions should come from safe act saves, not deleting the measurement chain. Binary stars can be a future advanced scenario, not missing launch scope. |

### MODE-16 — Current mode contract in one table

These are configured rules, not measured human success probabilities.

| Rule | Stargazer | Cadet | Navigator | Astronomer | Legend |
|---|---|---|---|---|---|
| Formula sheet | on | on | on | off, can enable | locked off |
| Missions | coached | coached | goals | hidden | hidden |
| Coaching / suspicious-reading warnings | yes / yes | yes / yes | yes / yes | no / yes | no / no |
| Hint levels | 3 free | 3 | 1 | 0 | 0 |
| Fuel-cost verification | unlimited | 5 | 2 | 0 | 0 |
| Manual saves into three slots | unlimited | unlimited | 3/run | none | none |
| Rewinds before truth debrief | unlimited | 1 free | 1, −150 | none | none |
| Survival | toggle | toggle | toggle | toggle | forced |
| Forecast | 3 days | 2 days | 1 day | none | none |
| Separate descent allowance | 1300 m/s | 1100 | 900 | 750 | 650 |

**Test before calling mode rules complete:** every tool, helper, alternate fit, challenge, descent phase and truth overlay must respect the same effective rules. Current configuration tests alone do not establish that.

## 3. Science, tools and measurement quality

Evidence: [measurement equations](../src/engine/measure.ts), [solve chain](../src/engine/chain.ts), [tool UIs](../src/ui/tools), [fits](../src/game/fits.ts), [anomalies](../src/game/anomalies.ts).

| ID | Feature / current condition | Opinion, improvement and verification |
|---|---|---|
| SCI-01 | **Present:** real observer-frame sky, day/night color, stellar twinkle and steadier planets | Excellent first discovery. Make the player spot the target before explaining it. Use symbol/text redundancy for twinkle and color differences. |
| SCI-02 | **Present:** pendulum length scale, release amplitude, stopwatch and swing taps | Keep the hand-operated experiment. Show why many swings reduce timing error; give a weight-relative-to-Earth interpretation from the player's estimate. Keep the real-time override visible during warp. |
| SCI-03 | **Partial:** pendulum technique feedback; requested twenty-swing celebration/medals not a complete system | Reward controlled amplitude, repeats and stated scatter, not secret correctness. Do not make timing accessibility an unmarked score advantage. |
| SCI-04 | **Present:** horizon dip, chosen climb height, hand sway, bracing/tripod and refraction | One of the strongest physical tools. Show climb/time cost before committing; retain an optional manual alignment. Phone gyro aiming is absent and should remain an optional control method, never required. |
| SCI-05 | **Present:** year inference from drift; locked worlds use the turning sky | Good faster route than a whole analemma. Reject insufficient baselines/nonfinite fits; visually relate additional nights to slope uncertainty. |
| SCI-06 | **Present:** retrograde chart, oppositions and synodic inference | Keep. Live sky trails and a time-lapse toggle are absent; add an optional trail that uses observed samples rather than a hidden perfect future. |
| SCI-07 | **Present:** two-site simultaneous background-star parallax with a blink comparator | Signature moment worth better animation. Teach projected baseline and identical timestamps; let the player predict the direction of the jump before blinking. |
| SCI-08 | **Present:** distance measurements are dated and converted through system geometry | Preserve the distinction between instantaneous separation and orbital radius. A launch model must never use `a2` as the telescope distance. Test off-opposition readings explicitly. |
| SCI-09 | **Present:** micrometer angular diameter and target radius derivation | Make wire placement feel physical. Keep below-horizon and overlapping-wire guards; explain the linkage between distance error and inferred size. |
| SCI-10 | **Present:** moon orbit fits, line-of-sight correction and changing angular envelope | Keep fitted curves tied to selected data. Show why a long, changing-distance stretch may be a poor fit; do not hide excluded samples. |
| SCI-11 | **Partial:** gnomon two-site radius route exists in chapter 3, not as a general selectable alternative | Offer it as an unlocked alternate radius experiment. Store site latitude/longitude, local noon and baseline; group by local solar day rather than assuming Earth UTC days. |
| SCI-12 | **Partial:** general multiple-method choice and cross-check rewards | Add one alternative at a time: radius first, then diurnal parallax, then retrograde-rate year inference. Award independent agreement once, with covariance considered; repeated algebra from one reading is not independent evidence. |
| SCI-13 | **Absent:** noon-season/solar-versus-sidereal-day alternative year method, pole-star latitude and rotation from trails | Good optional investigations after the core chain is understood. Use real obliquity/rotation and enough observational baseline; avoid adding required chores to every chapter. |
| SCI-14 | **Absent:** density-analogy mass fallback and Cadet radio ranging | Probe mass is the chosen moonless route. Keep analogy only as a labeled broad prior in a future sandbox/lesson; ranging would bypass the key distance discovery if broadly available. |
| SCI-15 | **Absent:** photometer/spectroscope and star-radius consistency experiment | Useful future method if backed by brightness, temperature, extinction and calibration. Do not expose a star-radius “check” without measurable inputs. |
| SCI-16 | **Partial:** transits/inner geometry exist; full historical transit parallax against the stellar disk does not | Distinguish identifying a transit from measuring differential transit parallax. For the latter include the finite-distance reference star, `p = B(1/d − 1/a1)`, projected geometry and synchronized contact measurements. |
| SCI-17 | **Present:** proper inner/outer synodic signs, orbital ratios, masses, capture and Lambert planning | Keep equation tests with Earth/Mars/Venus anchors. Explain which approximations assume circular coplanar motion and which chapter invalidates them. |
| SCI-18 | **Partial:** error bars and finite-difference propagation exist, but full covariance is not represented | Show how uncertainty flows through the constellation. For repeated/derived quantities, avoid counting correlated inputs as independent; consider covariance-aware sampling before claiming calibrated success probabilities. |
| SCI-19 | **Partial:** competing moon-period hypotheses, not a general two-model notebook | Keep both fitted models, forecast their differences and suggest an informative observation night from those models. Add year aliases and competing opposition dates later. Cadet can get a recommended candidate, with reasoning. |
| SCI-20 | **Present:** wind, humidity/refraction and variable seeing; **absent:** complete extinction, clock drift, dust-on-scale, Rømer and non-simultaneous-photo investigations | Add only effects with a visible cause, a diagnostic pattern and a recoverable method. Wind must visibly bias the experiment; seeing should scatter the image. Missing effects are opportunities, not reasons to randomly corrupt values. |
| SCI-21 | **Partial:** realism claim says all error is technique, while some logged positions, Doppler and synthetic instrument readings include generated scatter | Revise the claim. Separate technique, finite resolution, physical stochastic noise and systematic bias. All are legitimate if represented and reproducible appropriately. “No arbitrary noise for variety” is the useful rule. |
| SCI-22 | **Partial:** optical availability rules differ by tool | Centralize daylight, altitude, clouds, flare glare and reference-star visibility. StarsPanel lacks the same weather gating used elsewhere; rover imaging does not incorporate a general flare gate. Test each instrument under identical conditions. |
| SCI-23 | **Present but exploitable:** Sharp Eye awards 15 points for every affected discarded reading | Cap per anomaly episode or reward a demonstrated diagnosis once. Currently an unlimited series of bad readings followed by rejection can farm points. Do not reward manufacturing mistakes. |

### SCI-24 — What should make measurement engaging

The reward should happen at the instrument: a stable sightline, a fit separating two possible periods, a comparison finally agreeing. Keep uncertainty visible but avoid a dashboard of unexplained sigmas. A beginner needs “another night would help this slope”; an expert needs residuals, units, selection boundaries and provenance. Both should use the same data.

Do not turn every fit into compulsory hand algebra. Data selection, model choice and checking assumptions are scientific skills. Expert “fit by hand” is a valid optional constraint, but normal automatic arithmetic is not inherently cheating.

## 4. Predictions, planning and time

Evidence: [predictions](../src/game/predictions.ts), [prediction UI](../src/ui/common/Predict.tsx), [readiness](../src/game/readiness.ts), [clock](../src/game/clock.ts), [launch planner](../src/ui/launch/Launch.tsx).

| ID | Feature / current condition | Recommendation and acceptance condition |
|---|---|---|
| TIME-01 | **Present:** player predictions with plotted data, adjustable ±, commitment, scoring and explanations | Keep as the main short feedback cycle. Resolve the first one early; never frame an unsupported date guess as understanding. |
| TIME-02 | **Partial:** star, retrograde/stationary and moon predictions exist; not every proposed opposition/sunrise/target-position example is a complete distinct exercise | Add a small curated set linked to useful upcoming observations. Show future-axis units and an accessible numeric alternative to dragging. |
| TIME-03 | **Partial:** helper and own-fit nudge appear beyond the originally Cadet-only scope | Decide a coherent mode contract. Suggested: novice co-estimation; Navigator can explicitly request own-data trend; experts choose plots without unsolicited hints. |
| TIME-04 | **Present:** honest log scoring; **partial:** mode-specific strictness | Same probabilistic scoring is defensible. Prefer changing guidance and budgets to mysterious mode multipliers; publish any scoring differences. A huge interval is not automatically a good prediction. |
| TIME-05 | **Partial:** readiness shows measured count, weakest contributor and model-based Monte Carlo estimate | Separate “chain completeness” from “estimated flight success.” An empty model cannot honestly produce a day-one probability. Say “not enough information” rather than inventing priors invisibly. |
| TIME-06 | **Partial:** uncertainty paths, with up to 24 drawn in planner versus proposed 50–100 | Keep adaptive sampling for phone performance; a fixed path count is not the educational goal. Label Monte Carlo uncertainty and sample size; do not imply an exact percentage. |
| TIME-07 | **Partial:** cost map, orrery, windows and fuel/time transfer trade | Keep. Explain Fuel-saver/Fast/Custom relative to the proposed Cautious/Standard/Fast trio. Present fuel, duration and predicted risk together; never equate “fast” with “best.” |
| TIME-08 | **Absent:** persistent HUD launch-window countdown | Add after a model exists; show model provenance and uncertainty. Recompute if measurements change. |
| TIME-09 | **Partial:** warp, pause, tutorial jumps and launch-window stop exist; no universal event navigation | Add “next event” and player alarms for dusk, predicted stationary point, rover arrival, processing completion and prediction reveal. Experts see events inferred from their model, not secret truth. |
| TIME-10 | **Absent:** observing-time allocation calendar and Cadet automatic schedule | Prototype a lightweight timeline before a complex planner: available nights, weather forecast limits, transit windows, travel and air. Preview expected information gain with assumptions, not a guaranteed future success. |
| TIME-11 | **Partial:** activities during warp; no constellation drawing and limited camp jobs | Allow immediate skip and optional useful side activity. Never make busywork mandatory to justify waiting. A long-run player should choose depth, not endure a timer. |
| TIME-12 | **Partial:** activity time uses multiple clocks | Define seconds, local solar days and real play time explicitly. Locked planets have no normal solar-day cycle: “every night” refills/schedules need a different rule there. Freeze/charge life support consistently during flight and hops. |
| TIME-13 | **Absent:** full eclipse, occultation, meteor-shower, conjunction-glare and aurora event set | Occultation timings can improve moon inference; glare can explain unavailable observations. Meteor/aurora events can be photo moments. Use actual geometry where educational claims depend on it, and never lock a run behind rare luck. |
| TIME-14 | **Partial:** end-of-act hooks/save points exist; target cadence unmeasured | Keep Ground → Sky → Blue Planet → Moon → Flight, approximately 15/15/20–25/10/15 minutes as a hypothesis, not a verified schedule. Measure real pacing before balancing around it. |

**TIME-15 — Better failure learning.** A failed prediction should reveal a difference between model and observation, followed by one plausible explanation and a route back to the relevant instrument. Do not claim a unique causal diagnosis if multiple wrong inputs explain the miss. After the run, a counterfactual replay can vary one measurement and show how the route changes; present interaction effects rather than a misleading exact error-budget pie.

## 5. Campaign: every chapter

Evidence: [chapter features](../src/engine/chapters.ts), [campaign](../src/game/campaign.ts), [missions](../src/game/missions.ts), [acts](../src/game/acts.ts), [scripted scenes](../src/game/story.ts).

### CH-00 — Prologue: Fall

**Partial.** Tumble, delayed control, spin arrest, retrograde burn, entry, parachute and descent exist. The ship becomes the local camp. Separate descent fuel and emergency rescue protect the opening. A pre-deorbit orbital scan, genuine latitude selection, optional camp-deployment checklist and immediate landing medal are absent.

**Assessment:** strong physical hook, but ten seconds of deliberately ignored input can look broken. Display the failure clearly, allow replay skip and offer immediate agency after the opening beat. Within the first minutes, show the steady blue light and a human reason to reach it. Do not follow a full landing with a second long exposition sequence.

**Better implementation:** a short scan presents flat ground, hill and ice with meaningful consequences; the optional checklist deploys panels, unloads rover, visits near ice and starts processing. It must not require that novice players learn the complete economy before their first sky discovery.

### CH-01 — First Light

**Substantially present:** the full gravity/size/year/parallax/moon/transfer chain, relay object, journal entries and first Vale scene. Shared onboarding/flight gaps still apply. Tracking the relay currently leads to its explanation without requiring the specified period measurement.

**Keep:** twinkle → retrograde → blink parallax as the chapter's peaks. **Improve:** let a few timestamped relay positions rule out a fixed star, then infer an orbital range/period before reading its markings. End with an earned view of the target and a physical artifact, not just a results table. ECHO can regain confidence in arithmetic without handing over a measured truth.

### CH-02 — The Silent Planet

**Partial:** a moonless target, paid probes, aim/collision risk, Doppler curve, altitude and mass inference exist. The complete synthetic flyby record becomes available after arrival, rather than a player-selected nightly tracking campaign. Cadet automatic aiming, optical tracking nights, predicted-versus-observed probe-path reveal and orbital-decay dating clue are not complete.

**Keep:** mass from a flyby is more active and distinctive than a density guess. **Improve:** choose a small observation schedule, collect real-time samples at those dates, fit mass with uncertainty and show how a closer pass improves signal while increasing collision risk. Provide a nonfatal practice module. Make the recovered image initiate a debris-age investigation; atmospheric drag dating must include model uncertainty, not imply decay alone gives an exact launch date. Resolve “one last probe” dialogue versus the playable stock/retry rules.

### CH-03 — Thick Air

**Present foundations:** refracting horizon, alternative noon-shadow experiment, north–south trip and cairn narrative. **Partial:** the remote rover is a separate travel model; local exploration, weather and site history are not unified.

**Assessment:** productive failure works here if the player can diagnose the contradiction before exhausting patience. Show hill readings disagreeing with the shadow route; do not quietly correct away the chapter's lesson. June can identify the cairn's deliberate geometry and inspect ice while the Navigator designs the measurement. Validate local noon and latitude separation after any relocation.

### CH-04 — The Long Ellipse

**Substantial orbital implementation:** eccentric ephemerides, orbit fits, varying distance/speed and nonuniform launch searches. **Partial narrative implementation:** old star map, loss of Mira's crewmate and Ada's intervention are scripted rather than connected investigations. No player age fit of the star map exists.

**Improve:** overlay a circular model and an ellipse against the player's sightings; let residuals establish why the old method fails. A dated proper-motion map needs catalog directions, rates, epochs and uncertainty. Ada should materially stabilize the pod after a bounded repair decision, without supplying orbital values. Ensure optional hand-fit rules really cover this tool.

### CH-05 — Inward

**Partial:** inner geometry, greatest elongation, transit timing and solve chain exist. The telescope planet remains a full disk rather than showing the promised changing illuminated phases. Measuring a planet's transit does not by itself determine a separate beacon's orbit.

**Improve:** render the illuminated fraction from Sun–planet–observer geometry; compare successive phases with elongation. Model beacon sightings or its own transit timing if its orbit is the clue. Keep historic Venus-transit differential parallax as a distinct advanced experiment, not a misleading label for ordinary background-star parallax.

### CH-06 — Red Dwarf

**Partial:** red star, locked rotation, yearly stellar motion and stochastic flares exist. A brightness instrument and player flare-rate study are absent. Some optical tools have different glare gates.

**Improve:** replace ordinary dawn/dusk expectations with a twilight-zone rhythm and a consistent flare policy. Let the player estimate a rate and uncertainty from a log. Under a Poisson model, elapsed quiet time does not make a flare “due”; forecast probability over an interval, not an exact next flare. Mira's fear and Vale's weakening can give meaning to an uncertain forecast. Do not turn random flare timing into unavoidable observation failure.

### CH-07 — Slingshot

**Substantial mechanics:** giant planet, moon-based giant mass, orbit fitting and two-leg patched-conic assist. **Partial premise:** easier modes deliberately allow fuel margins that can make a direct transfer affordable; the dialogue's universal “impossible” claim is too strong. Spent-stage reconstruction is not an interactive clue.

**Improve:** either make the assist a mandatory routing requirement for the chapter or say it is the safer/cheaper route in forgiving modes. Let Tomas assess engine/structure limits while the Navigator measures the giant and chooses the geometry. Reconstruct a spent-stage position from an archived route and observe it where predicted. Avoid a fake assist bonus detached from actual energy/momentum exchange.

### CH-08 — Lost Among Stars

**Partial with a confirmed bypass:** nearby-star parallax observations and catalogue matching exist, but a successful ordinary transfer can be planned without `pStarA/B/C` or `navFix`. The story premise says there is no normal target flight, whereas the implementation still ends at a beacon planet.

**Decision needed:** use stellar fixing to aim the fold drive and end the chapter at a real location solution, or keep the target flight but require a justified fix before authorizing the jump. Gating on three entered numbers alone is insufficient: require observation provenance and a uniquely supported catalogue candidate. Do not force an exact answer when uncertainty supports multiple locations.

**Emotional role:** the player demonstrates where they are before confronting ECHO with evidence. The reveal should answer an investigation the player has pursued, not arrive automatically in a cache monologue.

### CH-09 — Home

**Partial:** Mars/Earth reference constants and inner-target navigation exist; the underlying “real Solar System” is a circular approximation. Descent uses the common thick-atmosphere parameters. Act III incorrectly requires `opposition` although this chapter offers `transit`. Final journal-delivery and Vale lines exist, but the final Navigator dialogue is fixed rather than selectable.

**Improve:** fix act mapping, model Mars's thin atmosphere, explain reference epochs/approximations and compare against credited values with sensible tolerances. Preserve the last flight as the payoff of accumulated skill. Show Earth gravity affecting familiar objects, let Vale leave her pod and allow the final “Within my error bars” / “Yes” choice without a scoring trap. Deliver Mira's journal as a tangible final artifact. NASA comparison should be meaningful, not a claim of high-fidelity ephemeris simulation.

### CH-10 — Beyond the campaign

**Absent proposal:** an Archive mission with real Kepler/TESS light curves. Strong optional extension after inner transits: infer period, transit depth and orbital distance, then reveal a real planet. Bundle a few small curated datasets; record units, provenance, stellar assumptions, detrending and published uncertainty. It does not require a VPS. Avoid implying that the simple depth relation captures limb darkening, grazing geometry or dilution without qualification.

**Alternative:** binary stars and density-analogy moonless systems were earlier chapter proposals, not implemented chapters waiting behind a lock. Consider them only after the nine existing chapters have complete learning and story payoffs.

## 6. Ship: the complete flight

Evidence: [ascent](../src/ui/launch/Ascent.tsx), [transfer presentation](../src/ui/launch/Flight.tsx), [descent/prologue](../src/ui/Prologue.tsx), [flight simulation](../src/engine/launch.ts), [descent engine](../src/engine/descent.ts), [hop engine](../src/engine/hop.ts).

| ID | Feature / current condition | Assessment and better implementation |
|---|---|---|
| FLY-01 | **Present:** manually flown ascent with pitch, thrust, autopilot and wasted-fuel penalty | Keep optional control for players who enjoy it. The current flight model uses true g/R and target orbit, not the promised estimate-dependent target guidance. Keep true dynamics but generate displayed targets from measured estimates. |
| FLY-02 | **Partial:** thrust is principally hold-to-burn rather than variable throttle | Add a large slider, full/cut buttons and desktop W/S steps. Rotation, throttle, stage/parachute and warp must fit phone reach without obscuring the trajectory. |
| FLY-03 | **Partial:** basic landing assistance exists; named level/retrograde/kill-rotation holds do not form the proposed mode ladder | Implement explicit hold targets and display current assist state. Assistance should stabilize commands, not secretly change gravity or remove fuel cost. |
| FLY-04 | **Absent:** departure maneuver scene and timed burn bar | Use the player-model parking orbit and Lambert target; charge actual timing/direction/impulse errors to the resulting trajectory. A timing mini-game with an arbitrary point penalty would break the causal loop. |
| FLY-05 | **Absent:** player optical-navigation sightings during cruise | Two or three meaningful observations can update a state estimate and covariance. Their information depends on angular geometry, target size knowledge and timing; more clicks must not automatically mean certainty. |
| FLY-06 | **Absent manual action:** mid-course correction is computed automatically and narrated | Let the Navigator plan, orient and burn against residuals, with autopilot where allowed. Keep model-predicted and observed positions distinguishable. |
| FLY-07 | **Absent:** capture/aerobrake/direct-entry decision | Add only after atmosphere, heat and arrival state are modeled. Capture costs fuel, aerobraking changes orbital energy, entry commits to a landing. Communicate fallback options and irreversible choices before selection. |
| FLY-08 | **Partial:** Flight is still a 14-second animation of a precomputed outcome | Replace with four concise scenes: departure, sightings, correction and arrival. Keep the map as context. The recent audio refresh improves feedback but does not implement manual flight. |
| FLY-09 | **Partial:** true and predicted paths are drawn together irrespective of the promised mode distinction; slingshot prediction comparison is omitted | Label observation, estimate and post-run truth separately. Show an observed position without giving experts the entire exact future trajectory. Add a physically consistent two-leg predicted overlay. |
| FLY-10 | **Absent:** launch countdown, wind holds, tank/crew checklist and max-Q lesson | Make holds a decision with forecast uncertainty, not a long forced delay. Max-Q should follow density and velocity; throttle changes must affect acceleration, drag and load. Avoid a decorative red gauge with fake fuel deductions. |
| FLY-11 | **Partial:** entry corridor/heat presentation, not a complete coupled orbital-entry simulation | Connect approach velocity, atmospheric density, lift/drag and heating to the landing state. Clearly distinguish arcade aids from modeled quantities. |
| FLY-12 | **Partial:** parachute deployment/tearing exists; auto/suggest/manual rules are incomplete | Use dynamic pressure and atmosphere-specific capability. Thin-air Mars needs terminal engine assistance. Prologue rescue and hard target landing outcomes need separate policies. |
| FLY-13 | **Confirmed inconsistency:** crashed arrivals are rescued through shared prologue logic, including hard modes | Preserve guaranteed survival only where promised. Else provide explicit rescue/assisted result classification or an actual hard-mode consequence. No silent success after a supposedly fatal landing. |
| FLY-14 | **Partial:** local x-position affects camp distances; not an astronomical site/latitude choice | Store current site and planet identity in state and in every observation. A latitude label must change the sky; cosmetic latitude is worse than no latitude control. |
| FLY-15 | **Absent:** pre-entry orbital scans, two or three named target pads, pad precision medals | Give pads meaningful terrain/visibility tradeoffs. Landing anywhere safe remains allowed. A precise pad bonus should be small and capped relative to measurement score. |
| FLY-16 | **Absent:** manual zoom, flag visibility toggle, player lights and easy-mode braking marker | Useful polish after stable controls. A braking marker must use the assist's stated information; allow reduced motion and static displays. |
| FLY-17 | **Partial:** target landing ends the run; no complete first-look scene/photo epilogue | Show the changed star/old home planet from the actual arrival geometry, crew response and collected journal. Target plant/hopping stays out of the scored run; sandbox exploration can follow later. |
| FLY-18 | **Alternative:** secret moon gravity assist | Current assist uses a giant. Do not claim the secret exists. It is advanced content requiring distinct encounter geometry and validation, not a small bonus switch. |

**FLY-19 — Protect measurement when manual flight arrives.** Manual skill should reduce execution error and improve efficiency; it should not magically reveal an unknown mass or undo a bad world model. Conversely, do not assert that every 10% model error is fatal: sensitivity depends on which quantity is wrong, the route, available observations and reserves. Demonstrate the relationship across controlled runs.

## 7. Surface exploration and towing

Evidence: [surface rules](../src/game/surface.ts), [driving](../src/ui/tools/RoverDrive.tsx), [map/actions](../src/ui/tools/SurfaceMap.tsx), [remote parallax rover](../src/ui/tools/Rover.tsx), [gnomon travel](../src/ui/tools/Gnomon.tsx).

| ID | Feature / current condition | Opinion and proper implementation |
|---|---|---|
| SURF-01 | **Present:** 1D strip ±40 km, continuous driving, slope response, parts/meteorites/clue finds | Keep the readable 2D scope. Improve destinations before enlarging the map. A larger empty strip is not exploration. |
| SURF-02 | **Partial:** one ice field near the original landing region, rather than 5–8 distributed deposits | Generate finite deposits with purity/depth and guaranteed reachable starter supply. A guarantee relative to the recommended plain is not a guarantee relative to every manual touchdown. |
| SURF-03 | **Partial:** scanner reveals nearby finds; core sampling, mining and buried-ice prospecting absent | Use visible frost plus scanner signatures, then a core sample that narrows uncertainty. Reserve discoveries for places the player actually surveys. |
| SURF-04 | **Absent:** multiple meaningful terrain materials | Firm plain: speed; boulders: damage at excessive speed; sand: slip/bogging; ledges: short run-up; slopes: traction; ice: low grip. Make each readable before adding its penalty. |
| SURF-05 | **Partial:** slope-aware motion and brakes; explicit high/low gears, analog throttle and integrated winch absent | Two gears and a clear brake/hold are enough. A 50 m winch needs a valid rock anchor, load limit, energy cost and visible tension. “Winch up anything” should not be literal. |
| SURF-06 | **Absent:** mode-specific traction control, auto gear, rock-knock policy and route preview | Easy modes can slow/feather automatically; Navigator warns; experts judge near terrain. A third knock causing repairs is a proposed balance value, not current behavior. |
| SURF-07 | **Absent:** night navigation from star fixes and manual headlights | A star fix can orient a map and teach latitude. Do not make navigation inaccessible to players unable to distinguish a visual constellation; offer a log/coordinate equivalent. |
| SURF-08 | **Absent:** dark-sky sites and overlooks changing instrument conditions | Best exploration addition: travel improves a measurement or reveals a clue. Use elevation, atmosphere and visibility; do not grant an unexplained precision multiplier. |
| SURF-09 | **Partial:** local battery is “km of range,” long-trip rover has separate speed/energy rules | Unify vehicle inventory, energy, location and travel logs. Remote travel may stay abstracted; it must use the same budget and arrival rules as manual driving. |
| SURF-10 | **Partial:** rover range challenge reduces speed but does not halve local battery capacity | Centralize effective capacity and speed; use them in driving, map tasks, gnomon and parallax trips. Verify the modifier in all paths. |
| SURF-11 | **Partial:** towing moves camp through a timer at 2 km/h with no physical energy/handling cost | Good optional convenience, weak gameplay. Add an abstract safe route first; manual trailer driving can be a later preference. Do not force repeated long towing sessions. |
| SURF-12 | **Absent decision:** detachable habitat versus wheeled whole-ship cradle | Prefer a deployable habitat only if the rendezvous creates useful choices. Track ship and habitat separately, allow packing/rejoining, and ensure launch cannot strand required equipment. A cradle is simpler but much heavier. |
| SURF-13 | **Absent:** hitch energy-sharing, heavy braking/runaway, jack-knifing and trailer knocks | Add only with credible traction/mass calculations (section 9). Autotow should be available, safe and slower; no forced precision driving for science-focused players. |
| SURF-14 | **Present:** hop autopilot and a separate hop allowance in most modes | Preserve actual flown cost estimation. The impulsive hop formula is a lower-bound guide, not the price of a finite-thrust flight. |
| SURF-15 | **Partial:** hard modes can automatically spend launch reserve on hops | Replace silent cross-feed with a closed-by-default valve and a cost preview. Provide a replenishable exploration tank before calling hard-mode hopping a meaningful option. |
| SURF-16 | **Absent:** pack panels/plant, stop trackers, carry rover at added mass or arrange rendezvous | Make packing one action with an inventory summary. Avoid four repeated deployment clicks at every move. If rover stays behind, its route, charge and ability to meet camp must be known. |
| SURF-17 | **Partial:** safe-pad search exists; landing rings, three-pad choice, hop medals and best-flight ghost absent | Add before new vehicles. Reward softness/accuracy/efficiency once per attempt, bounded per run. ECHO flights can complete travel without claiming manual-skill medals. |
| SURF-18 | **Absent:** 50–1000 km relocation, orbital/coast arc and global destinations | High-complexity optional expansion. Prioritize polar ice, high plateau, far-longitude baseline and Halcyon wreck because each changes a measurement/story outcome. No global traversal until site history works. |
| SURF-19 | **Confirmed gap:** hops do not advance the main clock, including hard modes | Charge simulated elapsed time through a shared clock policy and survival update; prevent double-charging after resume. Easy-mode waived costs must be explicit allowances. |
| SURF-20 | **Absent:** a rotating three-goal expedition log | Good if goals emerge from the current expedition: prospect three sites, pad within 10 m, clean tow, process water, observe at overlook, find wreck. Avoid random tasks that contradict the mission or encourage grinding. |
| SURF-21 | **Partial:** storms/leaks exist; dust-devil cleaning, frost hints, rockfalls and boil-off warnings absent | Favor persistent consequences and forecastable opportunities. A generated rockfall must not permanently block the only safe route. Cosmetic meteor showers need no resource reward. |

### SURF-22 — When a surface feature earns its place

A destination should provide at least one of: a new view, better information, a physical story clue, an interesting route, or a recoverable resource bottleneck. “Drive there to increment a counter” is insufficient. Once a route is mastered, let the player delegate repeat hauls and towing; preserve a manual option for players chasing a personal best.

## 8. Energy, water, oxygen and fuel

**Current condition:** mostly a proposal, not an implemented connected economy. The shipped state contains percent power, oxygen/food timers, range-based rover charge, ice loads, additive Δv production and hop allowances. It does not contain the proposed physical energy/mass-flow system. [Surface processing](../src/game/surface.ts) and [survival](../src/game/survival.ts) are the key evidence.

| ID | Proposed feature / current condition | Assessment and implementation direction |
|---|---|---|
| ECON-01 | **Absent:** sunlight/reactor → grid → batteries/loads; water → electrolysis → fuel/air | Promising because it connects sky, travel and survival. Build a small conservation-based model, not a full factory simulator. |
| ECON-02 | **Partial:** main Δv budget and hop allowance; no physical four-store panel | Track main propellant, hop propellant, plant buffer and breathing oxygen with capacities. If tracking H₂/O₂ separately, show meaningful inventory rather than pretending every store is interchangeable. |
| ECON-03 | **Absent:** player routing from plant to hop/main/air | H₂ and O₂ are co-products, not three mutually exclusive products. Allocate fuel pairs first, route spare oxygen, and allow deliberate oxygen production with hydrogen storage/venting. A simple three-way slider needs a clear physical definition. |
| ECON-04 | **Present:** main-fuel caps at 40/40/25/15/10% of baseline spare; **absent:** uncapped plant supply to exploration tank in every mode | Keep a bounded main-flight top-up if score fairness needs it. Explain it as hardware/mission reserve policy; an arbitrary ban is not chemistry. Uncapped production still needs tank capacity and available water/energy. |
| ECON-05 | **Absent:** explicit main→hop valve; no hop→main permitted | Good protection against accidental run loss. Choose closed by default for Navigator upward. Earlier wording says closed everywhere, while the balance table opens it in easy modes: resolve this visibly rather than inherit both rules. |
| ECON-06 | **Absent:** plant buffer boil-off at 0.5%/sol Navigator, 1%/sol hard modes | Potential planning constraint, potentially a punishment for astronomical waiting. Model only uninsulated buffer, show predicted loss and permit just-in-time production. Insulated main tanks need a stated cooling/abstraction policy. |
| ECON-07 | **Absent:** 2–40 t finite deposits, 20–90% purity, 0–2 m depth | Good exploration variety if nearby resource guarantees are tested. Report water mass separately from raw material mass. Use finite extraction and depleted-site visuals. |
| ECON-08 | **Absent:** 500 kg bin, scoop/drill and powered mining | One visible extraction action plus optional unattended haul route is enough. Fifty separate haul clicks for one hop would be a regression. Production rate must depend on purity, depth and power, not arbitrary rarity. |
| ECON-09 | **Partial:** process-a-load timers exist; continuous powered processing absent | Replace repeated 100 m/s button presses with “run until target/reserve.” Advance extraction/electrolysis over warp analytically or in bounded simulation steps; preserve mass/energy at partial completion. |
| ECON-10 | **Absent:** excess oxygen feeds survival | A strong connecting mechanic. Express person-days separately from whole-crew days and cryo consumption. Oxygen production does not supply food, scrub CO₂ or repair a leak. |
| ECON-11 | **Partial:** percent power and upgrades; no solar geometry, reactor output, camp bank or switchable loads | Show one generation-versus-load bar, then expandable details for life support, heaters, trackers, charging, greenhouse and plant. Without survival, essential camp safety can be protected while optional machines stop. |
| ECON-12 | **Absent:** physical rover battery, grid charger and field solar wing | Proposed 10 kWh battery, 0.08 kWh/km and 5 kW charger are starting assumptions. Charge only from available power; include slope/traction efficiency and reserve. Field recovery must be possible under the actual star/site conditions. |
| ECON-13 | **Absent:** fuel cell and carried canister | Attractive field/night recovery. Track reactants, output electricity, heat and returned water; prevent infinite energy from a circular conversion bug. Limit power if it makes solar irrelevant, rather than falsifying chemistry. |
| ECON-14 | **Absent:** dust accumulation and dust-devil/cleaning recovery | Keep cleaning optional/automatable, with clear output loss and recovery. Repeated mandatory panel wiping would be maintenance grind. Dust storms affect solar generation and safe travel consistently. |
| ECON-15 | **Partial:** food, oxygen, salvage, leaks, repair, greenhouse and upgrades exist | Retain the light survival layer. Prioritize decisions and recovery over random irreversible failure. Easy leak probability currently is not separately rarer. |
| ECON-16 | **Absent:** engine-fuel chemistry for CO₂ atmospheres | Methane production requires hydrogen and processing energy as well as CO₂. MOXIE makes oxygen; it is not itself a methane plant. Defer a second chemistry chain until water electrolysis works. |
| ECON-17 | **Partial:** tool upgrades exist; proposed telescope lens/radio ranging and broad crafting do not | Prefer explicit hardware sidegrades and time savings, limited by run/mode. Permanent precision upgrades across ranked runs would replace skill with grinding. |
| ECON-18 | **Absent:** story-gated fuel cache on a ridge | This conflicts with the fixed-reserve/measurement-protection direction unless carefully bounded. Prefer water, parts or an exploration-only canister; never a secret unrestricted main-fuel rescue that invalidates calibration. |

**ECON-19 — Make planning satisfying, not compulsory accounting.** Players should set “keep enough energy for tonight's tracker and fill one hop reserve,” then go observe. Display the consequence, notify at useful events and allow immediate warp. Easy modes can delegate operations; expert players may inspect every flow. A VPS is not needed for this economy.

## 9. Balance numbers and scientific corrections

These proposals need a recalculated balance sheet before implementation. Historical percentile tables were sampled claims from earlier builds, not universal constraints. The code's mode allowances and process caps are verified; all planet/system percentiles must be regenerated if physics or timings change.

### BAL-01 — Current configured surface values

| Value | Stargazer | Cadet | Navigator | Astronomer | Legend |
|---|---|---|---|---|---|
| Hop allowance | 6000 m/s | 4000 | 2200 | 1400 | 0 |
| Refill policy | “nightly” | “nightly” | three days | ice | none |
| Process one 100 m/s main-fuel load | 1 day | 2 | 3 | 4 | 5 |
| Main top-up / initial spare | 40% | 40% | 25% | 15% | 10% |

The “nightly” implementation actually checks 86400-second boundaries, not local night. Astronomer ice processing can instead add 400 m/s to the hop tank. There is no matching mass-flow model proving that fourfold conversion physically consistent. The baseline local rover is 15 km/h with 120 km charge-equivalent; charging adds 10 km/hour at camp. Remote travel uses 400 km/day or 700 with the battery upgrade. Towing is 2 km/h. These are current rules, not the proposed replacements.

### BAL-02 — Proposed numerical starting points, all subject to discussion

| Proposal | SG / Cadet / Navigator / Astronomer / Legend | Status / concern |
|---|---|---|
| Plant average power | 230 / 115 / 75 / 60 / 40 kW | Absent; define average delivered power versus nameplate solar capacity and base loads. |
| Camp battery | 300 / 200 / 150 / 120 / 100 kWh | Absent; test overnight essential loads as well as towing. |
| Rover | 10 kWh, 0.08 kWh/km; high/low 15/5 km/h | Absent physical model; wheel power, terrain and mass matter. |
| Charger / field solar | 5 kW / 1.5 kWh per sol | Absent; solar cannot charge in local darkness. |
| Deposits on strip | 7–8 / 6–7 / 5–6 / 5 / 5 | Absent; reachable guarantees matter more than a precise count. |
| Water on strip | 150 / 120 / 90 / 70 / 60 t | Absent; compare with actual hop/relocation needs, extraction loss and hauling burden. |
| Sols/tonne | 1 / 2 / 3 / 4 / 5–6 | Absent; derive from available energy and local sol duration. |
| Main-fuel caps | 40 / 40 / 25 / 15 / 10% of spare | Present current percentages; changing other systems can still change outcomes. |
| Buffer boil-off | 0 / 0 / 0.5 / 1 / 1% per sol | Absent; avoid draining essential reserves during a year of observations. |
| Tow energy | 2.5 / 3.5 / 5 / 5 / 5 kWh/km | Absent; based on different labeled habitat masses/allowances, not altered physical laws. |
| Nominal tow range on full bank | 120 / ~55 / 30 / 24 / 20 km | Arithmetic only; subtract essential reserve and losses before displaying usable range. |
| Abstract long-trip speed | 150 / 150 / 120 / 120 / 120 km/sol | Proposed, replacing 400/700 km/day; revalidate shadow/parallax deadlines. |

### BAL-02A — Historical sampled ranges, retained for comparison

These were reported 10th/median/90th percentiles across 30 generated systems per mode. They are **historical observations**, not newly rerun measurements or guarantees. Recompute them after any generator, mass, travel or economy change.

| Reported value | Stargazer | Cadet | Navigator | Astronomer | Legend |
|---|---|---|---|---|---|
| Total ship Δv, km/s | 19/22/25 | 17/19/22 | 15/18/20 | 14/17/19 | 14/16/18 |
| Spare Δv, m/s | 4900/6700/8600 | 2900/4000/5200 | 1700/2400/3000 | 980/1350/1730 | 730/1010/1300 |
| Maximum ice top-up, m/s | 1950/2700/3460 | 1170/1620/2070 | 430/590/760 | 150/200/260 | 70/100/130 |
| Approximate 100 m/s loads | 20/27/35 | 12/16/21 | 4/6/8 | 1/2/3 | 1 |
| Life support, Earth days | 965/1460/1880 | 860/1310/1670 | 800/1220/1550 | 760/1160/1480 | 750/1140/1450 |
| Flown 5 km hop / spare, percent | 14/19/25 | 23/31/42 | 40/53/71 | 70/93/125 | 94/124/167 |

Reported shared gravity was about 8/10/12 m/s² and flown 5 km hop cost about 1080/1200/1360 m/s. Earlier fuel-margin descriptions were about 30–63%, 18–38%, 10–22%, 6–13%, 5–9%; post-window air slack about 6 months–2 years, 3–13 months, 2–8 months, 1–5 months, 1–4 months. A 40-system competent-bot run reported 40/40, 40/40, 38/40, 33/40 and 28/40 successes. These numbers describe a bot protocol and historical configuration, **not human success rates**.

Proposed relocation estimates were ideal total Δv of 0.45/1.4/2.8/4.4/6.1 km/s over 5/50/200/500/1000 km, with suggested flown costs around 1.2/2/3.4/5/7 km/s and orbit around 8.4 km/s for the illustrative world. Only short-hop figures were described as measured; long-range flown estimates require a curved-world trajectory model and test flights. A planet's rotation, atmosphere and landing constraints can change them materially.

### BAL-03 — Water, propellant and Δv are not linearly interchangeable

Water gives approximately 1/9 hydrogen and 8/9 oxygen by mass. With an assumed engine oxygen/hydrogen ratio of 6, one tonne of water supplies about 778 kg of burnable mixture and 222 kg of excess oxygen. Those assumptions must be explicit; not all rocket engines use that mixture ratio.

For an assumed 35 t dry/final mass and exhaust speed 4.4 km/s, a small tonne of water corresponds to roughly `4.4 ln(1 + 0.778/35) ≈ 0.097 km/s`. That makes “100 m/s per tonne” a useful **small-top-up approximation**, not a universal conversion.

A 5 km/s reserve at that same final mass requires approximately `35(exp(5/4.4) − 1) ≈ 74 t` of burnable mixture, or about **95 t water**, before extraction/processing losses and retained-water mass. It is not simply 50 t. An idealized 1.2 km/s hop similarly needs about 14 t water rather than a universal fixed 12 t. These are illustrative mass-model checks, not validated flight costs. Decide what the 35 t includes, what mass departs, what is dropped and whether launch propellant affects hop mass.

**Recommendation:** either keep an explicitly abstract Δv reserve, or implement a consistent mass/rocket-equation model. Do not combine a detailed kg economy with linear Δv conversions while calling the result exact.

The same issue extends to the original whole-trip budget: 20 km/s at 4.4 km/s exhaust speed implies an ideal single-stage mass ratio around `exp(20/4.4) ≈ 94`, before flight losses. A 35 t lander cannot simply be treated as constant-mass hardware with that physical propellant requirement. Define staging, dropped equipment and whether the budget is a gameplay abstraction before extending the simulation's realism claims.

### BAL-04 — Electrolysis energy and oxygen supply

At 50 kWh/kg hydrogen, one tonne of water takes about 5556 kWh. A continuous 230 kW plant takes about 24.2 hours before other loads; 40 kW takes about 139 hours. Calling these “1” and “5–6” sols assumes near-Earth day lengths and a defined average available output. Solar peak power is not a 24-hour average. Include charging, heaters and conversion/storage losses.

At an illustrative 0.84 kg oxygen/person/day, 222 kg is about **264 person-days**, or about **53 days for five fully awake people**. Cryo consumption is a fictional assumption that must be declared. A large water operation could make oxygen nearly irrelevant; leaks, CO₂ scrubbing, food, temperature and pod integrity then need separate meanings. Do not keep saying “Vale has 41 days” if the player has just generated years of breathing oxygen and the actual failure is a different pod component.

### BAL-05 — Fuel-cell accounting

A hydrogen fuel cell's useful energy per kg of mixed reactants depends on oxygen/hydrogen ratio, lower/higher heating value, efficiency and balance-of-plant loads. “2.5 kWh/kg propellant” and “40% round-trip retention” are estimates to derive consistently, not two independent magic constants. Four kg for a 10 kWh charge may be a useful game approximation. Preserve water as a product and ensure electrolysis plus fuel-cell cycling always loses net energy. Never add resource mass twice by returning water while leaving reactants unchanged.

### BAL-06 — Sunlight, seasons and locked worlds

The proposal simultaneously says remote rovers drive by day and recharge at night from their solar wing. That is physically contradictory unless the fuel cell is the night source, or the rover is on an illuminated part of a locked planet. Fix the schedule: charge from sun while stopped in daylight, grid when available, or carried reactants at night.

A locked-world twilight camp may have weak or nearly absent direct solar input. A polar camp can have months of darkness. “A stuck rover can always solar-charge home” is therefore not guaranteed. Provide a finite recovery plan, safe route or reserve appropriate to generated conditions. Do not fix it by inventing sunlight.

### BAL-07 — Towing traction and force

A 12 t habitat at g=10 and rolling resistance 0.1 needs roughly 12 kN drawbar force. Work per km is 12 MJ ≈ **3.33 kWh**, before drivetrain losses, so 4–5 kWh/km is plausible as energy accounting. But an approximately 0.8 t rover has only about 8 kN normal load; producing 12 kN wheel traction would require an implausibly high friction coefficient on loose ground. A low gear multiplies torque, not available grip.

Resolve this before a “realistic” tow implementation: lower resistance with engineered wheels/firm routes, add powered trailer wheels, change tug mass, or use anchored winching. Downhill braking needs the same force-budget treatment. A one-dimensional trailer model cannot literally jack-knife sideways; use a clear simplified instability or add the necessary planar degree of freedom.

### BAL-08 — Momentum and terrain

At 15 km/h, v≈4.17 m/s. `v²/(2g)` at g=10 is only **0.87 m**, before losses. A 1–1.5 m ledge is not reliably cleared by a run-up at that speed, and no run-up climbs a 300 m hill. Choose obstacle heights from the reachable-energy envelope. A 50 m winch cannot anchor to arbitrary sand or an unreachable point.

### BAL-09 — Travel time and survival balance

At 2 km/h, a 10 km tow is five hours. Calling it half a sol or a whole sol requires explicit stops, deployment, charging or terrain. Ten hours at 15 km/h is 150 km, but energy, terrain and sun windows decide achievable travel, not an asserted daily rate.

Keep the years of astronomy time; do not shorten life support to make hauling consequential. Use energy, observation opportunity, reserve and route choices. Conversely, a large unchanged life-support number does not prove a new travel system preserves solvability: shadow dates, weather, charging and launch windows interact. Re-run the generator gate and a player-path validator after changing them.

## 10. Story, characters and emotional involvement

Evidence: [story bible](STORY.md), [implemented scripts](../src/game/story.ts), [scene host](../src/ui/StoryScene.tsx), [act cards](../src/ui/ActCard.tsx), [results](../src/ui/launch/Results.tsx).

### NAR-01 — Current narrative condition

The Kestrel accident, failing cryo-pod, Halcyon's forty-year-old trail, Mira's journal, chapter briefings, ECHO's recognition/reveal and final homecoming are present in scripts. Scenes can be skipped and read later. This is meaningful content, not an empty story shell.

However, most clues are **told after a milestone**, not reconstructed with instruments. Character state is primarily text, not a persistent model of relationships, responsibilities, memories and crew availability. ECHO explains nearly every system and often speaks other characters' roles. More dialogue by itself would deepen that imbalance.

### NAR-02 — Give the mystery a playable structure

Use a small evidence board inside the existing journal/constellation interface: **observation → supported inference → unresolved question**. Avoid exact “correct clue” confirmations until the player has enough evidence. A clue can unlock another location or observation; a journal page can offer a hypothesis without giving a required numeric answer.

Suggested thread: moving relay establishes prior visitors; debris and map establish an approximate age; cairn establishes another navigator using the same methods; the spent stage predicts an observable route; three stellar distances establish location; ECHO's conflicting memories explain why the route feels familiar. Each reveal should recontextualize an earlier artifact already encountered.

### NAR-03 — Clues need defensible inference

| Clue | Current gap | Better playable version |
|---|---|---|
| Relay satellite | Explanation follows tracking, not measured orbital deduction | Sample positions over time; distinguish fixed stars, a fast local orbiter and a distant planet; identify reflective geometry. |
| Debris age | A script asserts forty years from decay | Combine present orbit, atmospheric/ballistic assumptions and archived hardware data; produce an age interval, not an implausibly exact date. |
| Cairn/noon marks | Briefing supplies the interpretation | Let player compare shadow orientations and dates, then recognize a baseline/meridian experiment. June can interpret the material context. |
| Old star map | Proper-motion age is asserted | Fit epoch against several stars with known motion; include measurement uncertainty and nonmoving references. |
| Transit beacon | Planet transit conflated with beacon orbit | Observe the beacon's own distinct periodic signal/occlusion, or rewrite the clue to something the measured transit genuinely establishes. |
| Flare warning | Statistics described, not investigated | Compare Mira's estimated rate with the player's log and interval uncertainty; allow reassuring disagreement within statistical limits. |
| Spent stage | Narrative route, no observable reconstruction | Propagate an archived trajectory in the player's fitted system and look in the predicted search region. |
| Final stellar map | Fix exists but is bypassable | Require a supported navigation solution to aim the next jump; give ECHO's revelation a causal trigger. |

### CHAR-01 — The Navigator: agency without dialogue exams

**Current:** unnamed/gender-neutral role, mostly defined by actions; self-naming and the final response choice are absent. **Proposal:** optional name/pronouns only if desired, with “Navigator” always valid. Offer a few consequential preferences: cautious versus fast plan, repair priority, which hypothesis to investigate, when to risk a thaw. These should change reactions and approach, not hide a mandatory morally “correct” answer.

Let the player occasionally choose what to tell Vale: uncertainty honestly stated, progress explained simply, or a quiet promise grounded in the actual reserves. Never penalize a player for choosing the short dialogue version.

### CHAR-02 — Commander Ira Vale: a person, not an oxygen label

**Current:** first wake-up and chapter lines exist, with repeated `vale1` triggering globally; her distinctive once-per-chapter evolving presence is incomplete.

**Proposal:** Vale owns mission judgment and the crew's interpersonal stakes. She asks what the Navigator believes, recognizes an improved technique, and makes one small human request unrelated to tutorial instructions. Show her repaired pod and personal effects at camp. Give every chapter one short distinct scene, not a copy of the first thaw. Use pod integrity separately from oxygen; show why waking her has a bounded medical cost.

**Example, proposed writing:** “I can wait for another observation. I would rather wait for the right one.” That validates care without telling the player which measurement is correct.

### CHAR-03 — Ada Okoye: uncertainty in medicine

**Current:** Ada's chapter-4 intervention is narrative; some of her exchange is tagged as ECHO dialogue. **Proposal:** give Ada her own speaker identity and role. She can explain pod thermal margins, distinguish a fault from a symptom and set a medical reserve needed for a repair. Her estimate can have a range too, linking scientific humility to the crew's experience.

Ada should not demand endless med-kit collection or make arbitrary health losses. One meaningful decision—continue a careful orbital fit while she stabilizes Vale, or take a slower reserve-preserving route—can give her competence and presence.

### CHAR-04 — Tomas Rhee: the engineer who makes execution possible

**Current:** Tomas appears around the slingshot, largely as scripted description. **Proposal:** let him inspect thrust calibration, build a replacement coil from recovered parts and explain why the chosen departure profile is safe. He can operate the plant or safe tow while the Navigator observes, providing a human alternative to “ECHO does everything.”

Do not let his upgrade create magical Δv. Give a visible repaired component, bounded efficiency/restored capability and a callback to a previous engineering choice. A disagreement with Vale about reserves can be warm and specific, not a villainous obstruction.

### CHAR-05 — June Halverson: make the surface mean something

**Current:** June's promised ice/geology wake-up is missing. **Proposal:** she owns prospecting, interpreting the cairn, meteorites and the Halcyon wreck's environmental history. Let her read a core sample, distinguish ice purity from raw mass, and notice a deposit's shadow history. She can leave physical sample labels in camp and delegate repeat mining after the player establishes a route.

This gives driving a narrative partner and makes resource choices intelligible. Do not turn her into another voice reading every UI tooltip.

### CHAR-06 — Mira Sato: a relationship across time

**Current:** journal entries span the campaign, usually fewer than the suggested approximately three per chapter; dates progress backward between some later chapters. **Proposal:** build three optional forms rather than three mandatory pages: a technical sketch, an intimate note and a later correction. The player's own observation reveals why Mira amended a previous conclusion.

Mira should have her own desires, habits, losses and attachments, not exist only as an inspirational mirror. Keep her absent from the living cast as the story promises. Preserve original marks/errors on artifacts, then overlay the player's annotations. Reconcile journal chronology explicitly; a found-out-of-order page is fine if its order is intentional and clear.

### CHAR-07 — ECHO: make it impressive through behavior

**Current:** damaged-memory framing and a reveal exist; actual predictions/arithmetic do not progress as modeled repaired-memory capabilities. No persistent recall of particular best/worst measurements or calibrated respect system exists.

**Proposal:** give ECHO three bounded kinds of memory: scientific (which assumptions the player has supported), expedition (what route/repair failed before), and personal (what the Navigator chose to share). It can say “last time our short baseline fooled us” only when that event actually occurred. Deterministic authored conditions are enough; an external language model is unnecessary.

Show repair through presentation and behavior: less fragmented phrasing, a steadier display, newly accessible archive pages, a remembered observation, then an unexpected opinion. Do not lock basic arithmetic behind story repairs and make late chapters easier simply because ECHO secretly measures for the player.

ECHO should admit uncertainty, ask permission for optional explanations and respect quiet mode. A valuable advanced response is “both models still fit; this observation would separate them,” not another unsolicited hint.

### NAR-04 — Resolve the reveal's moral and causal inconsistency

The bible describes an inherited Halcyon core; the shipped reveal says ECHO **was** its computer, was lonely, and its beacon pulled the fold drive off course. That introduces agency/responsibility beyond a neutral damaged archive. Decide intentionally: inherited memories, an involuntary compatibility resonance, or a conscious risky rescue attempt. The crew should react differently to each explanation.

My preference is an involuntary signal interaction, followed by ECHO accepting responsibility for what it can repair now. It preserves sympathy and uncertainty without making the AI manipulate the player purely for a twist. If a deliberate act is chosen, allow Vale, Ada and the Navigator to respond; do not instantly erase the breach of trust.

### NAR-05 — Scene timing is an implementation requirement

**Current problem:** StoryHost renders during ordinary tool play whenever a log queues; it immediately pauses the clock. Act cards can appear when a tool submission completes. The rule “never interrupts measurement” is not enforced.

**Proposal:** queue by context and priority. Safe points include leaving a tool, finishing a submitted observation, camp arrival, a completed act or stable flight coast. Never interrupt a running stopwatch, drag alignment, burn or touchdown. Offer a small “new log” badge for optional content. Pausing should preserve input and prior clock state; queued scenes must survive reload without repeated playback.

### NAR-06 — Presence without a dialogue flood

Add a small crew panel, repaired objects, cabin lights, workbench notes, sample trays and short nonblocking exchanges. Use two-character conversations occasionally; give characters distinct typography/portraits and consistent speaker tags. Optional ambient lines should react to a meaningful event, not repeat every few minutes. ECHO remains the interface companion; humans carry expertise, relationships and disagreement.

Keep the same narrative available across modes. Experts can suppress coaching while keeping story. A story-light preference may batch scenes into logs, but should not deprive players of plot-critical discoveries. All scenes remain skippable and rereadable.

### NAR-07 — The ending and failure should preserve dignity

**Success:** arrival view → physical crew response → journal delivered → Atlas card → optional numbers. Show grade/fuel/medical state through a few authored variants without multiplying full scripts. Let the player take a photo and retain their expedition.

**Flyby:** visible receding clouds, honest remaining options, a short Vale response if awake. **Lost:** Mira's entry read in context, not random flavor text. **Expired:** deep-cryo/beacon ending connected to the Halcyon. **No escape:** a grounded abort with a meaningful explanation. Preserve story before rewind, and keep truth hidden until the player chooses final debrief.

An “arrival on fumes” variant is supported by resource data and would be inexpensive. A secret perfect ending is absent; I would prefer a cosmetic journal/crew variation rather than making the authentic emotional ending exclusive to flawless expert play.

## 11. Rewards, identity and replay

Evidence: [scoring](../src/engine/scoring.ts), [achievements](../src/game/achievements.ts), [Atlas/calibration](../src/game/atlas.ts), [Atlas UI](../src/ui/Atlas.tsx), [challenge rules](../src/game/challenges.ts).

| ID | Feature / current condition | Assessment and recommendation |
|---|---|---|
| REW-01 | **Present:** log-score-based values, grades and fuel/time/help breakdowns | Keep honesty central. Publish score components, avoid double-counting correlated derived values, and cap side-activity bonuses so logistics cannot outweigh navigation. |
| REW-02 | **Present:** calibration fraction and per-tool breakdown | Strong long-term identity. The ~68% target applies to honest 1σ intervals over enough appropriately sampled observations, not a guarantee for each run. Show sample count and uncertainty around coverage; four observations are insufficient for a confident personality label. |
| REW-03 | **Partial:** “overconfident/honest/underconfident” verdicts; proposed persistent calibration titles/rank progression not fully realized | Use encouraging descriptive feedback, not humiliating titles. “Your parallax ranges have been narrow” is more actionable than calling a person dishonest. |
| REW-04 | **Present:** Atlas stores completed successful and failed debriefs | Keep ownership after failure. “Every run” currently does not mean every abandoned partial run; add an incomplete expedition card without revealing truth if the player quits. |
| REW-05 | **Partial:** Atlas lacks proposed photo, custom constellation and complete illustrated system card | Add meaningful artifacts, actual measurements, observed sky and chapter identity. Export image/JSON locally before cloud sync. |
| REW-06 | **Present:** 13 achievements, including radius/gravity/star mass/parallax, repeats, honest ranges, fuel, unaided/survival and predictions | Keep recognizable scientific identities. Current thresholds differ from old examples: Tycho is 30 readings, Lean Burn is 15%; these are tuning differences, not absent systems. No dedicated Retrograde Witness badge was found. |
| REW-07 | **Partial:** optional Astronomer modifiers replace the twenty-rank ladder | Keep combinable badges and transparent bonuses. No-formula, survival and no-sanity overlap with Legend and correctly should not earn duplicate credit. |
| REW-08 | **Partial:** worn stopwatch, bad seeing, tired rover, no formulas, forced survival, hand fit, no sanity and short supplies exist | One-save was proposed but replaced by short supplies. Resolve that contract. Disable **all relevant** automatic fits under hand-fit, and all promised warnings under no-sanity; current enforcement is incomplete. |
| REW-09 | **Absent:** dedicated 2–5-minute challenge puzzles with three-star ratings | Valuable optional short play: recover g from limited attempts, identify a planet before dawn, diagnose a biased reading. Use original scientific choices rather than raw click speed or exact-answer fishing. |
| REW-10 | **Absent:** bronze/silver/gold medals for every landing/ascent/burn/tow/rover expedition | Good local feedback once the actions are substantive. Judge softness, pad error, burn residuals, energy and technique; record assisted versus manual context and cap repeat points. |
| REW-11 | **Partial:** records exist, not a universal per-seed medal board/ghost system | Add personal bests per seed, mode, assistance, challenge set and engine version. A ghost hop is own execution history, not a free true future trajectory. |
| REW-12 | **Present:** daily/random seeds and emoji result copying; **absent:** image share card and friend-result links | Add spoiler-safe image export and links that encode the complete run identity. Do not leak measurements or the story reveal before the recipient finishes. |
| REW-13 | **Partial:** private star/home/target/moon names; ship/self naming and universal dialogue naming absent | Keep private naming; use actual names in Atlas, planner and authored placeholders. Public naming should use curated/generated choices until moderation exists. |
| REW-14 | **Absent:** player-drawn named constellations | High-value creative feature. Store catalog star IDs and connections, allow undo, and render them as observed references. ECHO can use the chosen label only when its stars are actually visible. |
| REW-15 | **Absent:** automatic Navigator's Journal and PDF/certificate | Capture selected real actions, errors, photos and interpretations. Keep Mira's authored journal distinct from the player's diary. Export locally with a print layout, no VPS required. |
| REW-16 | **Absent:** achievement cosmetics, ship paint, camp flags, ECHO colors and visual camp growth | Good rewards if optional and modest. Repaired antenna, greenhouse stages, rover tracks and sample trays can double as actual state feedback. Avoid permanent precision upgrades earned by grinding. |
| REW-17 | **Absent:** forgiving daily streak/freeze | Low priority. A completed expedition collection and fresh weekly scientific question are better first investments. If streaks arrive, optional freezes, no loss-shaming and no exclusive expiring rewards. |
| REW-18 | **Alternative:** three-at-once batch truth confirmation | Not shipped. I recommend deferring or restricting it to an explicitly assisted exercise: it still leaks truth and can encourage brute-force submissions. A consistency check is more faithful to scientific uncertainty. |

### REW-19 — What I would remove, simplify or avoid

Remove misleading “fully implemented” claims, not useful foundations. Replace repeated load-processing clicks with target-based automation. Remove uncapped reward farming. Separate mandatory teaching from optional explanation. Avoid stacking a twenty-level rank grind on top of five modes and eight modifiers. Avoid hidden accuracy advantages from permanent upgrades. Do not require repeated manual travel along solved routes. Do not introduce combat, loot boxes, paid fuel, energy paywalls or guilt notifications to solve a pacing problem.

## 12. Presentation, audio and accessibility

| ID | Feature / current condition | Assessment and proposed next step |
|---|---|---|
| UX-01 | **Present:** stylized physical sky, camp stations, terminal panels, mono HUD and phone layout | Keep the recognizable art direction. Use accent colors sparingly, readable text and explicit units. Do not replace usable instruments with decorative diegetic clutter. |
| UX-02 | **Partial:** constellation dependency lights/uncertainty presentation; full ignition/line-draw/launch-pulse choreography incomplete | Add brief local feedback that reflects actual saved values and uncertainty. Reduced-motion settings need static equivalents. |
| UX-03 | **Present after refresh:** original scene-based electronic score, fuller flight percussion, quieter measurement/story arrangement | Keep the new audio. It currently reacts to scene/activity, not directly to every dusk or retrograde discovery. Add event accents only where they carry information; keep silence/low intensity during precision timing. |
| UX-04 | **Present:** mechanical ticks, measurement chirps, shutters, radio cue, discoveries, launch/chute/touchdown and thrust-responsive engine layers | Full telescope motor whir, pendulum creak and material-specific rover sound are still possible polish. Avoid replacing all distinct cues with one loud reward chord. |
| UX-05 | **Present:** separate music/effects levels, saved preferences, gesture unlock, background suspension and audio cleanup | Keep. Native phone/Safari listening and long-session fatigue need user evidence; rendered clipping tests alone cannot prove subjective quality. |
| UX-06 | **Absent:** opt-in haptics for swings, detents and launch | Progressive enhancement only; unsupported devices must lose no information. Keep timing-related vibration short and independent from judgment of truth. |
| UX-07 | **Absent:** complete photo mode, clean HUD-free image, arrival view capture | Valuable for explorers and sharing. Provide frozen composition/annotation options without revealing unobserved objects. Save local files without requiring an account. |
| UX-08 | **Absent as a suite:** color-blind palettes, dyslexia-friendly font choice, reduced motion, enlarged reticles and alternative instrument controls | High-priority access work. Differentiate curves with shape/dash/labels; expose a textual observation log; do not rely on red/green or tiny moving targets alone. |
| UX-09 | **Absent:** optional text-to-speech, full captions/visual equivalents | Keep every meaningful audio cue redundant in text/visual feedback. ECHO speech must be interruptible and separately controllable; do not require network speech services. |
| UX-10 | **Absent:** assist toggles for auto-count, no hand sway, slowed pendulum and flexible novice reserves | Separate motor accessibility from scientific difficulty. For competitive comparisons, record assist configuration; do not shame access needs or ban equivalent input methods from the whole game. |
| UX-11 | **Partial:** keyboard/touch actions exist; comprehensive focus/drag alternatives not established | Every drag needs a keyboard/numeric route, controls need labels/focus visibility, modals need correct focus/escape behavior, and canvases need a meaningful nonvisual data representation. |
| UX-12 | **Unverified:** “60 fps on any phone” and “under three minutes to first fun” | These are targets, not established facts. Profile low-end phones, high-DPI canvases, long logs and orbit fitting. Move expensive fits/generation to workers if measured stalls justify it. |
| UX-13 | **Absent:** PWA install/offline asset policy and optional notifications | Add a versioned app shell and cache strategy; protect old saves during updates. Browser offline capability is separate from a web page that happens to remain open. Notifications require permission and a reliable mapping between wall time and simulation time. |
| UX-14 | **Absent:** “Previously on…” resume recap | High-value low-scope addition: current hypothesis, last kept reading, next predicted event, rover/plant state and one unresolved story question. Do not replay the whole tutorial. |

## 13. Saving, reliability and engineering

Evidence: [store](../src/game/store.ts), [checkpoints](../src/game/checkpoints.ts), [world generation](../src/game/world.ts), [solver](../src/engine/solver.ts), [validator](../scripts/validate.ts), [tests](../tests), [Pages workflow](../.github/workflows/pages.yml).

### TECH-01 — Architecture and deployment

**Present:** Vite/TypeScript/React/Zustand/Canvas, pure engine modules, local persistence, static Pages deployment, no account, English UI. Framer Motion, Howler and Pixi were proposed implementation options, not missing gameplay obligations; CSS/Web Audio/Canvas are valid choices. A “single page” does not have to be a literal single HTML file.

Keep the static client when adding a service. Preserve pure physics modules and test them independently from presentation. Use workers for heavy solver/fit work if profiling warrants it. The existing ~779 kB minified JS bundle warning deserves measured optimization, not a large framework rewrite for its own sake.

### TECH-02 — Persistence and truthful resume

**Present:** periodic/page-exit clock saving, three manual slots, prelaunch rewind and cross-run Atlas/log/campaign progress. **Partial:** flight/ascent/descent simulation state lives in component refs and resets after a reload; “resume anywhere” is not exact.

Store phase, vehicle state, queued events, route, input-independent simulation state and the relevant model snapshot. Reopening must neither reset an impending crash nor charge the same resource twice. Version the save schema and migrate old loads to an explicit initial water/mass model, without granting a second starter cache. Recover gracefully from quota, blocked storage and corrupted saves; offer local export/import before optional cloud sync.

### TECH-03 — Checkpoint and truth policy

The intended beginner/expert save limits are mostly enforced by UI and preserved counters. Keep attempts to learn from failure legitimate in casual modes. Test that checkpoint restore cannot reset verification limits, rewind costs or end-of-run truth state contrary to the chosen contract. Put essential restrictions in shared actions as well as buttons. Browser-local “one shot” is an honor rule, not cheat-proof security; do not promise more.

### TECH-04 — Scientific provenance

Every observation should carry instrument, time, planet/site coordinates, raw value, correction, selected hypothesis, uncertainty and kept/dropped state. Derived values should record dependencies and model version. A future moved camp cannot reinterpret old observations using its new location. A planet's generated truth remains immutable; current observer location belongs in game state.

### TECH-05 — Conservation and event simulation

Use one advance-to-time layer for travel, survival, production, battery charge, boil-off and astronomical events. Test equivalent outcomes under small steps, big warp, pause/resume and reload. Handle events in chronological order and avoid negative inventory. Do not update a physical plant only once per rendered frame and then lose months of production at high warp.

### TECH-06 — Solvability is broader than a bot win

The solver is valuable but can use measurement pathways that bypass actual UI constraints, travel scheduling, probe costs or environmental rules. Validate the generated **human-accessible route**, not only equations given synthetic measurements. Include sightline availability, local noon, charging, required chapter inference, reserves and at least one reachable window. Keep previous validation rates labeled with sample size, skill assumptions and engine version.

### TECH-07 — Regression targets

Add focused tests for chapter-8 fix gating, chapter-9 act IDs, all challenge paths, observation availability, save migrations, resource conservation, time charged on hops, site history, assisted versus hard arrival outcomes and real-atmosphere descent. Add browser journeys for tutorial completion, a novice expedition and each chapter's new tool. A small property-based suite over seeds and time steps is more valuable than tests that simply copy implementation constants.

### TECH-08 — Existing evidence and remaining portfolio work

The current suite has **45 tests in 14 files**, rerun successfully for this review, and the audio refresh has Chromium/render/production checks. This establishes specific engineering behavior, not a complete game audit or proof of learning. The validator report is present. Local telemetry/export, a one-minute portfolio video and a one-page technical evidence document are not present as the originally proposed deliverables. Historical deadline/team/language questions and a missing table in an unavailable original eight-page source cannot be resolved from this repository; do not invent their contents.

## 14. Different players and sustained enjoyment

No design can make all people play indefinitely, nor should leaving be treated as a failure. Aim for **voluntary continuation because a new question feels worth answering**, with an easy way to stop and return. The following are proposed experience targets to test, not claims about current measured behavior.

| Player | What to preserve | What currently loses them | Best targeted changes |
|---|---|---|---|
| Newcomer / younger learner | Real tools and a reachable first success | Too many terms, long setup, late feedback | Guided first estimate, progressive HUD, clear objective, generous recovery. |
| Curious explorer | Beautiful sky, mystery and discovery | Logs that explain discoveries before the player makes them | Evidence-led clues, overlooks, photos, personalized constellations, visible artifacts. |
| Olympiad / expert | Valid physics, uncertainty, demanding decisions | Inconsistent restrictions, easy bypasses, tedious repeated chain | Reliable expert rules, alternate routes, residual plots, versioned comparative challenges. |
| Relaxed stargazer | No pressure, freedom, creative ownership | Obligatory prologue/tutorial, survival chores | Direct Free Roam, creative tools, optional flights, no grade pressure. |
| Flight enthusiast | Physical control and satisfying execution | Precomputed transfer with no decisions | Real departure/sighting/correction scenes, pads and bounded skill medals. |
| Driving/logistics enthusiast | Terrain and purposeful expeditions | Timer towing and repetitive load processing | Readable surfaces, resource routing, optional manual towing, worthwhile sites. |
| Story-focused player | Crew relationship and Mira's trail | ECHO monologues with little agency | Character-owned tasks, clue reconstruction, physical camp changes, earned homecoming. |
| Completionist / builder | Atlas, achievements and expression | Collectibles disconnected from play | System cards, journal, cosmetics and meaningful collections without grind. |
| Social player | Fair comparison and shared discoveries | Seed entry alone has little social feedback | Friend links first, then weekly boards and cooperative parallax. |
| Teacher / club | Seed control, transparent methods and evidence | No classroom results/export, access barriers | Local report/PDF, optional class session, anonymous distributions and accessible instruments. |
| Returning player with little time | Saved context and short accomplishments | Relearning what a long run was doing | Reliable resume recap, short scientific challenges and act-level saves. |

### ENG-01 — The first ten minutes

Target a clear sequence: receive control → land or skip a familiar landing → identify one intriguing light → make one measurement → state one small prediction → see it resolve. Offer a weight comparison after g, a steady-reading acknowledgement based on technique and a clue worth pursuing. Do not give away g/R/year merely to light progress stars. Universal constants and a functioning clock can count as setup already understood, but distinguish them from player discoveries.

### ENG-02 — A long session should change texture

Alternate focused measurement, physical travel and quiet interpretation. Every 10–15 minutes is a **pacing hypothesis**, not a requirement to interrupt play with a reward. A reveal, new method, crew exchange or new observing site can refresh attention. Keep three visible horizons: the next useful observation, the chapter's unresolved question, and the route home. Offer immediate Continue at act boundaries rather than forcing breaks.

### ENG-03 — Autonomy is more valuable than extra chores

Let the player choose when enough evidence is enough; which route answers a question; whether to fly/drive manually; and whether to inspect the technical explanation. Their model must have consequences. Automation should handle already-understood repetition while preserving scientific decisions. If a surface task consumes time without producing knowledge, agency or a worthwhile scene, simplify or remove it.

### ENG-04 — Retention without manipulation

Keep no paid boosts, randomized paid rewards, artificial energy paywalls, fear-of-missing-out items or shaming messages. Optional recurring events should remain replayable. Notifications can be adult, useful and at most daily, never pleading. “Opposition tomorrow” is only meaningful if the simulation actually advances with wall time; otherwise remind about a saved plan, not a false real-time event.

### ENG-05 — Evidence, not borrowed certainty

Research on competence/autonomy/relatedness, productive failure, intrinsic integration, curiosity, player ownership and peak/end experience supports promising directions. It does not establish that every feature here will improve Stranded. A harsh failure can discourage a novice even when productive struggle helps another group. Competitive retention benchmarks cannot be transferred directly to a browser astronomy game. Test the intended audience.

## 15. VPS and Cloudflare opportunities

**Current condition:** no leaderboard/classroom/co-op service, account system or connection layer is implemented. Servers are not needed for the core game, photos, local journal/PDF, constellations, better story, the resource economy, Archive datasets or basic PWA support. Do not delay those features until hosting exists.

### NET-01 — A sensible first online release

Start with **shared weekly expeditions and completed-run comparison**, not real-time multiplayer. Keep the static game on Pages; add a small versioned API. Publish a UTC weekly challenge definition containing engine version, seed, chapter/twist, mode, permitted assists/modifiers and scoring version. Let participants see a distribution of finished outcomes and their own calibration/fuel/time tradeoff. Keep answers and ghost measurements hidden until submission.

A leaderboard should not rank raw numerical accuracy alone. Use the published honesty-aware score, bounded side rewards, and separate comparable configurations. Show sample count and distributions rather than just “rank 13.” Local-only personal records remain available if the service is down.

### NET-02 — Hosting choice

| Option | Good fit | Costs / operational work | Recommendation |
|---|---|---|---|
| Cloudflare Workers + D1 | Small JSON API, weekly definitions, relational result queries | Request/CPU/database quotas, migrations, platform-specific runtime; verify current pricing and fail behavior | Good first service for a small team comfortable with its limits. |
| KV | Cached weekly configuration or public summary | Eventual consistency; weak fit for atomic contested names/leaderboard writes | Use as cache/config, not the sole source of transactional competition results. |
| Durable Objects / WebSocket coordination | Co-op rooms and synchronized simulation events | Room lifecycle, reconnect handling and per-room costs | Consider after asynchronous sharing proves useful. |
| Object storage | Optional exported images or replay artifacts | Storage/egress/retention and moderation | Store only if users actually need cloud media; local export comes first. |
| Small VPS + SQLite/PostgreSQL | Conventional API, WebSockets, controlled simulations and custom tooling | OS updates, TLS, monitoring, backups, restore drills, abuse limits and possibly bandwidth charges | Good when operational ownership is welcome; fixed VM pricing does not mean every related service is fixed-price. |

Old “100,000 requests” and “free means never billed” statements should not be treated as a procurement guarantee. Check current official limits, billing mode, storage and enabled products before buying. Set budgets/alerts and documented degradation behavior. A free-limit failure should disable optional online features, not break a saved expedition.

### NET-03 — Data and trustworthy submissions

Minimal entities: challenge definition, pseudonymous player identity, run ID, engine/scoring versions, configuration, submitted event/measurement summary, validation status and result. Use an idempotent submission identifier, server-side bounds/schema checks, request limits and bounded payloads. Do not accept a client-supplied “S grade” as proof.

A deterministic replay can check whether a claimed trajectory is consistent with an event log, but a public client contains its own physics and seed-derived truth. This cannot prove that a person measured honestly. Describe boards as casual unless an appropriate competition protocol exists. Signing a client-generated score does not solve cheating. Separate assisted, sandbox, version-changed and modified runs.

### NET-04 — Friend challenges and public names

**Absent; partly possible without a server.** First add share links with seed/twist/mode and a spoiler-free target result. A server can later resolve short links and compare completed runs. Public names should be selected from generated/curated options. First-completer naming needs an atomic claim and a rule for ties, invalidated results and version changes. Free text needs filtering, reporting and human review; generated names still need basic abuse controls.

### NET-05 — Cooperative parallax

**Absent.** A short room code pairs camp and remote observer. Synchronize a **simulation timestamp**, not two human finger taps or network wall clocks. Server/room logic verifies both frames correspond to the agreed event and configuration. Let each player align their own image, combine measurements and discuss the inference. Handle dropped connections, late frames, room expiry and a solo fallback.

Do not market this as technically trivial: a relay is small, but consistent time, reconnects, privacy, accessibility and shared scientific state are substantial design work. Prototype copy/paste frame exchange locally before a full service.

### NET-06 — Classroom mode

**Absent.** Let a teacher create a session code and select a fixed challenge; students join with pseudonyms, work independently or in pairs, and reveal class distributions only after completion. Export CSV of explicitly consented educational metrics and printable journals, not unrestricted private dialogue/history. Include session deletion, retention periods and a teacher explanation of what is collected. No public student leaderboard by default.

### NET-07 — Connection layer and post-run ghosts

**Absent.** Preset location tips, modest supply gifts and acknowledgements can create relatedness. Keep tips free of numeric answers, reveal community contributions after the recipient has encountered the place independently, and bound duplicate gifts. Supplies alter difficulty, so gifts belong in casual/social runs or separate boards. Ghost opposition picks/wire placements are useful **after** a completed result, never a source of answers during a scored attempt.

### NET-08 — Recurring real-sky events

**Absent.** Strong candidates: equinox shadow week, Mars-opposition expedition, eclipse timing challenge and a predictable monthly Sky Night/photo prompt. Existing concepts mentioned February 2027 Mars opposition and the August 2027 eclipse; verify exact event dates, location visibility, magnitude/size and educational data before publishing a schedule. Do not revive dropped phone-sensor Earth Missions without discussion. Archive events and make rewards earnable later; do not create a one-week chance to finish the Atlas.

### NET-09 — Save sync, privacy and service boundaries

**Absent.** Optional cloud saves can help classrooms and multi-device players, but require identity/recovery, version conflict handling and deletion/export. Start with local export/import. Use minimal pseudonymous data, explicit opt-in telemetry and clear retention. Never expose secret API credentials in the static bundle. Keep administrative actions separate from public endpoints; monitor operational faults without collecting unnecessary personal information.

## 16. Playtesting and evidence

### TEST-01 — Instrument the experience before making retention claims

**Absent:** the promised local gameplay telemetry and tester export. Implement a small versioned local event log: session start/end/reason; tutorial step and elapsed active time; reading kept/dropped/corrected; prediction commitment/reveal; launch plan/readiness/outcome/reserves; checkpoint, rover trip, plant route and story interaction. Log simulation time and active real time separately. Do not infer “abandoned from boredom” solely from a closed tab.

Offer “Export playtest log” with a readable preview and no network upload by default. Later anonymized uploads require explicit opt-in. Bound log size and redact typed names/free text. An aggregate script should report completion, bottlenecks, learning-related trends and uncertainty around small samples.

### TEST-02 — Metrics and how to interpret them

| Metric | Previously proposed target | Proper use |
|---|---|---|
| Time to first meaningful feedback | under 3 minutes | Define first prediction reveal or technique acknowledgement; measure setup separately. Do not add a fake medal to satisfy the metric. |
| Tutorial step loss | no step loses >10% | Investigate confusion and access barriers; exploratory exits are not always failure. |
| Next-day / week return | ≥30% / ≥12% | Hypotheses, not validated promises. Define eligible cohort, time zones, unique local profiles and consent. |
| Cadet run completion | >60% reach launch | Separate reaching launch from surviving arrival; exclude neither difficult seeds nor exits silently. |
| Calibration | tending toward ~68% for 1σ | Show sample size and per-tool bias; account for selection and correlated observations. |
| Prediction error | decreasing within/across runs | Compare similar tasks and uncertainty, not raw units across unrelated chapters. |
| Learning transfer | improvement on six short concept questions | Optional research outside the “no quizzes” game flow; avoid repeating wording that measures memorization only. |
| Enjoyment / competence / autonomy / desire to continue | 1–7 feedback questions | Combine with observation and interviews, not a single happiness average. |
| Session-end reason / dead-time locations | no established target | Ask voluntarily; distinguish satisfied stopping, interruption, frustration and completion. |

### TEST-03 — Practical playtest rounds

Start with 5–8 testers: beginners, competition students, story/exploration players and people using phones/access tools. Observe think-aloud play without coaching except after a defined stuck interval. Ask what they believe the world is doing and why they took an action. Check whether they can explain a prediction miss without seeing the truth table.

Use successive small rounds for usability. A/B testing needs stable builds, comparable cohorts and enough data for the claimed effect; five testers split in half cannot establish a reliable retention uplift. For small rounds, look for clear failure patterns and strong qualitative evidence. Keep features that increase enjoyment **without** undermining the learning/physics contract; move optional dexterity challenges to appropriate contexts if needed.

### TEST-04 — Test gates for major systems

| Change | Required evidence before calling it complete |
|---|---|
| New chapter / alternate measurement | Known-value recovery, actual tool reachability, novice browser path, mode rules and story inference. |
| Economy | Mass/energy conservation, capacity bounds, equivalent warp steps, production across night/storm/locked-world conditions and old-save migration. |
| Unified rover | Reachable return route, reserve handling, challenge consistency and revalidated shadow/parallax timings. |
| Towing | Drawbar force, traction/braking, route feasibility, autopilot parity and no required equipment stranded. |
| Manual flight | Commands change physical trajectory; displayed guidance uses chosen model; assistance is labeled; resumable vehicle state. |
| Relocation | Site history preserved; old readings retain original geometry; every chapter closes its solve chain after a move. |
| Story | No interruption during timing/alignment/burn; skip/log replay works; facts never leak measured truth; distinct speakers and coherent chronology. |
| Online boards/co-op | Versioned configuration, submission validation, reconnect/duplicate handling, spoiler policy, load limits and graceful outage. |
| Audio/accessibility | Device listening, cue redundancy, saved independent controls, keyboard/touch paths, reduced motion and low-end performance. |

## 17. Issue register and implementation sequence

The following findings are actionable. Severity refers to impact on trust/progression, not implementation size. A design proposal's absence is not itself a bug.

| Issue | Evidence / current consequence | Recommended next action |
|---|---|---|
| BUG-01 — chapter 8 learning bypass | A `stars` model/transfer can succeed after removing all three stellar parallax values; launch does not require `navFix` | Decide chapter endpoint, then enforce supported fix at the correct mission/jump boundary. |
| BUG-02 — chapter 9 act mismatch | `missionsFor(9)` uses inner/transit set; `actsFor(9)` keeps base `opposition` requirement | Share inner-target act mapping and test every chapter's act IDs against its mission set. |
| BUG-03 — reward farming | Sharp Eye adds 15 for every affected discarded reading with no episode cap | Award one bounded diagnosis or validated correction per anomaly episode. |
| BUG-04 — hard-mode promises contradicted | Legend can choose ECHO ascent; crashed target descents are rescued | Align effective mode policy with explicit promises; separate opening rescue from final landing. |
| BUG-05 — missing hop time | Simulation advances only during ordinary play; hop component does not charge elapsed time | Advance through shared time/resource accounting and test reload boundaries. |
| BUG-06 — Mars atmosphere wrong | Shared descent uses `rho0=1.1`, `scaleH=8500` | Introduce planet-specific atmosphere and parachute capability; label approximations. |
| BUG-07 — challenge enforcement gaps | Local rover capacity, nonstandard automatic fits and some helpers ignore modifiers | Centralize capabilities; test every instrument and travel path. |
| BUG-08 — story interrupts instruments | Queued story immediately mounts/pauses during play | Add safe-context scheduling and retained pending scenes. |
| BUG-09 — incomplete exact resume | Live flight state resides in component refs | Persist vehicle/phase state or narrow the resume claim until it is real. |
| BUG-10 — inconsistent observation availability | Stars/weather/flare gates differ across tools | Centralize visibility and environmental rules, with explicit instrument exceptions. |
| BUG-11 — local day mismatch | Earth-day boundaries used for nightly refills/anomaly grouping | Define local sol/locked-world schedules and consistent event timestamps. |
| DESIGN-01 — impossible physical balances | Linear fuel extrapolation, nighttime solar charging and insufficient tow traction | Resolve section 9 assumptions before implementing the proposed economy. |
| DESIGN-02 — story continuity gaps | ECHO identity/causality differs between bible/script; late journal dates regress; some characters speak through ECHO tags | Agree narrative canon and update scripts after discussion. |
| DESIGN-03 — false completion / evidence claims | Feature presence inferred from menu/checkmark; bot rates presented too broadly | Keep testable acceptance criteria and distinguish engine validation from human outcomes. |

### ROAD-01 — Recommended staged program

| Stage | Deliverable | Why now / exit criterion |
|---|---|---|
| 0 | Discuss report and record decisions | Agree scope, story canon, mode/manual contract and economy assumptions before coding. |
| 1 | Progression/trust repair | Fix critical chapter gates, act mapping, farming and inconsistent promises. Add focused regression probes. |
| 2 | Better first session | First guided prediction, progressive HUD, event skip/alarms, resume recap and local telemetry. Observe novice sessions. |
| 3 | Story woven into existing mechanics | Safe scene scheduler, distinct crew roles, one fully playable clue, visible camp artifacts. Test emotional comprehension, not just scene count. |
| 4 | Complete flight vertical slice | Departure → observation → correction → arrival, using actual player-model guidance and saved state. Include atmosphere-specific entry and optional automation. |
| 5 | Small economy prototype | Tanks/valves, multiple finite deposits, continuous powered processing, oxygen co-product, battery/fuel cell and migration. Conservation and solvability gates pass. |
| 6 | Purposeful driving and towing | Terrain/gears/winch where warranted; credible tug/trailer model; unified remote rover and delegated repeat routes. |
| 7 | Global relocation | State-owned observing site/history, suborbital travel and a small set of worthwhile destinations. Full chapter validation after moves. |
| 8 | Creative/replay polish | Photo mode, custom constellations, journal/PDF, capped medals, short challenges, own ghosts and accessibility suite. Some low-scope access fixes should happen earlier. |
| 9 | Optional online service | Weekly comparisons first; classroom/co-op/connection features only after demand and operating model are clear. |

These stages combine the earlier engine/tools/sheet/launch/tutorial milestones and the economy/driving/flight/relocation/polish work into one dependency-aware sequence. They deliberately do not promise old S/M/L estimates or calendar deadlines. Each stage should deliver a playable slice, checks and a reviewable deployment; none authorizes implementation before discussion.

## 18. Decisions to discuss

Use these as a first discussion agenda; every feature ID above remains separately commentable.

| Decision | My current recommendation | Main tradeoff |
|---|---|---|
| DEC-01 — Core identity | Science navigation with optional physical execution | More breadth can dilute the strongest loop. |
| DEC-02 — Chapter 8 endpoint | Navigation fix aims the next fold; remove redundant ordinary flight unless it serves the plot | Changes mission/story structure but makes the chapter distinct. |
| DEC-03 — ECHO's identity/responsibility | Inherited memories plus involuntary beacon interaction, explicitly acknowledged | Sympathy versus a more morally difficult deliberate rescue act. |
| DEC-04 — Crew responsibilities | Ada: pods; Tomas: engineering; June: geology; Vale: mission judgment | More character agency needs clear UI ownership and authored reactions. |
| DEC-05 — Manual flight by difficulty | Optional novice execution, clearly specified expert/ranked contract | Accessibility and science focus versus piloting mastery. |
| DEC-06 — Physical fuel model | Decide abstraction versus mass-consistent simulation before adding kg inventory | Simple balancing versus stronger conservation teaching. |
| DEC-07 — What is towed | Prototype powered/credible habitat trailer, or keep towing abstract and honestly labeled | Separate ship/camp positions introduce meaningful but costly complexity. |
| DEC-08 — Surface depth | Optional expeditions, automatable repeated operations | Engagement for drivers/builders without chores for observers. |
| DEC-09 — Creativity | Prioritize photos, constellations and personal journal | Strong ownership without a backend, but needs usable editing/export. |
| DEC-10 — Online launch scope | Weekly results/distributions before co-op | Lower operating risk and a clearer test of social demand. |
| DEC-11 — Competitive promise | Casual verified-consistency boards first | Public client cannot prove unaided human measurement. |
| DEC-12 — Access and assists | Broad access with transparent comparison categories | Requires careful score labeling, not blanket exclusion of players. |
| DEC-13 — Tiny modifiers | Keep short supplies or replace with one-save only after explicit choice | Both appeared in planning; they are not equivalent. |
| DEC-14 — Scientific mystery | One playable clue per chapter, not three compulsory journal pages | Development depth versus sheer content count. |
| DEC-15 — Production order | Fix trust, first session and story integration before large logistics | Less new spectacle immediately, stronger foundation for every later feature. |

## 19. Evidence index and research

### EVID-01 — Current implementation map

| Area | Primary files |
|---|---|
| Modes/menu/teaching | [modes.ts](../src/game/modes.ts), [Title.tsx](../src/ui/Title.tsx), [tutorial.ts](../src/game/tutorial.ts), [lesson index](../src/ui/tutorial/lessons/index.tsx) |
| Generation and solvability | [system.ts](../src/engine/system.ts), [solver.ts](../src/engine/solver.ts), [validator](../scripts/validate.ts), [validation report](../reports/validation.md) |
| Sky/measurement/inference | [sky.ts](../src/engine/sky.ts), [measure.ts](../src/engine/measure.ts), [chain.ts](../src/engine/chain.ts), [fits.ts](../src/game/fits.ts), [orbitfit.ts](../src/engine/orbitfit.ts) |
| Progression/prediction | [missions.ts](../src/game/missions.ts), [acts.ts](../src/game/acts.ts), [readiness.ts](../src/game/readiness.ts), [predictions.ts](../src/game/predictions.ts) |
| Flight | [planner.ts](../src/engine/planner.ts), [launch.ts](../src/engine/launch.ts), [Flight.tsx](../src/ui/launch/Flight.tsx), [Ascent.tsx](../src/ui/launch/Ascent.tsx), [Prologue.tsx](../src/ui/Prologue.tsx) |
| Surface/economy | [surface.ts](../src/game/surface.ts), [survival.ts](../src/game/survival.ts), [RoverDrive.tsx](../src/ui/tools/RoverDrive.tsx), [SurfaceMap.tsx](../src/ui/tools/SurfaceMap.tsx) |
| Story | [STORY.md](STORY.md), [story.ts](../src/game/story.ts), [StoryScene.tsx](../src/ui/StoryScene.tsx), [ActCard.tsx](../src/ui/ActCard.tsx) |
| Progress/reliability | [store.ts](../src/game/store.ts), [checkpoints.ts](../src/game/checkpoints.ts), [atlas.ts](../src/game/atlas.ts), [challenges.ts](../src/game/challenges.ts), [anomalies.ts](../src/game/anomalies.ts) |
| Audio | [audio.ts](../src/game/audio.ts), [score.ts](../src/game/score.ts), [synth.ts](../src/game/synth.ts), [audio QA](../reports/audio-qa.md), [browser check](../scripts/check_audio.py) |

### EVID-02 — Reproduced findings and verification scope

The chapter-8 probe generates Navigator seed 316, takes PERFECT bot primaries, removes all three `pStar` values, builds a `stars` model, finds a window/transfer and simulates a successful flight. The UI gates on model existence rather than a navigation fix. The chapter-9 probe compares act mission IDs with offered missions and finds `opposition` missing from the inner-target set. These are specific reproducible failures, not estimates of how often players encounter them.

Sharp Eye farming, fixed descent density, hop-clock omission, inconsistent availability and partial challenge enforcement are established by their current code paths. Broader claims—every seeded journey is enjoyable, all anomalies teach correctly, every device is accessible—remain unverified. The review does not use a single passing suite as a substitute for those claims.

### EVID-03 — Research retained as rationale

The following research directions were present in the consolidated material. They are preserved so future decisions retain their rationale; linked studies and quoted benchmarks were **not independently re-audited in this code review**. Prefer primary research and current official hardware/service documentation over game reviews, memory or third-party pricing summaries.

| Rationale | Reference / how to use it |
|---|---|
| Intrinsic integration and attention | [Habgood & Ainsworth](https://shura.shu.ac.uk/3556/), [Cutting & Iacovides replication](https://eprints.whiterose.ac.uk/189921). The earlier ~7× play-time claim is study-specific, not a prediction for Stranded. |
| Learning/retention and scaffolding | [Wouters et al.](https://research-portal.uu.nl/en/publications/a-meta-analysis-of-the-cognitive-and-motivational-effects-of-seri/), [Clark et al. summary](https://www.sri.com/publication/education-learning-pubs/digital-games-design-and-learning-a-systematic-review-and-meta-analysis-brief/), [scaffolding review](https://link.springer.com/article/10.1007/s10648-021-09655-0). Earlier effect sizes around 0.29/0.36/0.33/0.43 depend on study definitions and are not additive. |
| Competence, autonomy, relatedness | [Ryan, Rigby & Przybylski](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf), [Quantic Foundry](https://quanticfoundry.com/). Useful audience questions, not rigid player labels. |
| Productive failure | [Kapur overview](https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-productive-failure-kapor.pdf). Struggle needs eventual explanation and recovery. |
| Predict–observe–explain | [TU Delft pedagogy](https://interactivetextbooks.tudelft.nl/showthephysics/Pedagogy/PoE.html). Retain explanation without compulsory dialogue quizzes. |
| Curiosity and peak/end experience | [curiosity review](https://www.cmu.edu/dietrich/sds/docs/golman/golman_loewenstein_curiosity.pdf), [CHI study](https://dx.doi.org/10.1145/2858036.2858419). Useful for designed reveals and endings, not permission to neglect the middle. |
| Ownership and endowed progress | [IKEA-effect paper](https://dash.harvard.edu/handle/1/12136084), [endowed-progress summary](https://en.wikipedia.org/wiki/Goal_pursuit). Preserve created artifacts; do not fake scientific progress to imitate a loyalty card. |
| Calibration practice | [Credence Game](https://acritch.com/credence). Score honestly and show uncertainty about a player's estimated calibration. |
| Sound/haptics | [audio research](https://eprints.staffs.ac.uk/8527/1/3677084.pdf), [haptics study](https://uwaterloo.ca/haptic-experience-lab/projects/juicy-haptic-design-vibrotactile-embellishments-can-improve). More intensity is not always better during timing or long sessions. |
| Retention comparisons | [GameAnalytics report](https://investgame.net/wp-content/uploads/2025/02/2025-GameAnalytics-Mobile-Gaming-Benchmarks.pdf). Earlier 23% day-one/4% day-seven mobile medians and ~12% puzzle figures have different cohorts; use only with matching definitions. |
| Educational community context | [Eratosthenes experiment overview](https://www.epsnews.eu/2014/09/following-in-eratosthenes-footsteps/), [paired-school project](https://school-education.ec.europa.eu/en/etwinning/projects/eratosthenes-2024/twinspace/pages/general-evaluation). A good reason to prototype class/co-op features, not proof that a server is needed first. |
| Real hardware and chemistry | [NASA hopper study](https://ntrs.nasa.gov/citations/20120004103), [JPL MOXIE](https://www.jpl.nasa.gov/news/nasas-perseverance-mars-rover-extracts-first-oxygen-from-red-planet/), [ISRU analysis](https://arxiv.org/pdf/2404.00800). Check actual conditions, efficiency assumptions and hardware scale before putting numbers in the game. |

### EVID-04 — Inspiration, with boundaries

Outer Wilds suggests knowledge-led progression and a useful evidence map; Heaven's Vault suggests tolerated ambiguity; Hades suggests contextual recurring relationships; Kerbal Space Program and Spaceflight Simulator suggest readable maneuvers and 2D control; Return of the Obra Dinn suggests commitment but its truth-confirmation mechanic should not be copied uncritically. Subnautica/Alien: Isolation inspire coherent instruments and terminals; Mini Metro/Monument Valley inspire visual restraint.

SnowRunner/MudRunner suggest terrain and route choice, Astroneer suggests connected vehicle energy, Space Engineers suggests shared oxygen/hydrogen production, Lunar Lander suggests short precise landings, and The Martian suggests understandable expedition planning. None excuses unrealistic traction, chemistry or mandatory chores. Slay the Spire's ranks need not become twenty extra difficulty gates. Zachtronics-style distributions can reward mastery without raw-accuracy rankings. Death Stranding-style gifts and No Man's Sky-style naming need fairness/moderation rules. EVE's real-data projects support the optional Archive idea. Pokémon GO's predictable events suggest a reliable calendar rather than time pressure. Celeste's assists suggest access with a clear contract. Phone-sensor experiments inspired by phyphox remain a deliberately dropped direction unless reopened.

### EVID-05 — Documentation and discussion maintenance

This report replaces the scattered planning documents as the discussion register; STORY.md is preserved. Previous texts are recoverable from Git history, including historical research links, alternate mechanics, obsolete schedules and unanswered original-source questions. Update a point's decision/status only when discussion or implementation evidence supports it. When work is later approved, attach acceptance criteria and a commit reference to the same point. Do not mark a whole section complete because one UI button exists.
