# Manual flight and flight deck — MODE-10, 15 November 2026

## Agreed behavior

New Astronomer and Legend expeditions require manual ascent and destination entry/landing. The easier three modes retain optional automation. Opening crash/fold sequences and routine exploration hops retain their existing rules; their detailed policies remain for the flight discussion. The user requested polished controls and visuals and chose **continue as assisted, preserving the expedition** after a required phase needs ECHO rescue.

Ruleset 2 records the two manual phases and any assistance. Existing saves without this version retain their original flight contract; new expeditions use the new contract. Requested handover explains the consequence before committing. Emergency rescue records assistance immediately. A successful hard-mode debrief checks both phase records, including alternate paths that arrive without proof. Assistance cannot be removed by restoring a checkpoint or by subsequently finishing that leg manually.

An assisted journey keeps measurements, story/Campaign continuation and an explicitly unscored Atlas record. It cannot add or overwrite a hard-mode best grade, award achievements or unlock expert challenges. Its debrief and shared text omit points/grades and label the journey assisted. Calibration information remains available because the observations are preserved. Normal fuel costs and the navigation model still govern transfer outcomes; rescue does not guarantee that bad navigation or insufficient fuel succeeds.

## Controls and presentation

Shared keyboard/touch controls replace the duplicated ascent/landing buttons. Inputs from multiple keys and pointers are aggregated independently: steering and thrust work together, and releasing one source does not cancel another still-held source. Pointer cancellation, lost capture, focus loss and visibility changes release inputs safely. Losing window focus pauses flight. Keyboard activation on a focused steering button controls that button rather than accidentally burning the engine.

The deck includes pause/resume, an optional controls panel, steering sensitivity from 0.5× to 1.5×, a reduced-motion preference, large labeled hold buttons, active-input feedback, keyboard labels, text telemetry and a live attitude indicator. Required phases start paused so the player can inspect the controls. Ascent adds a richer sky/atmospheric view, readable climb/east speeds and a legend distinguishing the target orbit, current coast and flown path. Reduced motion removes camera shake and entry sparks without hiding essential instruments. Phone, landscape and desktop layouts were visually inspected; overlapping practice/assistance buttons and cramped telemetry were corrected.

The rescue stopping test now targets a survivable touchdown speed rather than demanding a complete stop. Both gentle and survivable rough manual landings can finish without an unnecessary ECHO takeover. This fixes a problem that would otherwise undermine the new manual-flight contract.

## Practice without replacing an expedition

Flight School now offers Basic Training plus repeatable, unscored ascent and entry/landing drills. Drill handling can match any of the five modes. A drill snapshots the existing expedition and its time, then restores it on exit/completion; steering and motion preferences carry back. The return snapshot survives saving/reloading within a drill. A new run identity resets the flight scene when repeating a drill. Basic Training keeps its existing explicit replacement confirmation. This small chooser does not settle the broader module library, progression or teaching decisions in MODE-11/MODE-12.

## Validation and limits

All **64 tests across 18 files pass**. New tests cover simultaneous input sources and release, sensitivity bounds, hard/easy/sandbox/tutorial/legacy boundaries, irreversible assisted classification, preservation of measurements, both required manual proofs, checkpoint restoration and expert-unlock exclusion. A deterministic ascent controller using the manual steering-rate limit and binary thrust reaches a parking orbit within 1000 m/s of the reference profile for an Earth-like test case. This establishes feasibility for that case, not human success rates across all generated worlds.

`scripts/check_flight_controls.py` passes in Chromium at **390×844, 844×390 and 1440×900**. It exercises actual keyboard, pointer and multi-touch controls; independent releases; pause and focus loss; sensitivity/motion settings; restoration of the original expedition after practice, including a reload; real hard-mode launch buttons; requested handover cancellation; automatic ascent and destination rescue; assisted debrief/Atlas/share classification; preserved story progress; and successful clean and rough manual completion branches in Astronomer/Legend. Generated systems and perfect-reading fixtures isolate flight behavior. Near-transition state fixtures test completion/rescue without claiming to be full human playthroughs. No page errors were observed.

The existing entry-point, Cadet and independent-mode browser checks pass. The independent-mode script now accepts the expected replacement confirmation, avoiding a race with autosaving in its test setup. Production build passes with the existing large-bundle warning.

These changes do not complete the proposed measurement-dependent guidance, variable throttle, optical navigation, manual correction/capture or coupled atmospheric-entry simulation. The interplanetary transfer remains a precomputed presentation, and the entry model remains simplified. Broader device testing, human piloting/pacing tests, exact in-flight physics-state resumption and the remaining FLY decisions still need attention.
