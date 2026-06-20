# k-football — Overview & Vision

> **One line:** A fast, juicy, top-down 5-a-side football game in the browser that
> feels *amazing* to touch — simple to play, disproportionately rewarding to play well.

---

## 1. Vision

k-football is an **arcade** football game, not a simulation. It descends from the
Sensible Soccer / Sociable Soccer lineage — instant to understand, played in short
adrenaline bursts — but rendered in clean low-poly **2.5D** (real 3D geometry viewed
from a near-top-down tilted camera) so we get depth, shadows, lighting and smooth
any-angle movement without hand-drawing sprite sheets.

The whole product is organised around a single thesis:

> **Feel is the product.** Asset fidelity is a dial we turn later. What makes the
> game *great* is how a pass, a shot, a tackle, and a goal each land in the hand and
> the eye. We build that feel on primitive shapes first, prove it's fun, then layer
> visual fidelity on top without ever rewriting the game.

If a player closes their eyes, taps shoot, and *grins* at the thump-freeze-shake-net
of a goal — we have succeeded, regardless of how many polygons are on screen.

---

## 2. Design pillars

These four pillars are the lens for every decision. When a feature conflicts with a
pillar, the pillar wins.

### P1 — Feel over fidelity
Every action hits multiple senses at once (visual + audio + haptic-via-motion). The
single most important mechanic is **hitstop**: freezing the simulation for a few
frames at the moment of impact so a hit has *weight*. Screen shake, particles, and
trails are garnish layered on top. We tune feel on cylinders before we load a single
model. See [`02-feel-spec.md`](02-feel-spec.md).

### P2 — Compressed tension & release
Adrenaline is not a constant 100% — it's a *cycle*. The buildup (a passing move under
pressure) is what makes the shot land. We compress that cycle hard: short halves, a
fast ball, a short pitch with no dead midfield, and **zero stoppages** in the MVP
(no fouls, offside, throw-ins). Every whistle is an adrenaline leak.

### P3 — Few buttons, deep outcomes
Depth comes from **timing and positioning**, not combos. The same button produces a
visibly and mechanically different result when used with clean timing vs. sloppy
timing. The gap between sloppy and clean is where the reward — and the skill
ceiling — lives. A new player has fun in 10 seconds; a good player is still finding
depth an hour in.

### P4 — Readability at a glance
Top-down football lives or dies on instant reads. At any frame the player must
effortlessly see: **my players, their players, the ball, the goal, and ball height.**
Ball height is communicated by its **shadow** (detaches and shrinks as the ball
lofts), not by perspective. High-contrast kits, one unmistakable ball, clean
mowed-stripe pitch.

---

## 3. The fidelity ladder (how we build)

We never "add 3D later" as a rewrite. We climb a ladder of **independent layers**,
each shippable, each leaving the game playable. Layers 2 + 3 + 7 together deliver
~80% of perceived quality, so the curve is steep and early.

| # | Layer | What it adds | Art cost |
|---|-------|--------------|----------|
| 1 | **Shapes that work** | Capsule players, sphere ball, plane pitch, flat colors, tilted camera. The locked MVP feel-loop. | zero |
| 2 | **Lighting + shadows** | One directional "sun" + soft hemisphere fill. Grounds everything; ball shadow = height cue. | zero |
| 3 | **Tone mapping** | ACES filmic + correct color space. Cinematic instead of washed-out. | ~1 line |
| 4 | **PBR + environment** | `MeshStandardMaterial`, `<Environment>`, grass texture w/ mowed stripes. | low |
| 5 | **Real models** | Low-poly rigged players (Synty/Quaternius) via glTF; recolor for kits. | medium |
| 6 | **Animation** | Idle/run/kick/tackle blended by player state (AnimationMixer). | medium |
| 7 | **Post-processing** | Subtle bloom, AO, vignette, color grade. The AAA glaze. | low |
| 8 | **Juice & dressing** | Particles, ball trail, screen shake, goal slow-mo, crowd, stands, floodlights. | low–med |

The architecture (see [`03-technical-architecture.md`](03-technical-architecture.md))
keeps a hard seam between **simulation** (never changes as we climb) and
**presentation** (the thing each layer upgrades).

---

## 4. MVP scope

### In scope (the thing we ship first)
- Game type: fast arcade 2D-feel football (rendered 2.5D)
- View: near-top-down (tilted perspective camera)
- Teams: **5 v 5** (1 keeper + 4 outfield)
- Mode: **single match** (Human vs basic AI)
- Pitch: **one** fixed pitch
- Core actions: **move, pass, shoot, tackle**
- Keeper: basic goalkeeper / goal-zone defender
- UI: scoreboard + match timer
- AI: simple positioning, support runs, defending shape
- Tactics: simple formations only
- The **core feel layer** (P1) for all four actions + goals — non-negotiable even in
  MVP, because it *is* the product. "Core" = the feel *mechanics*: hitstop, screen
  shake, camera kick, the 5 core SFX, basic particles (turf/sparks/confetti), ball
  trail, squash, and the goal sequence (flash/slow-mo/net ripple). It is **not** the
  full L8 *dressing* (dynamic crowd audio, instanced stands, floodlights, near-miss
  emphasis) — that is deferred to M7. MVP must *feel* finished on primitives; it need
  not be fully *dressed*.

### Explicitly out of scope (MVP)
- Fouls, offside, throw-ins, corners, free kicks, penalties (P2: no stoppages)
- Multiple teams / team select / leagues / tournaments / seasons
- Multiplayer (local or online)
- Multiple pitches, weather, day/night
- Player stats, progression, transfers, customization
- Replays, save/load, settings beyond essentials
- Mobile/touch controls (design not to preclude, but don't build)

### Deferred but designed-for (don't preclude)
- Gamepad support (input layer abstracts device)
- Second human player (local) — auto-switch logic already player-agnostic
- Art layers 4–8 of the fidelity ladder
- Difficulty levels (AI is parameterized from day one)

---

## 5. Target experience (the "felt" spec)

A session should read like this:

1. Load → press start → you're in within ~2 seconds, kickoff.
2. Short, frantic passing move; the ball is quick, the pitch is small, contact is
   constant. No lulls.
3. A clean through-pass *leads* your runner; you feel it was intentional.
4. You shoot. Brief wind-up, then **THUMP** — the world freezes for a beat, shakes,
   the ball streaks, the keeper dives.
5. Goal: freeze-frame, flash, ~1s slow-mo, net ripple, crowd swell, confetti — then
   you're *back in it fast* before the dopamine fades.
6. ~4 minutes later it's full time. You immediately want to go again.

Everything in the other spec docs exists to produce exactly that loop.

---

## 6. Non-goals / anti-patterns

- **No realism creep.** If "that's not how real football works" is the only argument
  for a feature, reject it. Arcade.
- **No menus between the player and the action.** Minimise clicks to kickoff.
- **No loud passing.** If a pass feels as big as a shot, nothing reads as special
  (P1 hierarchy: pass < tackle < shot < goal).
- **No long celebrations.** They kill adrenaline (P2).
- **No premature art.** Don't build layer 5 before layers 1–3 feel great (P1).

---

## 7. Open product decisions (defaults chosen — confirm or override)

| # | Decision | Default | Alternatives |
|---|----------|---------|--------------|
| D1 | Art direction | **Stylized-clean** low-poly | Chunky-retro |
| D2 | Shot input | **Tap** w/ brief auto-windup | Hold-to-charge power |
| D3 | In-match input | **Keyboard** (mouse = menus only) | Gamepad-first |
| D4 | Match length | **2-min halves** (4 min total) | 90s / 3-min |
| D5 | Pass aim | **Assisted** (auto-targets best teammate in facing arc) | Manual stick-aimed |
| D6 | Camera projection | **DECIDED: tilted perspective** (~55–60°, modest FOV) for depth/2.5D look | (Codex argued orthographic; user chose perspective) |

These are flagged again where they matter in the other docs. Changing a default is
cheap now, expensive after implementation — so confirm early. All decisions are now
settled; D6 was resolved in favour of **tilted perspective** (matches the "great-looking,
depth, 2.5D" goal). To protect readability/aim (P4) we keep FOV modest and the assist
tolerances generous; an orthographic fallback stays a 1-line config swap.

---

## 8. Document map

| Doc | Contents |
|-----|----------|
| [`01-game-design.md`](01-game-design.md) | Rules, dimensions, controls, switching, formations, keeper, scoring |
| [`02-feel-spec.md`](02-feel-spec.md) | The per-action feedback bible (hitstop/shake/particles/audio/camera) |
| [`03-technical-architecture.md`](03-technical-architecture.md) | Stack, game loop, sim/render seam, physics, AI, file layout |
| [`04-acceptance-criteria.md`](04-acceptance-criteria.md) | Definition of done; testable criteria per pillar |
| [`05-roadmap.md`](05-roadmap.md) | Milestones mapped to the fidelity ladder |
