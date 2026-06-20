# FINDINGS

Non-obvious discoveries, gotchas, and rationale worth not re-deriving.

## Environment
- Empty repo at session start (no commits). Git identity was unset; configured locally to vadim.ohrimenko@gmail.com / Vadim Ohrimenko.
- Toolchain: Node v24.16.0, npm 11.13.0, codex-cli 0.141.0.
- Worktrees require an existing commit — made an initial scaffold commit on main before `git worktree add`.

## Design rationale (so we don't relitigate)
- **Hitstop is the meal, shake is the garnish.** Freeze the whole sim 2–5 frames on impact; scale by power. This is the #1 feel lever.
- **Ball height is read via its shadow**, not perspective — shadow detaches/shrinks as ball lofts. Player drop-shadows ground everyone. This is the key top-down readability cue.
- **Every whistle is an adrenaline leak** — MVP cuts fouls/offside/throw-ins entirely.
- **Fidelity ladder ordering**: lighting+shadows (2) + ACES tone mapping (3) + post (7) deliver ~80% of perceived quality. Build feel-loop on primitives first.
- **Auto-switch to nearest player** so the player fights opponents, not controls.

## Technical notes (validated in Codex review round 1)
- Fixed-timestep sim decoupled from render is required for deterministic feel. Each
  `simulate()` uses a FIXED step always; slow-mo scales how fast the accumulator fills,
  hitstop freezes it. Never scale the per-tick dt (breaks determinism). Tech §3.
- **Loop contract decided**: R3F `frameloop="never"` + one manual rAF driver; NO
  gameplay `useFrame`. Avoids double loops / undefined useFrame order.
- **Hitstop must use a deferred-impulse contact model** — naive "set vel then integrate
  same tick" launches the ball ONE tick before the freeze (verified by tracing system
  order). Feedback fires at contact; ball travels after the freeze. Tech §6.1.
- **Swept collision is mandatory**: ball moves ~0.467 m/tick vs 0.44 m diameter →
  discrete checks tunnel thin posts/walls/goal-line (math verified). Tech §6.2.
- Physics: **custom kinematics chosen** (not Rapier) for MVP, behind a facade so Rapier
  can swap in later. Codex concurred.
- **Three clocks**: real (shake/flash/hitstop-countdown/audio), sim (gameplay, fixed
  step, frozen by hitstop), pause. Tag every timer. Tech §3.1.

## Open decision escalated to user
- **D6 camera projection**: Codex recommends tilted ORTHOGRAPHIC (readability + stable
  aim); brainstorm leaned tilted PERSPECTIVE (depth). The only genuine open fork.
