# Horizon observation and travel — SCI-04

Agreed during the SCI-04 discussion; implemented and checked on 17 November 2026 (Asia/Dhaka). Phone-tilt/gyro aiming remains deferred, as requested.

## What the player sees

Every hill destination shows its surveyed height and an estimated amount of expedition time before the player chooses it. The estimate and the charged journey use one shared calculation: walking between camp and the hill at the existing 4 km/h rate, vertical travel at the existing 350 m/h rate, and the existing fifteen-minute allowance. Travel between hill stations excludes the camp walk. The displayed estimate rounds to the nearest minute; the clock charges the underlying seconds.

The current station shows both surveyed ground height and eye height, including the existing 1.7 m eye allowance. During travel, an overlay shows destination, remaining expedition time and progress. Aiming, angle capture and magnification are disabled until arrival. The expedition clock pauses exactly at arrival and retains its prior warp selection. Travel still advances the normal simulation and consumes normal supplies; the preview is not a new resource exemption.

Leaving the tool cancels unfinished travel without refunding elapsed time or leaving its interval/time warp running. An explicit pause made during the journey remains paused. A trip interrupted by an expedition deadline does not claim arrival or unlock the summit tutorial step. Station selection remains local to each tool visit, as before; saved observations retain their station and eye height. A persistent global travel/location model remains part of the exploration discussion.

## Manual aiming and stabilization

- Touch/mouse dragging, labeled raise/lower controls and a focusable keyboard-operated instrument all adjust the same manual pitch. Arrows make one scale step, Shift makes ten, +/− adjusts zoom, Space/B activates bracing and Enter reads the angle.
- Dragging uses CSS-pixel dimensions so it behaves consistently when the device pixel ratio exceeds the renderer's cap of two. Pointer cancellation clears the drag. Pitch has a mechanical ±15° range, independent of the true horizon angle.
- A dark outline improves the reticle's contrast against both sky and ground. The pitch readout explains negative pitch as below level and shows the current scale step in the instructions.
- Bracing has a visible four-second real-time countdown and meter, including while the expedition is paused. It reduces the existing modeled hand sway without eliminating it. A fitted tripod is identified separately. The current instrument and upgrade rules remain: the tripod reduces sway; the vernier provides finer scale divisions.
- A captured observation now freezes whether the player was braced, whether the tripod was fitted, scale step and magnification. These appear with its existing height, station, time, apparent angle and refraction treatment under Conditions & calculation. Later equipment or brace changes do not rewrite the observation. Older records without the optional fields remain usable.

The instrument still requires the player to choose an angle. No horizon snap, true-angle readout, automatic alignment check or gyro input was added. Existing difficulty/formula/warning rules remain. The unchanged refraction model and requested/manual corrections retain their source and uncertainty. The UI and lesson text explain that a higher station, bracing and a tripod improve aiming but do not remove refraction or shared offsets. Lesson wording now matches activating Brace for four seconds rather than implying continuous holding is required.

## Travel helper boundary

The time-spending helper now offers an optional arrival pause and a cancellation function. Hill travel uses both. Its callback is protected against carrying over into a different run, and paused arrivals cannot complete fractionally early. Existing workshop actions retain their normal, non-pausing default; callers that do not need cancellation can ignore the returned function. Canceling an old action does not clear a newer action's clock target.

## Verification

- `npm test`: **129 tests passed in 27 files**. Added tests anchor walking/climbing/setup charges and descent costs, zero-distance/current-station behavior, invalid routes, mechanical pitch and real-time bracing, exact paused arrivals, cancellation without time refunds, arrival cleanup, explicit pause retention, replacement-action/new-run isolation, default workshop timing behavior and fractional-early-arrival rejection.
- `npm run build`: TypeScript and production build passed. The existing bundle-size advisory remains.
- `python scripts/check_hill.py`: Chromium at 390 × 844 (DPR 3) and 1440 × 900. Uses ordinary station, HUD pause, aiming, brace and angle controls after a deterministic fixture bypasses opening story. Checks each preview against the actual charged time, camp versus between-station walking costs, progress and control locks, no overshoot on arrival, cancellation/time retention/pause choices, deadline interruption, keyboard and CSS-pixel dragging above the DPR cap, touch/native-keyboard bracing, real-time countdown while expedition-paused, frozen observation conditions, tripod/vernier behavior, formula-off expert mode and saved metadata after reload. Screenshots: `/tmp/stranded-hill`.
- `python scripts/check_environment.py`: existing windscreen, expert/manual/ECHO/legacy refraction, propagated model uncertainty, seeing, rover frames and flare checks passed at both widths.
- `python scripts/check_school.py`: library, guided exercise, optional campaign entry and practice-restoration checks passed at both widths.
- `git diff --check`: passed.

The browser fixtures supply equipment for the equipment case and an expedition close to its deadline for the interrupted-trip case. They do not automatically align the instrument or demonstrate human measurement accuracy. The tests establish the listed behavior; enjoyment and ease of first-time use still benefit from human playtesting.

Publication is verified through the GitHub Pages deployment workflow. Browser checks target the local application; the public Pages URL is not directly browser-tested in this environment.
