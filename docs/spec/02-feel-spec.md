# k-football — Feel Spec (the feedback bible)

This is the most important document in the project. **Feel is the product** (P1).
Everything here is implementable as data: a table of "feel events", each composed of
the same handful of channels. Build the system once; author actions as data.

All frame counts assume a **60 Hz simulation** (see tech doc — sim is fixed-step).
"Frames" = sim frames = 1/60 s ≈ 16.7 ms. Values are starting points; they live in
the config module and are meant to be tuned by feel, fast, with hot values.

---

## 1. The core insight

> **Hitstop is the meal. Screen shake is the garnish.**

The weight of a hit comes from **freezing the entire simulation for 2–5 frames** at
the moment of impact, then exploding back into motion. Most people add shake first and
wonder why it still feels mushy — because nothing *stopped*. We implement hitstop
first and prove it on primitives, then layer the rest.

Reference: Jan Willem Nijman, *"The Art of Screenshake"* — the whole philosophy in
25 minutes. Treat it as required reading for anyone touching this layer.

---

## 2. The feedback channels

Every "feel event" is a bundle of values across these channels. The feel system
exposes one function — `fireFeel(event)` — and each action just names an event.

| Channel | What it does | Parameters |
|---------|--------------|------------|
| **Hitstop** | Freezes sim time for N frames (render continues drawing the frozen frame; see §8). | `frames` (int) |
| **Screen shake** | Adds *trauma* to a camera shaker; shake amplitude = trauma², decays per second. Trauma is additive & clamped [0,1]. | `trauma` (0–1), implicit `decay` |
| **Camera kick** | Directional one-shot nudge of the camera (impulse) that springs back. Distinct from random shake. | `dir` (vec), `magnitude`, `return` time |
| **Time scale** | Slows global time for a duration then eases back (goals). Separate from hitstop (which is a hard freeze). | `scale` (0–1), `duration`, `ease` |
| **Flash** | Full-screen or local color flash (fades out). | `color`, `intensity`, `duration` |
| **Particles** | Emits a burst from a point: turf, sparks, confetti, ripples. | `type`, `count`, `spread`, `speed`, `lifetime` |
| **Trail** | Ribbon/streak following an entity for a duration (ball streak). | `target`, `width`, `duration` |
| **Squash/stretch** | Non-uniform scale pulse on a mesh (ball bounce, foot plant). | `axis`, `amount`, `duration` |
| **Audio** | One-shot SFX with pitch/volume variance; optional ducking of ambience. | `clip`, `gain`, `pitchVar` |
| **Haptic** (deferred) | Gamepad rumble; mapped from the same event when a pad is present. | `lo`, `hi`, `duration` |

**Trauma model (shake):** keep a single `trauma` float. Each event *adds* trauma
(clamped to 1). Each frame: `shakeAmount = maxOffset * trauma²`, then
`trauma -= decay * dt` (e.g. decay ≈ 1.2/s). Using trauma² makes small hits subtle
and big hits violent, and additive trauma means rapid events stack without becoming a
constant blur. This is the standard, good-feeling model.

---

## 3. The intensity hierarchy (must be preserved)

Loudness must be **strictly ordered** or nothing reads as special (P1):

```
move/dribble   <   pass   <   tackle   <   shot   <   GOAL
   (whisper)      (tick)     (crunch)    (THUMP)    (explosion)
```

If passing ever feels as big as shooting, dial the pass down. This ordering is a hard
constraint, not a preference.

---

## 4. Per-action feel tables

### 4.1 Move / dribble — *whisper*
The baseline; almost subliminal, but not silent.

| Channel | Value |
|---------|-------|
| Audio | Soft footstep ticks, rate ∝ speed; quiet. Ball "touch" tick each dribble contact. |
| Particles | Tiny grass scuff puff on sharp direction changes / sprint starts (2–4 specks). |
| Squash | Very slight player bob; ball does a tiny squash on each ground contact. |
| Hitstop/Shake | **none.** |

Goal: motion feels *alive* and grounded without ever competing with real actions.

### 4.2 Pass — *light tick* (keep subtle!)
Crisp and intentional, never loud.

| Channel | Value |
|---------|-------|
| Hitstop | **0–1 frames** (1 only on a clean first-time pass; otherwise 0). |
| Shake | none (or trauma ≤ 0.05 on a hard long pass). |
| Camera kick | tiny, ≤ 1 px equivalent — basically a "click", not a shake. |
| Audio | Crisp `thwack` of foot on ball; pitch up slightly for short passes. |
| Ball | Snaps off the foot **instantly** (no slow roll-out) — speed reached in ≤ 2 frames. |
| Particles | none, or a single contact spark. |
| Receiver | Small **foot-plant trap**: a quick squash + scuff puff when the receiver brings it under control — sells intention (P3). |
| Trail | none (reserve trails for shots). |

Clean first-time pass bonus: +1 hitstop frame, slightly brighter `thwack`, faintest
camera click. The *only* place pass gets any extra juice — the reward for timing (P3).

### 4.3 Tackle — *crunch* (and it must FEED play, never stop it)
The scramble continues; a tackle is an action multiplier (P2).

| Channel | Value |
|---------|-------|
| Hitstop | **3–4 frames** (clean win = 4; glancing = 2; whiff = 0). |
| Shake | trauma **0.25–0.35**, scaled by closing speed. |
| Camera kick | short directional kick along the impact vector. |
| Audio | Body/turf `crunch` + ball knock; layered, punchy, low-mid. |
| Particles | **Turf spray** burst (8–14 green specks) from contact point, flung along impact dir. |
| Stagger | **Both** players get a brief stagger/recoil animation + control lock (~6–10 frames), winner shorter than loser. Mistimed tackler = longer recovery (the timing cost, P3). |
| Ball | Pops loose with **visible spin** (set angular velocity on the ball; spin streak), into open space → scramble. |
| Squash | Ball squashes on the knock. |

Whiff (mistimed): no hitstop, a "miss" swoosh, tackler over-commits and enters longer
recovery. The gulf between clean and whiffed tackle is a primary skill expression (P3).

### 4.4 Shoot — *THUMP* (the loudest open-play moment)
Disproportionately big for one button press — that's the point (P1, P3).

| Channel | Value (scales with shot power `p` ∈ [0,1]) |
|---------|---------|
| Anticipation | **2–4 frame wind-up** before contact (plant + leg draw-back). Sells weight even on a tap (D2). |
| Hitstop | **lerp 3 → 7 frames** by `p`. The headline. |
| Shake | trauma **0.3 → 0.6** by `p`. |
| Camera kick | punch toward goal, magnitude ∝ `p`. |
| Audio | Deep `THUMP` / boot strike; lower pitch + more body at high `p`; subtle low-end so it's *felt*. |
| Ball | Streak/`trail` on the ball for ~0.3–0.5 s, length ∝ speed. Ball reaches shot speed in ≤ 2 frames after contact. |
| Particles | Contact burst (turf + a few sparks) at the strike point. |
| Keeper | Reacts visibly (dive/lunge) — the shot *causes* a reaction, reinforcing impact. |
| Squash | Ball squashes hard on contact, recovers in air. |

If a shot ever feels small, add hitstop frames *before* touching anything else.

**Latency budget (important — keeps taps responsive):** feedback fires at *contact*
(audio/shake/flash are instant), and only the ball's *travel* waits for the freeze
(tech doc §6.1). Still, keep a light **tap** snappy:
- Tap shot: **2-frame** windup + **3-frame** hitstop ≈ 83 ms input→ball-travel. OK.
- Full/perfect/heavy shot: up to 4-frame windup + 7-frame hitstop — the big freeze is
  *reserved* for power, posts, saves, and goals, where the player wants the weight.
- Never spend a 7-frame freeze on a soft tap — it reads as input lag, not power.

### 4.5 Save / deflection — keeper's moment
Gives the keeper weight so saves feel earned, not arbitrary.

| Channel | Value |
|---------|-------|
| Anticipation | Keeper dive has a 2-frame coil. |
| Hitstop | **2–3 frames** on contact. |
| Shake | trauma **0.2–0.3**. |
| Audio | Glove `punch` / palm slap; "oof". |
| Particles | Deflection spark + turf as keeper lands. |
| Ball | Parry pops it loose (back into play, P2); catch = ball sticks to gloves + a beat. |
| Camera | Small nudge toward the ball. |

### 4.6 Ball events (ambient, always-on physicality)
| Event | Feel |
|-------|------|
| Bounce off board/wall | Short `thud`, small squash, tiny trauma (≤0.05) on hard hits, dust puff. |
| Post/crossbar hit | **The tease.** Hitstop 3–4 frames, sharp metallic `DING`, trauma 0.3, camera flinch. A near-miss should feel almost as loud as a goal — it drives "ohhh!". |
| Ball ground bounce | Squash + soft `pat`, dust speck. Shadow snaps small→large (height read, P4). |

The **post hit** is one of the highest-value feel events in the whole game — author it
with care; it manufactures drama for free.

---

## 5. The Goal sequence — *explosion* (blow the budget here)
The payoff. This is the one place we spend lavishly — then return to action **fast**,
because long celebrations kill adrenaline (P2).

Timeline (≈ 2.5 s total), authored as a scripted sequence:

| t (ms) | Beat |
|--------|------|
| 0 | **Ball crosses line.** Hard **hitstop ~6 frames** on the moment of the goal. |
| ~100 | **Screen flash** (team color, bright, fast fade). Trauma spike **0.7**. |
| ~100 | **Net ripple** (cloth/jiggle on the net mesh). Ball trapped in net. |
| ~150 | **Slow-mo**: time scale → **0.25**, held ~700 ms, then ease back to 1.0 over ~300 ms. |
| ~150 | **Crowd roar** swells (audio); commentary "GOAL!" toast on HUD. |
| ~200 | **Confetti / particle burst** in scorer's colors from behind the goal. |
| ~200 | Camera optional slow push-in toward the goal during slow-mo. |
| ~1500 | Slow-mo fully released; "GOAL!" toast lingers. |
| ~2500 | Cut to **KICKOFF** (skippable from t≈800 ms with shoot button). |

Constraints:
- The sequence must be **skippable** (shoot/pass) after the slow-mo peak, so eager
  players aren't held hostage (P2).
- No player-name/replay flourishes in MVP — keep it punchy.
- Restart kickoff is *fast*; the dopamine→action gap stays short.

---

## 6. Pacing as a feel system (not just juice)

Adrenaline = tension→release cycles (P2). The feel layer supports pacing, but pacing
is mostly **design + AI**:

- **Fast ball, short pitch, no dead midfield** → constant proximity to a duel.
- **No stoppages** → no adrenaline leaks (P2). The only pause is the goal celebration,
  which is itself a release beat.
- **Auto-switch** → the player never wrestles controls during a tension spike.
- **Dynamic audio** (deferred polish): ambience/crowd intensity rises as the ball
  nears either goal — cheap tension amplifier.
- **Optional "near miss" emphasis**: a fraction more hitstop when a shot just misses
  or a tackle just fails — leans into the "so close" feeling.

---

## 7. Authoring model (how this becomes data)

Define feel events centrally so designers tune in one place:

```ts
// config/feel.ts  (illustrative)
export const FEEL = {
  pass:        { hitstop: 0, traumaMax: 0.05, sfx: 'pass',   ... },
  passCleanFT: { hitstop: 1, traumaMax: 0.06, sfx: 'passHi', ... },
  tackleClean: { hitstop: 4, trauma: 0.30, sfx: 'tackle', turf: 12, ... },
  tackleWhiff: { hitstop: 0, trauma: 0.00, sfx: 'whiff', ... },
  shoot:       { hitstopMin: 3, hitstopMax: 7, traumaMin: 0.30, traumaMax: 0.60, ... },
  post:        { hitstop: 4, trauma: 0.30, sfx: 'post', cameraFlinch: true },
  save:        { hitstop: 3, trauma: 0.25, sfx: 'save', ... },
  goal:        { /* references the scripted GoalSequence */ },
} as const;
```

Game code calls `fireFeel(FEEL.shoot, { power })`; the feel system fans the event out
to hitstop / shake / camera / particles / audio subscribers. **Sim logic never knows
about cameras or particles** — it emits semantic events; the feel layer renders them.
This keeps the sim/presentation seam clean (tech doc §Architecture) so the fidelity
ladder can climb without touching gameplay.

**Event schema (each `FeelEvent` carries these — not just raw numbers):**
- `clock`: which timeline each channel uses — hitstop & gameplay squash on **sim
  time**; shake/flash/camera/audio on **real time** (tech doc §3.1). Tag per channel.
- `units`: hitstop/windup in **sim frames** (÷60 → seconds); trauma 0–1; durations in
  ms (real time); particle counts as ints. State the unit at the field.
- `priority`: when two events fire together, the higher priority wins the *exclusive*
  channels (slow-mo, flash) — a goal must not be diluted by a simultaneous tackle.
- `cooldown` / **stacking rule** per channel: trauma is **additive & clamped** (rapid
  hits stack, then decay); hitstop is **clamped to a per-window max** (§8 item 5) so
  tackle-into-shot can't freeze for an ugly long time; slow-mo is **exclusive**
  (latest high-priority wins, no stacking); audio respects a tiny per-clip cooldown to
  avoid machine-gun retriggers.
- `timestamp`: the sim tick the event was emitted (for ordering + replay).
- `scalars`: every channel multiplies by the user accessibility scalars
  (`shakeScale`, `flashScale`, reduce-motion) at render time (tech doc §19).

---

## 8. Critical implementation notes for hitstop (read before coding)

Hitstop is subtle to get right; these caveats save a day of debugging:

1. **Hitstop pauses the *simulation clock*, not the render loop.** During hitstop,
   the fixed-step accumulator does not advance game time for N frames; rendering
   continues so the frozen moment is drawn (and shake/flash can still animate on a
   *separate* unscaled timeline). Decide per-effect whether it runs on sim-time or
   real-time.
2. **Shake/flash should run on real (unscaled) time** so they still move during
   hitstop and slow-mo — otherwise the freeze looks dead. Hitstop freezes the *world*;
   the *camera* can still jolt.
3. **Time scale (slow-mo) vs hitstop are different mechanisms.** Slow-mo multiplies
   dt; hitstop zeroes sim advancement for a frame count. The goal sequence uses both.
4. **Input is buffered during hitstop/slow-mo** so the player never loses a press to a
   freeze (tech doc §Input).
5. **Cap stacked hitstop.** Rapid events (tackle into shot) must not freeze for a
   visibly long time — clamp total hitstop per window.
6. **Audio does not hitstop** (a frozen sound is a glitch); fire SFX on the real
   timeline at the event instant.
7. **Feedback at contact; ball travel after the freeze.** The strike's audio/shake/
   flash/particles fire on the *contact* tick (instant feedback); the ball carries a
   **pending impulse** and stays put during hitstop, then launches when it clears
   (tech doc §6.1). This is what makes the freeze read as *power*, not lag — and it's
   why the naïve "set velocity then integrate same tick" is wrong (the world would
   freeze one tick *after* the ball already left).
8. **Accessibility is wired in here, not bolted on.** Every channel multiplies by user
   scalars (`shakeScale`, `flashScale`) and honors reduce-motion / reduce-flash before
   it renders (tech doc §19). The slow-mo and flash of the goal sequence must have a
   photosensitive-safe mode.

---

## 9. Build order for the feel layer (maps to the ladder)
1. Hitstop system + one event (shot) on primitives. Feel it. *(ladder L1)*
2. Trauma shake + camera kick. *(L1/L8)*
3. Audio bus + the 5 core SFX (pass/tackle/shot/post/goal). *(L8)*
4. Particle bursts (turf, sparks, confetti). *(L8)*
5. Ball trail + squash/stretch + shadow height cue. *(L2/L8)*
6. Goal sequence (flash + slow-mo + net ripple + confetti). *(L8)*
7. Dynamic audio / near-miss emphasis (polish). *(L8)*

Each step is independently shippable and independently tunable. By step 6 the game
*feels* finished even as flat cylinders — which is exactly the point (P1).
