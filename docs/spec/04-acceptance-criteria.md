# k-football — Acceptance Criteria & Definition of Done

Testable, checkable criteria. Each is phrased so it can be verified by a test, a
play-test checklist, or a demo. "Done" = all **MVP** rows pass; "polished" = MVP +
the relevant ladder layers.

Legend: **[T]** automated test · **[P]** play-test/manual · **[D]** demo/observation.

---

## 1. Pillar acceptance (the things that actually matter)

### P1 — Feel over fidelity
- [P] A shot produces a visible **freeze (hitstop)** at contact before the ball leaves
  — confirmed by frame-stepping a recording.
- [P] Hitstop length **scales with shot power** (tap vs full).
- [P] **Loudness hierarchy holds**: pass < tackle < shot < goal, judged blind by 3
  testers. If pass reads as loud as shot → fail.
- [P] A **post/crossbar hit** feels like a near-goal (ding + freeze + shake) and
  reliably produces an "ohhh".
- [P] The game **feels good with primitive shapes** (cylinders/spheres) — i.e. feel is
  not dependent on art. This is the headline gate before any L5+ work.
- [T] Each action **emits the correct feel event** (`shoot`→shoot event scaled by
  power; clean tackle→`tackleClean`; goal→goal sequence). Test events, not pixels.

### P2 — Compressed tension & release
- [T] No stoppage events exist (no foul/offside/throw-in/corner code paths).
- [P] Average time between "duels" (tackle/interception/shot opportunities) stays low
  on the default pitch — no dead patches of standing around.
- [D] Goal celebration is **≤ ~2.5 s** and **skippable** after the slow-mo peak.
- [P] Player never loses control during a tension spike (auto-switch works; input
  buffered through hitstop/slow-mo).

### P3 — Few buttons, deep outcomes
- [T] **Clean vs mistimed tackle** produce mechanically different outcomes (ball won +
  short recovery vs whiff + long recovery).
- [T] A **first-time clean pass** yields measurably better result (accuracy/feel bonus)
  than a sloppy one.
- [P] A skilled tester consistently out-positions/out-times a novice using only the 4
  core buttons (skill expression exists).
- [D] Only **move/pass/shoot/tackle** required to play a full match.

### P4 — Readability at a glance
- [P] In a frozen frame, a new viewer can identify **my players, their players, ball,
  goal, and whether the ball is in the air** within ~2 seconds.
- [D] **Ball height is read from its shadow** (shadow detaches/shrinks on a lob) —
  works even before realtime shadow maps.
- [D] Controlled player has an unambiguous **selection marker**.
- [P] HUD never occludes the goal mouths or central action.

---

## 2. Functional acceptance (MVP)

### Match & rules
- [T] Match runs two halves of configured length; clock advances; ends switch at half.
- [T] Kickoff places ball at centre; conceding team kicks off after a goal.
- [T] Goal detected **iff** ball fully crosses the line between posts, under bar; not
  detected just wide / just over (edge tests).
- [T] Score increments correctly; higher score wins; equal = draw.
- [T] Match FSM transitions: KICKOFF→PLAYING→GOAL→KICKOFF, →HALF_TIME, →FULL_TIME.
- [T] Ball bounces off boards with configured restitution; only goal mouths are gaps.

### Controls & player
- [P] Move is responsive (8-way), with momentum but snappy; facing follows movement.
- [P] Sprint trade-off exists (faster, wider turns).
- [T] Pass goes to the assisted target and **leads** the runner.
- [T] Shoot sends ball goalward with assist within tolerance; lob/chip possible.
- [T] Tackle: clean win pops ball loose with spin (play continues); whiff → recovery.
- [P] **Auto-switch** to nearest defender off-possession and to receiver on a pass;
  manual switch (Tab) cycles.

### Keeper
- [T] Keeper tracks ball laterally along the line, clamped to goal width (+margin).
- [T] In-reach shot → save (catch/parry); out-of-reach → goal.
- [T] Lob over an off-line keeper can score (skill reward).
- [T] On catch, keeper distributes to a teammate after a beat (no stoppage).

### AI
- [P] Exactly one AI per team chases the ball; others hold shape (no swarm).
- [P] Defending block **slides with the ball**; forwards make **support runs** ahead of
  the carrier.
- [T] AI difficulty knobs are named parameters (reaction, accuracy noise, press, keeper
  reach, speed factor); AI top speed ≤ human by default.
- [P] AI is beatable but not trivial for a new player on the default setting.

### Formations
- [D] 2–3 preset formations selectable pre-match / pause; anchors flip by attack
  direction. (Single fixed AI formation acceptable for MVP.)

### UI
- [T] Scoreboard shows `HOME score — score AWAY`, half timer, half indicator, from the
  meta store.
- [D] Toasts on GOAL / HALF TIME / FULL TIME.
- [P] Start → kickoff in ≤ ~2 s; minimal clicks; pause works.

---

## 3. Technical acceptance (engineering gates)

- [T] **Determinism**: identical seed + scripted inputs ⇒ identical world hash after N
  ticks (enables replay + reliable tests).
- [T] Simulation imports **nothing** from three.js/React (lint rule / import boundary
  test). Sim runs headless in Vitest.
- [P] **No per-frame React re-renders** for moving objects (verified via React
  profiler / no `setState` in the hot path).
- [P] **Fixed-step loop** with interpolation: no judder at 144 Hz; stable at 30 FPS
  (no spiral of death; clamp verified).
- [T] Hitstop pauses the **sim clock** but **not** audio/shake (real-time effects move
  during freeze); slow-mo scales the sim-time *rate* while each tick stays fixed-STEP.
- [T] **Deferred-impulse contact** (tech §6.1): on a shot, feedback fires on the
  contact tick and the ball does **not** displace until hitstop clears (assert ball
  position unchanged during the freeze, then launches) — proves "freeze before the
  ball leaves".
- [T] **Swept collision** (tech §6.2): a ball moving > its diameter per tick still
  detects a post hit / goal-line crossing / board bounce (no tunneling) — test at
  arcade speed with a thin collider.
- [T] **Three-clock discipline**: a determinism/timer test confirms gameplay timers
  (recovery, AI decision, match clock) advance on sim time and freeze under hitstop,
  while shake/flash advance under it (clock tags honored).
- [P] Holds **60 FPS** on a mid laptop with L1–L3; post FX toggleable for low-end.
- [T] No `any` / implicit any; strict TS passes; ESLint clean.
- [T] No per-frame allocations in sim hot path (spot-checked / no GC sawtooth in
  profile).
- [D] `npm audit` clean on dependency changes; no secrets committed; static build
  produced by `npm run build`.

---

## 3b. Accessibility & platform acceptance (ship gate)

- [P] **Reduce-motion** disables/scales shake + camera kick; **reduce-flash** caps the
  goal flash + bloom; both respect `prefers-reduced-motion` and explicit sliders.
- [P] **Shake/flash/volume sliders** and mute work and persist across a session.
- [P] **Colorblind-safe kits**: the two kits are distinguishable under deuteranopia/
  protanopia sim; controlled-player marker uses shape+brightness, not hue alone.
- [T/P] **Audio unlock**: no audio attempts before the first user gesture; SFX work
  after; audio load failure degrades to muted without crashing.
- [P] **Tab blur** auto-pauses + mutes; resume on focus; no `dt` spike or buried goal.
- [P] **Stuck-key safety**: `window.blur` mid-sprint clears held inputs (no runaway).
- [P] **WebGL context loss** shows a paused overlay and recovers on restore.
- [D] **No WebGL2 / unsupported** → graceful screen, not a blank canvas.
- [P] **Resize / DPR**: layout + framing hold on small-laptop and ultrawide; HUD safe
  zones respected; DPR capped for perf.

## 4. Definition of Done (per task & per milestone)

A task is **done** when:
1. Failing test written first, now passing (TDD); relevant unit tests added.
2. Implements the spec'd behavior; tunables in config, not hard-coded inline.
3. Strict TS + lint clean; files within clean-code limits (≤800 lines, ≤50/fn).
4. Sim/presentation seam respected (no three.js/React imports in sim).
5. Reviewed: **Codex pass + independent Claude verification** before merge (per user
   workflow). High-stakes paths get deep-review.
6. PROGRESS.md / FINDINGS.md updated if anything non-obvious surfaced.

A milestone is **done** when all its acceptance rows pass and the build runs.

---

## 5. Out-of-scope confirmations (must remain absent in MVP)
No fouls/offside/throw-ins/corners/free-kicks/penalties; no multiplayer; no multiple
pitches/teams/leagues; no progression/customization; no replays/save; no mobile
controls. (If any appear, scope has crept — reject.)
