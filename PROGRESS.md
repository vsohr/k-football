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

- [x] M1.1 (Codex sim + my render): input source/buffer/intent, config, Player, input+
      movement systems; DOM listener, player capsule/ring/pip, angle interp. 32 tests.
- [x] M1.2 (Codex): ball possession/dribble/pickup/drag/bounce; actionSystem SHOOT ->
      deferred impulse + 'shoot' event + pendingHitstopFrames; loop stops stepping when
      hitstop activates. 46 tests incl. deferred-impulse integration test (PROVEN).
- [x] M1.3-core+squash (me): FeelController (trauma shake + camera kick + flash + squash,
      real-time decay), procedural WebAudio AudioBus (shot thump + autoplay unlock),
      GameCanvas wires hitstop-request + event drain -> shake/kick/audio/squash + camera
      shake. typecheck/46 tests/lint/build green; headless render verified.
- [~] M1.4 leva tuning panel: DEFERRED (dev-tooling, non-blocking).
- [ ] FEEL GATE pt1 = HUMAN PLAYTEST (spec AC §P1): does the shot THUMP? `npm run dev`,
      WASD to move/dribble, J/Space to shoot. Audio needs the first keypress (unlock).

## Verification method
Headless: `npm run build` + `vite preview --port 4173` + google-chrome-stable
--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --screenshot. The
render is rAF-driven so screenshots are FLAKY — many come back blank (4718 bytes = blank);
~6000ms virtual-time-budget lands a rendered frame most reliably; reshoot until size >
~9KB. No Playwright yet (add at E2E milestone). Feel (audio/hitstop) can't be judged
headlessly — needs a human at `npm run dev`.

## Architecture notes for resume
- Sim is pure (src/game/**, no three/react). Render is src/render/**. Hard seam.
- Loop: frameloop="never" + manual rAF in GameDriver: loop.advance(realDt) -> drain
  world.events -> bridge.sync interpolation -> camera shake -> r3fAdvance(now).
- Hitstop: sim sets world.pendingHitstopFrames; render closure calls requestHitstop(time)
  synchronously so the loop freezes before the ball launches (deferred impulse).
- facing convention: atan2(moveX,moveZ), 0=+Z, dir=(sin,cos). Render rotation.y=facing.
- Division of labor: Codex does sim/logic (TDD), Claude does R3F/UI + reviews Codex.

## Next: M2 — dummy players + pass + tackle + match structure
Codex: full 5v5 roster as static/dummy bodies (hold anchors); pass (assisted+lead),
tackle (clean/whiff+pop-loose), auto-switch, swept ball-vs-wall/goal-line + goal
detection, match FSM (clock/halves/kickoff/goal->celebration->kickoff/full-time),
per-action feel events. Me: more players render, HUD scoreboard/timer (zustand), toasts,
pass/tackle feel channels. Then M3a (keeper+goal seq) -> M3b (opponent AI) -> graphics
M4-M7. (Graphics gated behind M3b feel gate per roadmap.)
