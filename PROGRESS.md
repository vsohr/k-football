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

## Graphics (user asked to elevate graphics to a great state + research)
- 3 parallel research agents (art direction / R3F pipeline / VFX+pitch+stadium).
  Art-direction agent rate-limited; pipeline + VFX agents returned deep cross-verified
  findings. Wrote docs/spec/06-graphics.md (art direction, pipeline, materials, post,
  VFX, stadium, camera, perf tiers + Appendix A: versions/libs/gotchas).
- Folded verified corrections: AgX tone mapping (not ACES default), MeshLambert pitch +
  anti-flicker recipe, baked line texture (avoid geometry lines), N8AO+multisampling=0,
  selective bloom via emissive+toneMapped=false, decals static-only, no built-in motion
  blur, flatShading/vertexColors post-r125 API, frameloop=never+advance() w/ composer.
- Updated tech §3.2 (advance vs gl.render), overview ladder pointer, roadmap M4-M7.

## Autonomous build directive (user)
"commit and push frequently after each change, use codex for coding + review its code,
keep going until done." Remote: github.com/vsohr/k-football (gh authed). main + spec
pushed.

## Build status (branch build/mvp)
- [x] Round-2 Codex review done; spec merged to main + pushed.
- [x] M0 scaffold (Vite7/R3F9/React19/strict TS/Vitest); deps pinned; build+typecheck green.
- [x] M0 core (Codex, TDD): loop/time/rng/world/sim/index barrel; 22 tests; Claude-reviewed.
- [x] M0 render shell (me): GameCanvas frameloop=never + manual driver (loop.advance →
      bridge.sync interpolation → r3fAdvance), tilted perspective cam, AgX, sun+hemisphere,
      shadowed pitch, interpolated ball.
- [x] M0 verified: headless screenshot = lit pitch + ball + drop shadow; ball moves
      (loop running). typecheck/test/lint/build green.

## Verification method
Headless: `npm run build` + `vite preview` + google-chrome-stable --headless=new
--use-angle=swiftshader --screenshot. First shot can be a blank rAF-timing flake — reshoot.
No Playwright yet (add at E2E milestone).

## Next: M1 — feel loop on primitives (THE heart)
Input manager+buffer; one human player + ball dribble; SHOOT via deferred-impulse +
feel-system core (hitstop/shake/camera-kick/audio-unlock/trail/squash) + ball blob
shadow + leva feel panel. TDD; Codex for sim/feel logic, me for R3F/UI; commit+push per
chunk. Then M2 (dummy players + actions + match) → M3a (keeper+goal) → M3b (AI) →
graphics M4-M7.
