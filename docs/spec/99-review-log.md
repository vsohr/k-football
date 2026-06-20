# k-football — Spec Review Log

Audit trail for the **spec-stage review gate** (workflow: every upstream stage gets its
own independent adversarial review before the next begins). The spec was written by
Claude, then reviewed **read-only by Codex** (independent cross-vendor pass), claims
independently verified by Claude, and resolutions applied.

---

## Round 1 — Codex review of the full spec (2026-06-20)

Tool: `codex exec -s read-only` over `docs/spec/*`. Verdict: *"Not ready to implement
M1 as written"* until the loop/timing/collision/scope items were fixed. All three
"critical" claims were **independently verified** before acting (math + spec trace).

| # | Sev | Finding | Verified? | Resolution |
|---|-----|---------|-----------|------------|
| 1 | critical | R3F loop ownership ambiguous (mixed rAF + `useFrame` + frameloop) → double loops / wrong order | ✅ spec had both options as if compatible | **Committed contract**: `frameloop="never"` + one manual driver, no gameplay `useFrame`; real-time effects update every render frame. Tech §3.2 |
| 2 | critical | Hitstop fires one tick *after* the ball already launched (ActionSystem→BallSystem, freeze decremented before simulate) | ✅ traced system order | **Deferred-impulse contact model**: feedback at contact, ball holds during freeze, impulse applied after. Tech §6.1, Feel §8.7 |
| 3 | critical | Fast ball tunnels thin posts/walls (0.467 m/tick > 0.44 m diameter) | ✅ math confirmed | **Swept** sphere-vs-segment/AABB collision mandated. Tech §6.2 |
| 4 | major | Slow-mo/timebase underdefined; timers on different implied clocks | ✅ | **Three-clock taxonomy** (real / sim / pause), every timer tagged; sim always fixed-STEP, slow-mo scales the *rate*. Tech §3.1 |
| 5 | major | "No stoppages" leaks (goal 2.5 s + 1.5 s kickoff + keeper holds) | ✅ wording | Reworded to **"no rule stoppages"**; kickoff ≤0.75 s; keeper parry-preferred + ≤0.4 s auto-distribute. Game §1.2, §6 |
| 6 | major | M2/M3 scope not cleanly sliced (pass/tackle need teammates; M3 bundles too much) | ✅ | M2 now uses **dummy players**; M3 split into **M3a keeper+goal** / **M3b opponent AI**. Roadmap |
| 7 | major | Assisted aim + auto-switch can erase skill / fight the player | partial (design judgment) | Added **visible target, hysteresis, target lock, assist caps, pressure error, min auto-switch dwell**. Game §3.3, §3.4, §4 |
| 8 | major | AI avoids swarm but invites passive defense + jitter; keeper needs commit states | design judgment | **Local tackle zones**, **decision hysteresis**, **role-slot ownership**; keeper **set→commit→recover**. Tech §7, Game §6 |
| 9 | major | Bouncing boards: corner traps, wall-camping, bank-shot exploits, lost ball | ✅ | **Visible rails, rounded corners, tangent friction, anti-stuck nudge, explicit net/back-wall**. Game §1.3, Tech §6 |
| 10 | minor | Tap shot latency could exceed ~100 ms (windup+hitstop) | ✅ | **Latency budget**: tap = 2+3 frames (~83 ms); reserve 7-frame freeze for power/post/save/goal; feedback at contact. Feel §4.4 |

### Missing pieces added
- **Accessibility & options** (reduce-motion/flash, shake/flash/volume sliders,
  colorblind-safe kits, remap-ready bindings). Tech §19; AC §3b.
- **Platform robustness/lifecycle** (tab-blur pause, stuck-key clear, WebGL context
  loss, resize/DPR, unsupported-browser screen). Tech §16; AC §3b.
- **Audio policy** (autoplay unlock on first gesture, preload/decode, buses, formats,
  graceful failure). Tech §17.
- **Asset pipeline & licensing** (CC0-first license manifest, glTF/texture compression,
  preload budget). Tech §18.
- **Determinism scope/caveat** (same-process guaranteed; cross-browser NOT — quantized
  hashing for tests; not a netcode commitment). Tech §20.
- **Feel event schema** (clock tag, units, priority, cooldown/stacking, timestamp,
  accessibility scalars). Feel §7.
- **Feel dev tooling pulled into M1** (hot-tweak panel, frame-step, input record/replay,
  event-timeline overlay). Roadmap M1.
- **MVP feel = *core* feel, not full L8 dressing** (contradiction resolved). Overview §4.
- **Input contradiction resolved** (in-match = keyboard; mouse = menus). Overview D3,
  Game §3.

### Decisions (after review)
Codex concurred with all flagged defaults **except the camera**:
- Custom physics (+swept) ✅ · bouncing boards ✅ · Howler-behind-AudioBus ✅ ·
  hand-rolled ECS-lite ✅ · stylized-clean art ✅ · tap shot ✅ · 2-min halves ✅ ·
  assisted pass (constrained) ✅.
- **Camera (D6) — RESOLVED by user → tilted perspective** (~55–60°, modest FOV) for
  depth/2.5D. Codex had recommended orthographic for readability; user chose
  perspective. Mitigations: modest FOV, generous assist tolerances, ortho fallback as a
  config swap.

### Status
Spec updated to address all critical + major findings. **Cleared to begin M0, and M1
once the user confirms D6 (camera).** A second Codex pass on the *revised* spec and a
Codex pass on the eventual M0/M1 *plan* are the next review gates.

---

## Round 2 — Codex review of the revised + graphics-expanded spec (2026-06-20)

Scope: verify round-1 fixes held, review the new `06-graphics.md` hard, and judge
build-readiness. Verdict: **conditional yes — design is ready; fix a handful of
cross-doc loop/time/tone-mapping contradictions before handing M0/M1 to a coding
agent.** Round-1 fixes all confirmed held.

| Sev | Finding | Resolution |
|-----|---------|------------|
| major | Graphics §3 said `composer.render()`, contradicting the `advance(now)` loop contract | Reworded: EffectComposer renders via R3F during `advance(now)`; never call `composer.render()`. Graphics §3 |
| major | Feel §7 tagged hitstop as **sim-time** (can't expire while sim is frozen) | Hitstop authored in frames, **counts down on real time** (`n/60`). Feel §7 |
| major | ACES leftovers in overview/tech vs AgX in graphics/roadmap | Unified on **AgX base, ACES alternate** across overview §3, tech §9, graphics §2.1 |
| major | High-tier 60 fps optimistic (N8AO+PCSS+bloom+tiltshift+crowd+shadows+particles) | **Medium = 60 fps target; High benchmark-gated**; gameplay particle budget cut to hundreds–low-thousands, big counts GPU-only. Graphics §8, §5 |
| major | HDR/bloom buffer under-specified | Added `frameBufferType={HalfFloatType}` requirement for threshold bloom. Graphics §3 |
| major | Graphics tuning panel sequenced at M1 but graphics start M4 | M1 = panel shell + feel controls; **graphics controls at M4**. Graphics §10 |
| stale | Tech still said meshes mutate in `useFrame` (2 places) | Reworded to `bridge.sync(alpha)` ref-mutation before `advance()`; no hot-path useFrame. Tech §2, §8 |
| minor | Pitch material conflict (§2.4 Standard vs §4 Lambert) | Tiered: Lambert early/flat, Standard with maps. Graphics §2.4, §4 |
| minor | Anti-flicker NPOT wording wrong (WebGL2 allows NPOT mipmaps) | Reworded: POT recommended for repeat/compression/WebGL1 fallback, not a WebGL2 requirement. Graphics §4 |
| minor | Goal wording "center past line" vs "whole ball crosses" | Specified: **center past line by ≥ `ball.radius`**. Tech §6 |
| minor | Perspective + tilt-shift could fight readability (P4) | Keep gameplay tilt-shift gentle, focus-band tracks play, off on Low, readability-gated. Graphics §3/§7/§8 |

**Graphics gaps** (not blockers; each art milestone M4–M7 must address before its gate):
transparency/render-order, texture/RT memory budget, KTX2/Draco loader wiring,
shader-compile stutter (`<Preload>`/warm-up), browser capability matrix, post RT sizing,
visual-regression captures. Captured as **Appendix B** in `06-graphics.md`.

**Build-readiness**: all must-fix items above are now resolved → **cleared to implement
M0 + M1.** Codex's recommended first chunks adopted:
1. **M0** — scaffold + loop: package set, strict Vite/R3F app, `frameloop="never"`,
   no-op sim, `bridge.sync(alpha)` + `advance(now)`, one interpolated cube; tests for
   the accumulator + hitstop/slow-mo clock behavior.
2. **M1 feel slice** — input buffer, one player + ball, shoot with pending impulse,
   real-time hitstop countdown, ball blob shadow, camera shake/kick, audio unlock;
   tests proving the ball stays frozen during hitstop then launches.

## Next gates
Codex reviews the M0/M1 implementation **plan**, then reviews Codex's own M0/M1 **code**,
each independently verified by Claude (per the autonomous build loop).
