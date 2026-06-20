# k-football — Game Design

Concrete rules, dimensions, controls, and systems. All numeric values are
**tunables** — they live in one config file (see
[`03-technical-architecture.md`](03-technical-architecture.md) §Config) and the
values here are starting points, not gospel. Units are abstract "metres" (m) on the
pitch plane.

---

## 1. The match

### 1.1 Structure
- **5 v 5**: 1 goalkeeper + 4 outfield per side.
- **Two halves**, default **120 s each** (D4 — see overview). Teams switch ends at
  half time. A short half-time transition (~2 s, skippable) separates them.
- **No added time**, no extra time. If scores are level at full time the match is a
  **draw** in MVP (knockout/penalties deferred).
- Clock **counts up** 0:00 → 2:00 per half, displayed as `MM:SS`. (Counting up reads
  as "how long left in this short half" more naturally for 2-min halves; a count-down
  variant is a 1-line config flip — confirm preference.)

### 1.2 Match flow (states)
```
ATTRACT/MENU → KICKOFF → PLAYING → GOAL_CELEBRATION → KICKOFF
                              ↘ HALF_TIME → KICKOFF
                              ↘ FULL_TIME → RESULT → (rematch)
```
- **KICKOFF**: ball at centre spot, scoring-against team kicks off (loser of last
  goal), brief **≤ 0.75 s** "GET READY" beat, then live. (Kept short — the goal
  celebration already provided the release beat; piling a long kickoff on top is a
  pacing leak.)
- **GOAL_CELEBRATION**: see [`02-feel-spec.md`](02-feel-spec.md) §Goal. ~2.5 s total
  including slow-mo, then straight to kickoff. **Skippable** with shoot/pass after the
  slow-mo peak (~0.8 s in).
- The ball is **always live** otherwise. Precisely: **no *rule* stoppages** (no fouls/
  offside/throw-ins/corners/free-kicks). The only pauses are the goal celebration
  (itself a release beat) and the short kickoff — both bounded and skippable (P2).
  Keeper catches are the one other brief hold and are kept rare + auto-distributed
  fast (§6).

### 1.3 Ball out of play
There are **no throw-ins / corners / goal kicks** (P2). The pitch is enclosed by
**visible low boards** along all four sides; the ball **bounces** off them (with
damping). This keeps play continuous and frantic — Sociable-Soccer style. Only the
goal mouths are gaps in the boards. A deliberate arcade choice, not a placeholder.

Boards are **visible** (a low rail) so rebounds read clearly (P4) — invisible walls
make bounces feel random. Edge cases must be designed for, not discovered:
- **Rounded corners** so the ball can't wedge in a 90° corner.
- **Tangential friction** on bounce so the ball doesn't pinball forever along a wall.
- **Anti-stuck rule**: if the ball is pinned between a board and a player for > ~0.3 s,
  nudge it back into play (small impulse toward pitch centre).
- **Wall-camping mitigation**: AI is allowed to challenge along the boards; a player
  can't trivially shield against a wall indefinitely (tackle reach + the nudge break it).
- Explicit **net + back-wall** geometry behind each goal so a scored ball is trapped
  and ripples rather than vanishing.

> A softer alternative ("ball slows & auto-returns to nearest player") remains a config
> fallback. Default = bouncing boards (more chaotic, more action). Confirm if disliked.

---

## 2. Pitch & dimensions

A **short** pitch with no midfield dead zone (P2). Coordinate system: pitch lies on
the **XZ plane**, **Y is up**. Origin at centre spot. Long axis = X (goal to goal).

| Element | Value | Notes |
|---------|-------|-------|
| Pitch playable area | **42 m (X) × 26 m (Z)** | tune for "always near a duel" |
| Goal width | **7 m** | generous — arcade, scoring should be frequent |
| Goal depth (net) | 2.5 m | visual + ball-trap |
| Goal height | 2.5 m | lobs over keeper possible |
| Penalty/keeper zone | 9 m × 12 m box | keeper movement bounds |
| Centre circle | r = 4 m | kickoff spacing |
| Player radius (collision) | 0.5 m | capsule footprint |
| Ball radius | 0.22 m | |
| Wall restitution | 0.6 | bounce damping off boards |

Target feel: a pass from one penalty area can reach the other in ~1.5 s. If the pitch
feels "campy" (players standing around), shrink it.

---

## 3. Controls

**Default scheme: keyboard** (D3). Gameplay is **keyboard-only** for MVP — the mouse
is used for **menus only**, not in-match aiming (manual mouse/stick aim is a
designed-for extension, §3.4, not MVP). The input layer is device-agnostic so a
gamepad maps to the same *verbs* later (tech doc §Input). *(This supersedes any
"keyboard + mouse" shorthand — in-match input is keyboard.)*

### 3.1 Keyboard layout (default)
| Action | Key(s) | Notes |
|--------|--------|-------|
| Move | **WASD** or **Arrow keys** | 8-direction analog-ish; sets facing |
| Pass | **J** (or **Space**) | context: short ground pass to assisted target |
| Shoot | **K** (or **L**) | shot toward goal; power from brief auto-windup |
| Tackle / Pressure | **Shift** | slide/standing tackle when near ball; otherwise sprint-press |
| Through-ball (lob/lead) | **U** (modifier or 2nd pass key) | optional in MVP; lofted lead pass |
| Switch player (manual) | **Tab** | overrides auto-switch to next-nearest |
| Pause | **Esc** | |

> Only **Move / Pass / Shoot / Tackle** are required for MVP. Through-ball and manual
> switch are "nice to have" but cheap and improve depth (P3).

### 3.2 Movement
- 8-way (or smoothed analog) movement on the XZ plane. Player **facing** follows the
  movement vector; facing drives pass/shot direction when no explicit aim.
- **Sprint**: holding Tackle/Shift while *not* contesting the ball = sprint (faster,
  wider turn radius, can't change direction as sharply). Trade-off = depth (P3).
- Acceleration/turn are eased (not instant) so movement has momentum and weight, but
  kept snappy enough to feel responsive (arcade, not sim).

### 3.3 The four core actions

**Pass (P3 timing matters):**
- Ground pass to the **best assisted target** (D5): the teammate within a forward
  facing arc (~120°) weighted by distance, openness (no opponent on the lane), and
  forward progress. A subtle indicator highlights the current target.
- Pass **leads the runner** — aimed at where the teammate *will be*, not where they
  are. This is what makes it feel intentional (P3).
- **Power** scales with target distance (auto) so passes arrive at a constant, fast
  pace. A held pass = firmer/longer.
- Clean first-time pass (passing within a small window of receiving) gets a small
  feel bonus and slightly higher accuracy — rewarding timing (P3).

**Shoot (P1 loudest open-play moment):**
- Shot toward the goal, aimed by facing + a goal-seeking assist (curves the aim
  toward the goal mouth within a tolerance, so shots are satisfying not frustrating).
- **Power** from a brief auto-windup (D2): tapping gives a normal shot; the engine
  applies a 2–4 frame anticipation wind-up regardless (sells the hit). A hold-to-charge
  variant is deferred behind D2.
- Can be **lofted** (chip) with the through-ball modifier for lobs over the keeper.
- Everything about the shot's *feedback* is specified in the feel doc and is the
  single biggest juice investment in open play.

**Tackle (P1 crunch, never stops play):**
- When near the ball carrier: a **standing tackle** (quick poke) or **slide tackle**
  (Shift + direction, longer reach, bigger commitment + recovery time).
- Outcome is **timing-based** (P3): a well-timed tackle cleanly wins the ball; a
  mistimed one whiffs and leaves you in recovery (no foul — you just lose tempo).
- On a win, the ball **pops loose with visible spin** so play continues into a
  scramble — a tackle *creates* action, never a whistle (P2).
- Both players stagger on contact (not just the loser) — sells the crunch.

**Move** — covered in §3.2.

### 3.4 Aiming model (MVP)
- **Assisted by default** (D5): pass auto-targets; shot goal-seeks. This keeps the
  game accessible (P3 "fun in 10s") and keeps the player focused on positioning.
- The skill expression is in *positioning, timing, and movement* — not in fine aim.
- A manual-aim mode (aim with mouse / right stick) is a designed-for extension, not
  MVP.

**Assist must support skill, not replace it** (or it undermines P3). Guardrails on the
assists:
- **Visible target**: the current assisted pass target is always indicated, so the
  player can *steer* it (by facing) rather than be surprised by it.
- **Hysteresis + short target lock**: the target doesn't flicker between teammates
  frame-to-frame; once chosen it's held for a brief window unless facing changes
  decisively. No "the game picked someone I didn't mean".
- **Assist strength cap**: shot goal-seek only bends aim within a *tolerance* — a
  badly-aimed shot still misses. Assist nudges, never fully corrects.
- **Pressure-based error**: passing/shooting under a nearby challenge adds error
  (and a mistimed first touch fumbles) — so clean situations are rewarded over panicked
  ones (P3 depth). Assist ≠ immunity.

---

## 4. Player switching

- **Auto-switch to the nearest controllable player to the ball** whenever your team
  doesn't have possession, and to the **receiver** when you pass (so you "follow the
  ball"). This is critical — the player should fight opponents, not the controls (P2).
- Switch is **predictive on a pass**: control hands to the intended receiver as the
  pass is played, so you can run them onto it.
- **Minimum dwell time** after any auto-switch (~0.3 s) so control doesn't ping-pong
  between two equidistant players during a scramble (a classic top-down annoyance).
  Manual switch (Tab) always overrides immediately.
- **Manual override** (Tab) cycles to the next-nearest player for off-ball
  positioning.
- The keeper is **AI-controlled and never directly switched to** in MVP (keeps the
  scheme simple; manual-keeper is deferred).
- Visual: the controlled player has a clear **selection ring/marker** under them
  (also reads as their drop-shadow accent). Readability (P4).

---

## 5. Formations & tactics (simple only)

MVP ships **2–3 preset formations**; no custom editor.

| Formation (4 outfield) | Shape | Feel |
|------------------------|-------|------|
| **2-2** (default) | 2 defenders, 2 forwards | balanced |
| **1-2-1** (diamond) | 1 back, 2 wide mids, 1 striker | possession/width |
| **2-1-1** | 2 back, 1 mid, 1 striker | defensive |

- A formation defines, per role, a **home anchor position** (normalised to pitch and
  flipped by attacking direction) and a **role** (DEF / MID / FWD; plus the fixed GK).
- Players are pulled from their anchor toward the ball by a **role-weighted
  influence** (forwards push up, defenders hold) — this produces "defending shape"
  and "support runs" emergently without scripted plays (see AI doc).
- The human can **switch formation** from the pause menu (and pre-match). The AI
  picks one and may switch if losing late (deferred — single fixed AI formation is
  acceptable for MVP).
- No sliders, no individual instructions, no marking assignments in MVP (P3 keep it
  simple).

---

## 6. Goalkeeper model

A **basic goalkeeper / goal-zone defender** (per scope). Behaviour, in order of
sophistication we'll actually build:

1. **Positioning**: keeper stays in the goal mouth, tracking the ball's lateral
   position along the goal line (clamped to goal width + a little), and steps off the
   line slightly when the ball is close/central (cuts the angle).
2. **Shot reaction (set → commit → recover)**: the keeper runs a small state machine
   to avoid jitter: **SET** (tracking, ready), **COMMIT** (a shot is detected → dives/
   lunges toward the ball's predicted crossing point and *cannot* re-decide mid-dive —
   commitment is what makes lobs/placement beat him, P3), **RECOVER** (gets up after a
   dive, briefly vulnerable). Reaction delay and reach radius are the **primary
   difficulty knobs**; the commit window prevents twitchy frame-perfect saves.
3. **Save outcome**: within reach → **parry (preferred, common)** pops the ball loose
   into play = more action, P2; **catch (rarer)** only on softer/central shots, holds
   it briefly. Biasing toward parries keeps play continuous.
4. **Distribution**: on a catch, the keeper auto-distributes (roll/throw) to the
   nearest open teammate within **≤ 0.4 s** — restarts the attack fast, never a real
   stoppage (P2).
5. **Out-of-box**: keeper does **not** leave its zone to chase loose balls in MVP
   (it's a goal-zone defender, not a sweeper-keeper). Deferred.

Lobs/chips over the keeper are intentionally possible (goal height > keeper reach when
the keeper is off its line) — rewards the through-ball/chip skill (P3).

The keeper gets its **own feel beats**: a dive has anticipation + a small camera
nudge; a save has hitstop + a "deflection" particle; see feel doc.

---

## 7. Scoring, win condition, HUD

### 7.1 Scoring
- A goal counts when the **ball fully crosses the goal line** between the posts and
  under the bar, into the net trigger.
- On a goal: increment scorer's team, enter GOAL_CELEBRATION, then kickoff to the
  conceding team.
- **Own goals** count (arcade; rare with the bouncing boards but possible). Optional.

### 7.2 Win condition
- Higher score after both halves wins. Level = draw (MVP).

### 7.3 HUD (scoreboard + timer)
Minimal, high-contrast, non-intrusive overlay (DOM over the canvas):
- **Top-centre**: `HOME  2 — 1  AWAY` + `1:23` half timer + half indicator (`H1`/`H2`).
- Team colors echoed as small swatches matching kit colors (readability, P4).
- Brief **toast** on events: "GOAL!", "HALF TIME", "FULL TIME".
- No minimap in MVP (small pitch, full pitch is on screen — confirm). Optional later.
- HUD must never occlude the goal mouths or centre action.

---

## 8. Difficulty (parameterized, one default)

MVP ships **one tuned difficulty**, but every AI knob is a named parameter from day
one (cheap to expose levels later). Primary knobs:
- Keeper reach radius + reaction delay
- AI outfield reaction delay, pass/shot accuracy noise, press aggression
- AI top speed / acceleration relative to player (keep ≤ human to feel fair)

See AI section of the tech doc for the full parameter list.

---

## 9. Summary of tunables introduced here
Dimensions (§2), match length (§1.1), wall restitution (§1.3), pass arc/lead/power
(§3.3), shot assist tolerance (§3.3), tackle timing window + recovery (§3.3),
switch radius (§4), formation anchors + role weights (§5), keeper reach/reaction
(§6), difficulty knobs (§8). All centralised in the config module.
