# k-football — Technical Architecture

How the game is built so that (a) the **feel** is deterministic and tight, and (b) the
**fidelity ladder** can climb without rewriting gameplay. The non-negotiable
structural idea is a hard seam between **simulation** and **presentation**.

---

## 1. Stack

| Concern | Choice | Why |
|---------|--------|-----|
| Language | **TypeScript** (strict) | type safety; no `any` (user rule) |
| Build/dev | **Vite 7** | fast HMR, simple |
| UI / scene graph | **React 19 + React Three Fiber** | fits web/React muscle; declarative scene |
| 3D | **three.js** (via R3F) | the renderer |
| R3F helpers | **@react-three/drei** | shadows, `<Environment>`, glTF, camera helpers — fidelity-ladder one-liners |
| Post FX | **@react-three/postprocessing** | bloom/AO/vignette (ladder L7) |
| Meta state | **Zustand** | tiny store for score/time/match-phase; sim stays out of React |
| Physics | **Custom arcade kinematics** (see §6) | full control of feel; deterministic; Rapier deferred |
| Audio | **Howler.js** *or* raw WebAudio bus | one-shot SFX w/ pitch variance, ducking |
| Tweening | **small custom** (lerp/spring/easing utils) | feel needs hand-tuned curves, not a lib |
| Tests | **Vitest** (unit/sim) + **Playwright** (E2E/smoke) | deterministic sim is unit-testable |
| Lint/format | ESLint + Prettier | clean-code rules |

Rationale for **not** starting with Rapier: an arcade ball on a flat pitch is a point
with `(x, z, y, vx, vz, vy)` + gravity + restitution; players are circles resolved by
separation; goals/walls are AABB/line tests. A full 3D physics engine adds WASM, a
variable-quality determinism story, and tuning friction that *fights* arcade feel. We
get tighter, more predictable feel from ~200 lines of custom kinematics. **This is a
flagged decision** — see [`04-acceptance-criteria.md`](04-acceptance-criteria.md) and
the Codex review gate; revisit if collision complexity grows.

---

## 2. The core principle: sim / presentation seam

```
            ┌─────────────────────────────────────────────┐
            │                 SIMULATION                    │  pure, deterministic,
            │  fixed 60 Hz · no three.js · no React render  │  framework-free TS
            │  entities + systems → world state + events    │
            └───────────────┬───────────────────────────────┘
                            │ reads state (refs), consumes events
            ┌───────────────▼───────────────────────────────┐
            │                PRESENTATION                     │  R3F/three + DOM
            │  meshes follow sim state imperatively;          │  everything the
            │  feel system renders semantic events;           │  fidelity ladder
            │  UI overlay reads throttled meta store          │  upgrades lives here
            └─────────────────────────────────────────────────┘
```

Rules of the seam:
- **Simulation imports nothing from three.js or React.** It's plain TS operating on
  typed state. This makes it unit-testable and deterministic, and means it *never
  changes* as we climb the ladder.
- **Presentation reads sim state by reference each render frame** and pushes it onto
  meshes imperatively (mutate `mesh.position` in `useFrame`), interpolating between the
  last two sim steps for smoothness. **No per-frame React re-renders** for moving
  objects (that path is too slow and causes GC churn).
- **Communication sim→presentation** is (1) shared mutable world state read by ref, and
  (2) a **semantic event queue** ("goal", "tackleClean", "post") the feel system
  drains. Sim emits *meaning*, never *effects*.
- **UI (scoreboard/timer)** subscribes to a small Zustand store that the sim updates at
  a throttled cadence (e.g. on change / a few Hz), not every frame.

This seam is what makes "ship cylinders, then add models/lighting/post" a layering
exercise instead of a rewrite (P1, overview §3).

---

## 3. Game loop & time

A **fixed-timestep accumulator** decoupled from render. This is mandatory for
deterministic feel (hitstop, reproducible physics, testable sim).

```ts
const STEP = 1 / 60;            // sim tick = 16.667 ms
let acc = 0, last = performance.now();

function frame(now: number) {
  let dt = (now - last) / 1000; last = now;
  dt = Math.min(dt, 0.25);      // clamp to avoid spiral-of-death after a stall
  acc += dt;

  while (acc >= STEP) {
    const scaledStep = STEP * time.scale;   // slow-mo multiplies
    if (time.hitstopFrames > 0) {           // hitstop: don't advance sim
      time.hitstopFrames--;
    } else {
      simulate(scaledStep);                 // one deterministic tick
    }
    feelRealTime(STEP);                      // shake/flash on UNSCALED real time
    acc -= STEP;
  }

  const alpha = acc / STEP;                  // interpolation factor
  present(alpha);                            // R3F renders; meshes lerp prev→cur
  requestAnimationFrame(frame);
}
```

Key points (cross-ref feel doc §8):
- **Hitstop** zeroes sim advancement for N ticks; render keeps drawing the frozen
  world. Camera shake/flash run on the **unscaled** timeline so the freeze still jolts.
- **Slow-mo** scales the sim step (goal sequence). Distinct from hitstop.
- **Interpolation** (`alpha`) between previous and current sim state removes judder
  since render (rAF, variable/144 Hz) ≠ sim (fixed 60 Hz). Store `prev` + `cur`
  transforms per entity.
- **Spiral-of-death guard**: clamp `dt`; cap max sim steps per frame.
- R3F note: we drive this from a single `useFrame` (or a manual loop with
  `frameloop="never"` + `gl.render`) — one authoritative loop, not scattered
  `useFrame`s mutating shared state in undefined order.

---

## 4. Entity / system model (ECS-lite)

Full ECS is overkill for ~11 entities; a **lightweight component-struct** model is the
sweet spot: data-oriented, testable, cheap.

**World state** (plain objects / typed arrays, pre-allocated, no per-frame `new`):
```ts
interface World {
  tick: number;
  ball: Ball;                  // pos {x,y,z}, vel, spin, owner|null, prevPos
  players: Player[];           // length 10 (5+5), index = stable id
  match: MatchState;           // phase, scores, clock, half, kickoffTeam
  events: FeelEvent[];         // drained by presentation each frame
  rng: Rng;                    // seeded PRNG (determinism)
}
interface Player {
  id; team; role; formationSlot;
  pos; vel; facing; prevPos; prevFacing;
  state: PlayerFSM;            // Idle/Chase/Support/Press/Defend/OnBall/Recover...
  control: 'human' | 'ai';
  recoverFrames; // control-lock after tackle/stagger
  // AI scratch: targetPos, decisionTimer, etc.
}
```

**Systems** run in a fixed order each tick (order matters):
1. `InputSystem` — sample buffered input → intents for the controlled player.
2. `AISystem` — per AI player: decision (throttled) + steering → intents.
3. `MovementSystem` — integrate player kinematics from intents (accel/turn/sprint).
4. `ActionSystem` — resolve pass/shoot/tackle intents into ball/世界 changes + emit
   feel events.
5. `BallSystem` — integrate ball (gravity, drag, spin/Magnus-lite), possession/dribble
   attachment.
6. `CollisionSystem` — player-player separation, player-ball pickup, ball-wall,
   ball-goal, keeper saves.
7. `KeeperSystem` — keeper positioning/dive (specialized AI).
8. `MatchSystem` — clock, goals detection, phase transitions, kickoff resets.
9. `FeelEmitSystem` — finalize/queue events (some emitted inline by §4 above).

Each system is a pure-ish function `(world, dt) => void` mutating world in place.
Determinism: no `Math.random` (use `world.rng`), no `Date.now`, no wall-clock.

---

## 5. Input system

- **Poll, don't React-event.** Maintain a key/button state map updated by DOM
  listeners; the `InputSystem` *samples* it each sim tick. Avoids React render lag and
  missed inputs.
- **Buffering**: pressing shoot is recorded with a short buffer window (~6 frames) so a
  press landing during hitstop/slow-mo or a few frames early still fires (feel doc §8).
- **Device abstraction**: bindings map physical keys → semantic **intents**
  (`move`, `pass`, `shoot`, `tackle`, `switch`). A gamepad layer later fills the same
  intent struct — gameplay code never sees a keycode.
- **Edge vs held**: distinguish `pressed` (this tick), `held`, `released`. Tackle uses
  held (sprint) + pressed (tackle); shoot uses pressed (+ optional hold for D2 charge).

---

## 6. Physics (custom arcade kinematics)

Deterministic, fixed-step, hand-tuned. All on the XZ plane + Y height.

**Ball:**
- Integrate: `vel += gravity*dt` (Y only), `pos += vel*dt`.
- Ground: when `y ≤ r`, clamp, reflect Y vel * restitution (bounce), apply rolling
  drag to XZ when grounded; stop micro-bounces below a threshold.
- Air drag: light quadratic/linear drag so long shots decay naturally.
- **Spin → curve** (Magnus-lite): apply a lateral accel ∝ spin × velocity for banana
  shots/passes. Cheap, high feel payoff. Optional in MVP, designed-for.
- **Possession**: when a player is "on the ball", the ball is soft-attached just ahead
  of their facing (dribble), re-touched each tick (touch ticks = feel). Releasing
  (pass/shoot/tackle) detaches with imparted velocity.

**Players:**
- Kinematic: steer toward `intent.moveDir` with capped accel + max speed; turn rate
  limited (momentum); sprint raises max speed, lowers turn rate.
- **Player-player**: circle-circle overlap → positional separation (push apart),
  optional small velocity response. No tunneling at these speeds/step.

**Walls/goals:**
- Pitch boards: 4 line/AABB segments; reflect ball XZ vel * restitution; emit `bounce`.
- Goal mouth: gap in the wall; a **goal trigger volume** behind the line detects a
  scored goal (ball center fully past line, within posts, under bar).
- Posts/bar: thin colliders → reflect + emit the high-value `post` feel event.

**Keeper save:** in `KeeperSystem`/`CollisionSystem`, test shot trajectory vs keeper
reach; within reach + after reaction delay → catch/parry (feel doc §4.5).

Determinism contract: identical inputs + seed ⇒ identical world every tick. Enables
record/replay and unit tests asserting exact outcomes.

---

## 7. AI architecture

Goal: "simple positioning, support runs, defending shape" — emergent from cheap rules,
not scripted plays. Parameterized for difficulty from day one (game-design §8).

**Layers:**
1. **Roles & formation** (game-design §5): each AI player has a `role` (DEF/MID/FWD)
   and a normalized **home anchor**. Anchors flip with attacking direction and shift
   with the ball ("the block slides").
2. **Team mode**: ATTACK / DEFEND / TRANSITION, derived from possession + ball
   location. Sets role-weight multipliers (forwards push in attack; everyone drops in
   defend).
3. **Per-player FSM**: `Idle → Support / MakeRun / Press / MarkSpace / ChaseBall /
   OnBall(Dribble/Pass/Shoot) → Recover`. Exactly **one** AI per team is the
   designated ball-chaser/on-ball (avoids the "everyone swarms the ball" bug); others
   take support/shape states.
4. **Steering** (Reynolds-style): `seek/arrive` to target pos, `separation` from
   teammates, light `avoid` of opponents. Output = a desired move vector = the same
   `intent` the human produces, so `MovementSystem` is shared.
5. **Decision tick throttling**: heavy decisions (who to pass to, shoot vs dribble)
   run at ~**8–12 Hz**, not 60 Hz — cheaper and produces human-like reaction latency.
   Steering runs every tick for smooth motion.

**On-ball AI decision** (when the AI carrier has the ball): score options —
shoot (if in range + lane to goal), through-ball (if a runner is open), safe pass
(retain), or dribble (advance) — pick highest score + noise. Accuracy noise &
reaction delay are difficulty knobs.

**Off-ball "support runs"**: forwards seek space ahead of the carrier (lead lanes);
this *creates* the through-ball opportunities that make passing feel intentional (P3).

**Defending shape**: out of possession, players arrive at `anchor + ballPull`,
maintaining spacing via separation → a recognizable block that slides with the ball.

**Difficulty parameters** (named constants): reaction delay, decision rate, pass/shot
accuracy noise, press aggression/trigger distance, line height, keeper reach/reaction,
AI max speed factor (≤ human). MVP ships one tuned set.

---

## 8. State management

- **Simulation state**: the `World` object — *not* in React. Owned by the loop module;
  read by reference in presentation. This is the bulk of state and must never trigger
  React renders.
- **Meta/UI state**: a **Zustand** store holds only what the DOM HUD/menus need —
  `score`, `clock`, `half`, `phase`, `result`. Sim writes to it on change (throttled).
  HUD components subscribe with selectors → minimal re-renders.
- **No game state in component state / context for moving objects.** R3F objects read
  the world via refs in `useFrame`.

---

## 9. Rendering & the fidelity ladder seam

Presentation is structured so each ladder layer is a localized change:

- **Camera** (L1): perspective camera, tilted ~**55–60°** from top-down, slight FOV;
  positioned to frame the whole short pitch. Optional gentle follow/zoom later. (We use
  perspective, not pure ortho, for a touch of depth; ortho is a config swap.)
- **Pitch** (L1→L4): a plane; flat color → grass texture w/ mowed stripes (anisotropic,
  repeated). Boards/goals as simple geometry.
- **Players** (L1→L5): `<Capsule>` primitives keyed by entity id; later swapped for one
  **glTF** low-poly model instance per player, recolored per kit. Selection ring +
  drop-shadow decal under the controlled player (P4).
- **Ball** (L1): sphere + a **shadow blob** decal whose size/offset encodes height
  (the key readability cue, P4) — works even before real shadow maps.
- **Lighting/shadows** (L2): one directional "sun" w/ shadow map + hemisphere fill.
  Biggest perceived-quality jump.
- **Tone mapping** (L3): `ACESFilmicToneMapping` + correct color space — one-time
  renderer config.
- **Environment/PBR** (L4): `MeshStandardMaterial` + drei `<Environment>`.
- **Animation** (L6): `AnimationMixer`, clips blended by `Player.state` (idle/run/kick/
  tackle). State already exists in sim → presentation just maps it.
- **Post** (L7): `<EffectComposer>` bloom + AO + vignette + grade.
- **Juice** (L8): particles, trails, confetti, slow-mo, crowd/stands.

Because presentation reads sim state and the FSM by reference, **every layer above is
additive** — no gameplay edits.

---

## 10. Feel system architecture

- A **FeelBus**: sim emits `FeelEvent`s into `world.events`; presentation drains them
  each frame and dispatches to channel renderers (feel doc §2/§7).
- **Channel renderers** (subscribers): `HitstopController` (writes `time.hitstopFrames`
  — actually consumed by the loop), `ShakeController` (trauma + camera offset on real
  time), `CameraKick`, `TimeScaleController` (slow-mo), `FlashOverlay`, `Particle
  Spawner`, `TrailController`, `AudioBus`, `SquashController`.
- **Config-driven**: events reference values in `config/feel.ts` (feel doc §7).
- Hitstop is special: it's a sim-time concern, so the *flag* lives in `time` and the
  loop honors it; the *trigger* comes through the bus. Document this coupling clearly.

---

## 11. Configuration (single source of tunables)

All numbers a designer touches live under `src/game/config/`:
- `dimensions.ts` — pitch, goal, radii (game-design §2)
- `pace.ts` — speeds, accel, match length, ball drag/gravity
- `feel.ts` — every feel event's channel values (feel doc §7)
- `ai.ts` — difficulty knobs, role weights, formation anchors
- `controls.ts` — key bindings → intents

Goal: tune the game by editing config, with HMR, without touching systems. Consider a
dev-only on-screen tweak panel (e.g. `leva`) bound to these — high ROI for feel tuning
(deferred but cheap).

---

## 12. Proposed file layout

```
src/
  game/
    core/
      loop.ts            # fixed-step accumulator, hitstop/slow-mo, interpolation
      time.ts            # time scale, hitstop frame counter
      rng.ts             # seeded PRNG (determinism)
      events.ts          # FeelEvent types + queue
    sim/
      world.ts           # World/Player/Ball/MatchState types + factory/reset
      systems/
        input.ts movement.ts action.ts ball.ts collision.ts
        keeper.ts match.ts
      index.ts           # simulate(dt): runs systems in order
    ai/
      formations.ts roles.ts steering.ts decision.ts teamMode.ts
    feel/
      bus.ts hitstop.ts shake.ts cameraKick.ts timeScale.ts
      flash.ts particles.ts trail.ts squash.ts audio.ts
      goalSequence.ts
    input/
      manager.ts bindings.ts buffer.ts
    config/
      dimensions.ts pace.ts feel.ts ai.ts controls.ts
  render/
    Scene.tsx Camera.tsx Lighting.tsx Pitch.tsx Goals.tsx
    Players.tsx Ball.tsx Shadows.tsx Effects.tsx   # Effects = post (L7)
    bridge.ts            # reads World by ref → drives meshes (interp by alpha)
  ui/
    Scoreboard.tsx Timer.tsx Toast.tsx Menu.tsx PauseMenu.tsx
  state/
    metaStore.ts         # zustand: score/clock/phase/result
  assets/                # models, textures, audio (added at ladder L4+)
  App.tsx main.tsx
```
Honors the clean-code limits (≤800 lines/file, one concept/file, layered concerns).

---

## 13. Testing strategy (TDD by default)

Determinism makes the sim genuinely unit-testable — lean into it (user TDD rule).

- **Unit / sim (Vitest)** — the bulk:
  - Movement integration (accel caps, turn limits).
  - Ball physics (bounce restitution, drag stop threshold, gravity arc).
  - Collision (player separation, wall reflection, goal detection true/false at edges,
    post hit).
  - Actions (pass leads target; clean vs whiffed tackle outcomes + recovery frames;
    shot power → velocity).
  - Keeper (in-reach save vs out-of-reach goal; lob over off-line keeper).
  - Match FSM (kickoff→goal→kickoff; half/full-time transitions; clock).
  - **Determinism test**: same seed + scripted inputs ⇒ identical world hash after N
    ticks.
  - **Feel emission test**: a clean tackle enqueues `tackleClean`; a goal enqueues the
    goal sequence (assert events, not pixels).
- **Component (Vitest + RTL)**: HUD renders score/clock from store; toasts on events.
- **E2E / smoke (Playwright)**: app boots, canvas mounts, can start a match, score a
  scripted goal via a test hook (expose a deterministic "force goal" in dev), HUD
  updates, no console errors. WebGL in CI: run headed/`--use-gl=swiftshader` or gate
  E2E to a smoke subset.

TDD cadence per feature: write the failing sim test → minimal system code → refactor.
Feel/visuals are validated by play-test + the *emission* tests above (we test that the
event fires, not how it looks).

---

## 14. Performance budget

- Target **60 FPS** on a mid laptop; sim is trivial (11 entities). Cost is rendering.
- No per-frame allocations in sim or the render bridge (pre-allocate vectors; mutate).
- Shadows: single shadow-casting light, tight shadow camera frustum around the pitch.
- Particles: pooled; cap concurrent counts.
- Post FX (L7): keep bloom/AO at moderate quality; it's the main GPU cost — make it
  toggleable (also a low-end fallback).
- One authoritative `requestAnimationFrame` loop; avoid layout thrash from the DOM HUD
  (transform/opacity only, no per-frame reflow).

---

## 15. Build, deploy, tooling

- `npm run dev` (Vite), `npm run build` (static bundle), `npm run preview`.
- Output is a **static SPA** → deployable to any static host / the user's web habit
  (Cloudflare Pages/Netlify/etc.). No backend in MVP.
- CI: typecheck + lint + Vitest on PR; Playwright smoke on PR (gated for WebGL).
- `npm audit` on dependency changes (user security rule); no secrets in repo.

---

## 16. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Custom physics gets gnarly as collisions grow | Keep it minimal; the seam lets us swap in Rapier behind the same `BallSystem`/`CollisionSystem` API if needed. Flagged for Codex review. |
| Hitstop/slow-mo bugs (audio freeze, input loss) | Feel doc §8 caveats; real-time vs sim-time split; input buffering; dedicated tests. |
| "Everyone swarms the ball" AI | Single designated chaser + role anchors + separation steering. |
| Per-frame React renders tank FPS | Sim out of React; imperative mesh updates; throttled meta store. |
| WebGL in CI flaky | Gate E2E to smoke; software GL; unit-test the deterministic sim instead. |
| Fidelity creep before feel is fun | Pillar P1 + roadmap gates: don't start L5 until L1–3 feel great. |
| Asset licensing (Synty paid / CC0 mixups) | Track licenses; prefer CC0 (Quaternius/Kenney) for the open build; document per asset. |

---

## 17. Decisions for the Codex review gate
1. **Custom kinematics vs Rapier** for MVP (§1, §6). *Recommended: custom; revisit.*
2. **Perspective vs orthographic** camera for the 2.5D look (§9). *Recommended:
   perspective, tilted ~55–60°.*
3. **Bouncing boards vs ball-return** when ball would leave play (game-design §1.3).
   *Recommended: bouncing boards.*
4. **Howler vs raw WebAudio** for the audio bus (§1).
5. **ECS-lite struct model vs a library** (bitecs/miniplex) (§4). *Recommended:
   hand-rolled for 11 entities.*
