# k-football

A fast, juicy, arcade 2.5D football game for the web.

5-a-side. Single match. Human vs AI. One pitch. Move / pass / shoot / tackle.
Built with React Three Fiber (low-poly 3D, near-top-down camera) and engineered
around **game feel** — hitstop, screen shake, particles, and a tight
tension-and-release pace.

> Status: **Playable MVP.** Full 5v5 match vs AI, keeper, scoreboard/timer, the core
> feel layer (hitstop / shake / squash / procedural SFX / goal confetti), and a
> stylized-clean look (mowed-stripe pitch, glowing ball, bloom + tilt-shift + vignette,
> soft shadows). See [`docs/spec/`](docs/spec/) for the full design.

## Run it

```bash
npm install
npm run dev        # play at the printed localhost URL
npm test           # 95 deterministic sim tests
npm run build      # static production bundle
```

**Controls — Xbox gamepad (primary):** Move with the left stick / D-pad · **B** shoot ·
**A** pass (in possession) / tackle (out of possession) · **Y** switch player (out of
possession) · **RB** sprint. **Keyboard (fallback):** move `WASD`/arrows · shoot
`J`/`Space` · pass `K` · sprint `Shift`. Control auto-switches to the player nearest the
ball; `Esc`/`Space` pause. Audio unlocks on the first input.

## Architecture (built)

A hard seam between a **pure, deterministic, fixed-step simulation** (`src/game/**` — no
three.js/React imports, 95 unit tests) and **presentation** (`src/render/**`,
`src/ui/**`). The R3F canvas runs `frameloop="never"`; one manual loop advances the
fixed-step sim (real-time hitstop, slow-mo, interpolation), drains semantic feel events
to the render channels, and calls R3F's `advance()` to render. Sim work was built with
Codex under TDD and independently reviewed; rendering/UI hand-built.

## Documentation

- [`docs/spec/00-overview.md`](docs/spec/00-overview.md) — vision, pillars, scope
- [`docs/spec/01-game-design.md`](docs/spec/01-game-design.md) — rules, controls, MVP
- [`docs/spec/02-feel-spec.md`](docs/spec/02-feel-spec.md) — the per-action feedback bible
- [`docs/spec/03-technical-architecture.md`](docs/spec/03-technical-architecture.md) — stack, systems, fidelity ladder
- [`docs/spec/04-acceptance-criteria.md`](docs/spec/04-acceptance-criteria.md) — definition of done
- [`docs/spec/05-roadmap.md`](docs/spec/05-roadmap.md) — milestones
- [`docs/spec/06-graphics.md`](docs/spec/06-graphics.md) — art direction, rendering pipeline, VFX (research-backed)
- [`docs/spec/99-review-log.md`](docs/spec/99-review-log.md) — Codex review gate + resolutions

## Tech

Vite 7 · React 19 · TypeScript (strict) · React Three Fiber 9 · drei · three 0.171 ·
@react-three/postprocessing (bloom / tilt-shift / vignette / SMAA) · Zustand · Vitest.
Physics is custom arcade kinematics (swept ball collision); no external 3D physics engine.
