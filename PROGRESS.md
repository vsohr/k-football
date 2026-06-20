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
- [ ] 00-overview
- [ ] 01-game-design
- [ ] 02-feel-spec
- [ ] 03-technical-architecture
- [ ] 04-acceptance-criteria
- [ ] 05-roadmap
- [ ] Codex review + incorporate

## Next steps
Write spec docs under docs/spec/, then run codex-cli review pass.
