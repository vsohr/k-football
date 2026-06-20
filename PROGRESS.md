# PROGRESS

## Current task
Authoring the detailed spec for k-football (arcade 2.5D web football). Then Codex review.

## Key decisions (locked from brainstorm)
- Platform: **Web**, React Three Fiber (2.5D low-poly 3D, near-top-down tilted camera).
- Core loop is **feel-first**: hitstop > screen shake. Pacing = compressed tension/release.
- MVP scope: 5v5, single match, human vs basic AI, one pitch, move/pass/shoot/tackle, basic keeper, scoreboard+timer, simple AI + simple formations.
- Build via **fidelity ladder**: ship primitives + feel, then layer art/lighting/post without rewriting the game.
- Codex does the coding; Claude writes spec/design + reviews Codex; Codex also reviews spec/design.

## Open decisions (defaults chosen, flagged in spec for user)
- Art direction: stylized-clean low-poly (default) vs chunky-retro. [DEFAULT: stylized-clean]
- Shot input: hold-to-charge vs tap-power. [DEFAULT: tap with brief auto-windup; hold optional later]
- Input device: keyboard+mouse primary, gamepad layer later. [DEFAULT]
- Match length: 2 min halves (4 min total). [DEFAULT]

## Status
- [x] Repo scaffold + worktree (worktrees/spec on branch spec/detailed-spec)
- [x] 00-overview, 01-game-design, 02-feel-spec, 03-technical-architecture
- [x] 04-acceptance-criteria, 05-roadmap
- [x] Codex review (round 1) — verdict "not ready for M1 as written"; 3 criticals verified
- [x] Incorporated all critical+major fixes + missing pieces; wrote 99-review-log.md
- [ ] **USER: confirm D6 (camera: perspective vs orthographic)** — only genuine open fork
- [ ] Round-2 Codex review of revised spec (next gate)
- [ ] M0 scaffold → M1 (after D6) — first Codex implementation chunk

## Key outcome of review
Codex concurred with all flagged defaults EXCEPT camera projection (recommends
orthographic for readability; brainstorm leaned perspective). Escalated to user as D6.
Fixed: loop contract, deferred-impulse hitstop, swept collision, 3-clock model,
M2(dummy)/M3a/M3b reslice, assist+keeper+board edge cases, accessibility, audio policy,
asset pipeline, determinism caveat, feel event schema, feel dev-tooling into M1.

## Next steps
1. Get D6 decision from user. 2. Optional round-2 Codex pass on revised spec.
3. Merge spec branch to main. 4. Plan M0/M1 (writing-plans) → Codex implements → review.
