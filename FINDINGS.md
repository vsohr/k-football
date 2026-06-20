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

## Technical notes (to validate during Codex review)
- Fixed-timestep simulation decoupled from render is required for deterministic feel (hitstop, fixed physics). Don't tie game logic to R3F's variable rAF delta.
- Candidate physics: Rapier (@react-three/rapier) vs hand-rolled 2D-on-plane kinematics. Arcade ball + simple collisions may not need a full 3D physics engine; evaluate cost.
