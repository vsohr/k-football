# k-football — Roadmap & Milestones

Sequenced so the **feel-loop on primitives** comes first and is provably fun before any
art, then the fidelity ladder climbs in independent, shippable layers. Each milestone
ends with a **review gate** (Codex review + independent Claude verification; deep-review
for high-stakes paths) per the workflow.

The golden rule: **do not start a fidelity layer (M4+) until the feel gate (end of
M3b) passes.** Art cannot rescue bad feel; good feel needs no art (P1).

---

## M0 — Project scaffold *(ladder: pre-L1)*
**Goal:** an empty, well-structured app that boots and renders a tilted-camera plane.
- Vite + React + TS (strict) + R3F + drei; ESLint/Prettier; Vitest + Playwright.
- Folder layout from tech doc §12; config modules stubbed.
- The fixed-step **game loop skeleton** (accumulator, time scale, hitstop counter,
  interpolation) with a no-op `simulate`.
- Tilted perspective camera framing a green plane; one cube moving via the loop to
  prove sim→present interpolation.
- CI: typecheck + lint + test on PR.
**Exit:** app boots to a lit-ish plane; loop drives a moving primitive smoothly at
144/60/30 Hz; tests run in CI. **Review gate.**

---

## M1 — The feel-loop on primitives *(L1 + first slice of L8)* — *the heart*
**Goal:** prove the game is fun as cylinders and a sphere. This is the make-or-break
milestone.
- Player capsule (human-controlled), ball sphere, pitch plane, boards, goals — all
  primitives.
- Movement system (accel/turn/sprint/momentum); input manager + buffering.
- Ball physics (gravity, bounce, drag, dribble attach) — custom kinematics.
- **Shoot** + the **feel system core**: hitstop (deferred-impulse contact model,
  tech §6.1), trauma shake, camera kick, basic audio (shot SFX, with the
  autoplay-unlock flow), ball trail, squash. Tune until a shot *thumps*.
- Ball shadow blob as height cue (P4).
- **Feel dev tooling — built now, not deferred** (this is how we tune feel fast): a
  hot-tweak panel (e.g. `leva`) bound to `config/feel.ts`, frame-step + pause, input
  record/replay, and an on-screen feel-event timeline overlay. Tuning feel without
  these is guesswork.
- Accessibility scalars wired from day one (shake/flash scalars, reduce-motion).
**Exit (FEEL GATE part 1):** a human can dribble and shoot, and the shot **feels
great** with zero art. 3 testers confirm the thump. **Review gate.**

---

## M2 — Full action set + match rules, with *dummy* players *(L1)*
**Goal:** all four actions + the full match structure, exercised against **bodies that
have no brain yet** — so we ship the rules without blocking on AI.
- Full **5v5 roster present**, but teammates/opponents are **static/dummy**: they hold
  their formation anchors (and at most a trivial "walk toward ball" stub). Enough to
  *receive a pass*, *be tackled*, and *get in the way* — not real opponents.
- **Pass** (assisted target w/ visible indicator + hysteresis, leads runner,
  first-time bonus, pressure error) + receiver trap.
- **Tackle** (clean/whiff outcomes, ball pops loose w/ spin, both stagger, recovery
  frames).
- **Auto-switch** (min dwell time) + manual switch.
- Collision: player-player separation, **swept** ball-vs-wall/post/goal-line (tech
  §6.2), **goal detection** (+ post-hit feel event); no keeper yet.
- **Match system**: clock, halves, kickoff (≤0.75 s beat), goal→celebration→kickoff,
  half/full-time, scoring, draw.
- HUD: scoreboard + timer + toasts (Zustand meta store).
- Per-action feel for pass/tackle/post (respect the loudness hierarchy).
**Exit:** you can play a full timed match — passing to dummy teammates, tackling dummy
opponents, scoring — see the HUD, and every action feels right and correctly ordered
in loudness. **Review gate.**

---

## M3 — Keeper + the Goal sequence *(L1)*  · then  · Opponent AI *(L1)*
Split into two gated sub-phases so each is reviewable on its own (do not bundle):

**M3a — Keeper + Goal sequence** (still vs dummy outfielders):
- **Keeper system**: positioning, set→commit→recover dive states, reach/reaction,
  parry-preferred/catch outcomes, ≤0.4 s auto-distribution; lob-over possible; keeper
  feel beats.
- **Goal sequence**: hitstop→flash→net ripple→slow-mo→crowd→confetti→fast kickoff,
  skippable after the slow-mo peak.
- *Exit:* scoring past a real keeper is a thrill; the goal moment lands. **Review gate.**

**M3b — Opponent AI** (replaces the dummies with brains):
- Formations + role anchors + team mode; steering (seek/arrive/separation/avoid).
- Per-player FSM; single designated chaser **+ local tackle zones** (anti-passive);
  decision hysteresis (anti-jitter); role-slot ownership; support runs; defending shape;
  throttled decision tick.
- On-ball AI decisions (shoot/pass/through/dribble) with difficulty noise.
- Tune one default difficulty (AI speed ≤ human).
**Exit (FEEL GATE — the big one):** a full Human-vs-AI match that is **fun, fast, and
juicy as primitives**; AI holds shape, makes runs, challenges along the boards, and is
beatable-but-not-trivial; scoring a goal is a thrill. All P1–P4 pillar acceptance
passes on primitives. **Deep-review gate. Decision point: only now do we climb the art
ladder.**

> **MVP is effectively complete at the end of M3b** (per the scope: 5v5, single match,
> human vs basic AI, one pitch, 4 actions, basic keeper, scoreboard+timer, simple AI +
> formations, full feel). M4+ is fidelity.

---

## M4 — Lighting, shadows, tone mapping *(L2 + L3)*
**Goal:** the cheapest, biggest visual jump — still primitives.
- One directional "sun" + shadow map (tight frustum) + hemisphere fill; real ball &
  player shadows (height cue now physical).
- ACES filmic tone mapping + correct color space.
**Exit:** primitives look grounded and cinematic; 60 FPS held. **Review gate.**

---

## M5 — PBR materials + environment + pitch dressing *(L4)*
- `MeshStandardMaterial`; drei `<Environment>`; grass texture with **mowed stripes**;
  proper goals/nets/boards materials; high-contrast kit colors on capsules.
**Exit:** reads as a real (if abstract) football scene. **Review gate.**

---

## M6 — Real player models + animation *(L5 + L6)*
- Swap capsules for one low-poly rigged glTF model (Quaternius CC0 default; Synty
  optional), recolored per kit; selection ring.
- AnimationMixer: idle/run/kick/tackle/dive blended from the existing `Player.state`.
  (Hand-key the kick contact to land on the hitstop frame.)
**Exit:** players read as players; animation syncs to actions without changing sim.
**Review gate.** *(UI/visual integration kept in-house, not delegated — user rule.)*

---

## M7 — Post-processing + full juice + dressing *(L7 + L8)*
- EffectComposer: subtle bloom, AO (grounds contacts), vignette, color grade
  (toggleable for low-end).
- Full particle suite (turf, sparks, confetti), polished trails, dynamic crowd/ambience
  audio, near-miss emphasis; instanced crowd, stands, floodlights.
**Exit:** the "AAA glaze"; the target experience (overview §5) is fully realized.
**Deep-review + QA + product-owner sign-off.**

---

## M8 — Polish, balance, ship
- Difficulty tuning pass; balance pitch size/speed/keeper for the target pace.
- Performance pass (budgets in tech doc §14); low-end fallback verified.
- **Accessibility & options pass** (tech doc §19): reduce-motion/flash, shake/flash +
  volume sliders, colorblind-safe kits, mute; verify the goal sequence has a
  photosensitive-safe mode.
- **Platform robustness pass** (tech doc §16): tab-blur pause, stuck-key clearing,
  WebGL context-loss handling, unsupported-browser screen, resize/DPR.
- Menus/pause/result polish; rematch flow; settings essentials.
- Static build + deploy to a web host; smoke E2E green.
**Exit:** shippable build; `/ship` workflow.

---

## Dependency / parallelization notes
- **M0→M1→M2→M3 are sequential** (each builds on the loop/sim).
- Within a milestone, independent systems can be **parallelized to subagents/Codex**
  with file-disjoint chunks (e.g., in M2: pass vs tackle vs match-system vs HUD).
- **Art layers M4–M7** can overlap once M3's seam is frozen, but gated by the feel gate.
- **Codex** does implementation chunks; **Claude** writes specs/plans, reviews Codex,
  and keeps UI/visual work (M6/M7 integration) in-house (user rules).

## Suggested first delegation to Codex (post-approval)
M0 scaffold + the M1 game-loop skeleton (loop.ts, time.ts, rng.ts, world types, the
fixed-step accumulator with hitstop/interpolation) — small, well-specified, highly
testable, easy to review. Then the feel-system core. Each chunk: TDD first, Codex
implements, Claude verifies against this spec.
