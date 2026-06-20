# k-football — Graphics & Art Direction

How the game gets to a **genuinely great-looking** state — not a generic "three.js
demo" look. This is the deep version of the fidelity ladder (overview §3): the *what*
and the *how* of every visual layer, with concrete three.js / React Three Fiber /
drei / `@react-three/postprocessing` techniques, a performance budget, and quality
tiers.

Governing rule (unchanged): **feel first.** None of this starts until the M3b feel
gate passes on primitives (roadmap). Graphics then climb in independent, shippable
layers. But when we climb, we climb *deliberately* — this doc is the target.

---

## 1. Art direction

### 1.1 The look in one line
**Stylized-clean low-poly, lit like a premium toy stadium at golden hour** — clean
shapes, strong directional light, vivid but disciplined color, and a slight
tilt-shift "tabletop miniature" quality that suits the near-top-down camera.

### 1.2 Reference touchstones (what to steal)
| Reference | Steal this |
|-----------|-----------|
| **Sensible / Sociable Soccer** | Instant top-down readability; the ball + active player always pop; tiny players, huge clarity. |
| **Rocket League** | Arcade juice on a clean, readable stadium; restrained palette + big moments; floodlit night energy. |
| **FIFA Volta / street football** | Saturated kits, energy, tight pitch intimacy. |
| **Captain Tsubasa: RoNC** | Confident cel/anime pop — color and rim light doing the work, not texture detail. |
| **Synty POLYGON Sports** | Low-poly *coherence* — one consistent facet/shape language across everything reads as a designed world, not assets glued together. |
| **Monument Valley / Alto's Odyssey** | Color & light *mood*; clean geometry; how a limited palette + a strong grade looks expensive. |

### 1.3 House-style rules (the 5 commandments — follow everywhere)
1. **One strong key light.** Every object has a clearly lit side and a shadow side.
   Flat uniform ambient is the #1 cause of the "cheap demo" look — we never do it.
2. **Detail comes from light & color, not texture noise.** Surfaces are clean and
   flat-ish; we add richness with lighting, AO, rim light, and grading — not busy maps.
3. **Value-contrast hierarchy serves gameplay (P4).** The **ball** and the
   **controlled player** are the highest-contrast, most-saturated things on screen.
   Everything else is quieter so they pop.
4. **Disciplined palette.** One pitch-green family, **two high-contrast kits**, one
   **hot accent** (ball + UI highlights), neutral stadium. No muddy mid-saturation
   everything.
5. **Reads in silhouette** from the tilted top-down angle. If you can't tell players,
   ball, and goal apart as flat shapes, the lighting/color is wrong.

### 1.4 Color & mood — the hero look + alternates
**Hero: "Golden-hour stadium."** Warm key light + cool shadows = the classic
complementary look that reads as premium. Suggested palette (tune in-engine):
- Pitch grass: `#3FAE5A` / stripe `#379E50` (alternating mow bands)
- Warm key (sun): `#FFE6B0`, cool shadow/hemisphere sky: `#9DC9FF`, ground bounce:
  pitch green
- Kit A (home): `#E8453C` red / Kit B (away): `#2D6CF0` blue (max separation, CB-safe)
- Hot accent (ball, selection, UI): `#FFD23F` → near-white core for bloom
- Stadium neutrals: desaturated cool greys `#46505C`

Alternates (single config swap — the pipeline is identical):
- **Clean midday**: neutral white key, soft shadows, high-key cheerful.
- **Night floodlights**: dark sky, four bloomed floodlights, saturated kits glowing,
  high drama. (Best showcase of the bloom/post stack.)

### 1.5 Anti-slop checklist (do NOT ship these)
- ❌ Default grey Lambert/Standard with flat ambient.  ✅ Lit, graded, directional.
- ❌ Everything the same saturation/value.  ✅ Contrast hierarchy (rule 3).
- ❌ Pure black or pure white background.  ✅ A graded sky/gradient + subtle fog.
- ❌ No tone mapping / wrong color space (washed out).  ✅ §2.1.
- ❌ Realistic-but-muddy.  ✅ Commit to the stylization and the grade.

---

## 2. Rendering pipeline (the technical look)

R3F + drei + `@react-three/postprocessing`. The pipeline is the same across the hero
look and alternates — only light colors / sky / grade change.

### 2.1 Color management & tone mapping (get this right first — biggest cheap win)
- **Color management on** (three.js default since r152; R3F sets it) — albedo/diffuse
  textures `SRGBColorSpace`; normal/roughness/data maps `LinearSRGBColorSpace`; working
  space linear; output `SRGBColorSpace`. R3F's `<Canvas>` already sets these defaults.
- **Tone mapping**: **`AgXToneMapping` is the recommended base** (needs three **r161+**;
  r160 was broken). Verified rationale: ACESFilmic (R3F's default) shifts hue and
  *desaturates* — it fights our deliberately saturated grass/kit palette; **AgX
  preserves the authored palette** with cleaner highlight roll-off (ideal for floodlit
  bloom). Keep **ACESFilmic** as the "punchy/contrasty" alternate and **Khronos PBR
  Neutral** (r163+) as the faithful-color option. A/B all three in-scene; expose
  `toneMappingExposure` (~1.0). This one config is "cinematic" vs "washed out".
- **Keep tone mapping on the renderer (`gl.toneMapping`), not in the post chain.** Do
  **not** add a `<ToneMapping>` effect (r155+: tone mapping inside post only affects the
  screen pass and needs an `OutputPass` — avoid the footgun by leaving it on the gl).

### 2.2 Lighting rig
- **Key — directional "sun"**: warm, the only shadow-caster. ~50° elevation, raked
  azimuth for long readable shadows. Intensity is the scene's anchor.
- **Fill — `HemisphereLight`**: sky color (cool) over ground color (pitch green) →
  soft ambient *with color variation* + a free green bounce on player undersides.
  Never a flat `AmbientLight`.
- **Image-based light — drei `<Environment>`** (CC0 HDRI or a `preset`) at low
  intensity for subtle reflections/IBL on PBR materials and to make the night
  floodlights read. Doubles as the look's "world".
- **Rim/back light** (optional, cheap, high impact): a weak second directional from
  behind-camera-opposite to separate players from the pitch (premium "toy" sheen).

### 2.3 Shadows (crisp + cheap is the goal)
- **Dynamic players/ball**: single directional shadow, **tight shadow-camera frustum**
  around the pitch only (not the whole stadium), `PCFSoftShadowMap`, map size 2048.
  drei **`<SoftShadows/>`** (PCSS) for distance-aware softening if perf allows
  (tier-gated). CSM (cascaded, `three-csm`/drei) only if a single tight cascade proves
  insufficient — for a small arcade pitch it usually is enough.
- **Ball height cue (critical, P4)**: a **dedicated blob/decal shadow** that scales
  *down* and offsets as the ball rises — layered *on top of* the real shadow so height
  is always readable regardless of shadow-map angle. Players get a faint contact blob
  too (guaranteed grounding even on low tier).
- **Static stadium**: **bake** it — drei **`<AccumulativeShadows>` + `<RandomizedLight>`**
  for gorgeous soft contact shadows under stands/goals at zero per-frame cost, or
  baked lightmaps. drei **`<ContactShadows>`** is the cheap grounding fallback.
- **`<BakeShadows/>`** for shadows that don't need to update every frame (static set).

### 2.4 Materials
- **Pitch & stadium**: `MeshStandardMaterial` (PBR) — flat-ish roughness, low metal;
  lighting + AO + grade do the work. Plays correctly with Environment and bloom.
- **Players**: PBR base **+ a subtle Fresnel/rim term** for the premium toy sheen and
  silhouette separation. Cleanest route that **keeps three's shadows/lighting/fog**:
  **`three-custom-shader-material`** writing the rim into `csm_Emissive`
  (`fresnel = bias + scale·pow(1−dot(N,V), 2..5)`). drei **`<Outlines>`** adds a cheap
  toon outline for extra readability. Solid saturated kit colors.
- **Cel option (documented)**: `MeshToonMaterial` + a 3-step `gradientMap` (drei
  `<GradientTexture>`; note **`MeshGradientMaterial` does not exist**). Hero =
  PBR-stylized (verified: PBR + clean lighting + grade reads more "premium" than toon
  for sports); cel is a flagged variant, not default.
- **Low-poly faceting**: `flatShading: true` + **`vertexColors`** (no textures). Modern
  API only — the pre-r125 `Face3`/`geometry.faces`/`THREE.VertexColors` API was
  **removed**: use `geometry.toNonIndexed()`, set all 3 verts of a tri to one color,
  `vertexColors` is a **boolean**, colors are **0–1** (not 0–255).
- **Ball**: bright base + slight **emissive** so bloom catches it (it's the hot accent).

### 2.5 Environment & atmosphere
- **Sky**: a **stylized gradient sky** (large gradient backdrop) for the hero/midday
  looks; drei **`<Sky>`** (Preetham) is an option for daylight; dark graded sky for
  night. Never pure flat color.
- **Fog**: subtle `FogExp2` / height fog at the pitch edges — adds depth, sells the
  miniature feel, and hides stadium LOD/edges cheaply.
- **Background**: always graded, ties into the grade (§3.4).

---

## 3. Post-processing — the "glaze"

`@react-three/postprocessing` (pmndrs/postprocessing). One `EffectComposer`; effects
are merged where possible. Driven by the **quality tier** (§6) and rendered in the
manual loop's present step (`composer.render()` — we use `frameloop="never"`).

### 3.1 Recommended chain & order
1. **Ambient occlusion** — **N8AO** (the `n8ao` package; better quality/perf than
   built-in SSAO) or GTAO. Grounds contacts, adds the depth that screams "AAA". Bake
   AO for fully-static geometry; N8AO for the dynamic scene. *(High tier; off on Low.)*
2. **Bloom** — `<Bloom luminanceThreshold={1} mipmapBlur />`. **Get "selective bloom"
   for free**: push only the ball / floodlights / goal-flash materials above 1.0 via
   `emissiveIntensity` **+ `toneMapped={false}`** (mandatory — else tone mapping clamps
   below the threshold). Prefer plain `<Bloom>` over `<SelectiveBloom>` for perf (and
   `<SelectiveBloom>`'s `lights` prop is required). Subtle by default; the **night
   look** leans on it. *(All tiers, intensity scales.)*
3. **Tilt-shift** — **`TiltShiftEffect`**. *Signature look for our camera*: a focused
   horizontal band of play with soft top/bottom makes the pitch read as a beautiful
   **tabletop miniature**. High perceived-quality for low cost; tune gentle.
   *(Med/High tier.)*
4. **Depth of field** — only for the **goal-cam / slow-mo push-in** (not gameplay).
   *(High tier, transient.)*
5. **Color grade** — a **LUT** (`LUT3DEffect` / drei `<LUT>`, authored `.cube`) is the
   single biggest cinematic lever; cheap fallback = `BrightnessContrast` +
   `HueSaturation`. This is where the "golden-hour" identity is finalized. *(All tiers.)*
6. **Vignette** — subtle; **pulses** on big moments (goal, post) for emphasis. *(All.)*
7. **Chromatic aberration** — barely-there at edges; **spikes briefly on impacts**
   (feel tie-in, §5). *(Med/High.)*
8. **Antialiasing** — **SMAA** as the final pass (cheap, sharp; doesn't smear fast
   motion the way TAA does). **Critical gotcha**: EffectComposer's default MSAA
   (`multisampling={8}`) **does not work with AO/depth effects** — so when N8AO is on,
   set `multisampling={0}` + `gl={{ antialias:false }}` and rely on SMAA. **Avoid TAA**
   (ghosting on the quick ball). *(All tiers.)*

### 3.2 Per-effect cost & the rule
AO and DoF are the expensive ones; bloom/tiltshift/vignette/LUT/SMAA are cheap. The
rule: **layers 2 + 5 + 6 + 8 (bloom, grade, vignette, SMAA) ship on every tier** and
already deliver most of the "wow"; AO/tilt-shift/DoF/CA are progressive.

---

## 4. Pitch & field

- **Material**: **one plane, ~1 draw call.** Use **`MeshLambertMaterial`** for the
  cheapest good-looking lit grass (no specular needed); switch to
  **`MeshStandardMaterial`** *only* when you add normal/roughness/AO maps or want
  `<Environment>` IBL (Lambert/Basic ignore envMaps). **Gotcha:** `aoMap` requires a
  **second UV set (`uv2`)** or it silently does nothing.
- **Mowed stripes**: alternating lightness bands aligned to the long axis. Author with
  a **`THREE.CanvasTexture`** (`fillRect` loop — zero asset weight) or a CC0 PBR set
  (e.g. TextureCan #469). Optional subtle **normal map** for directional sheen.
- **Anti-flicker recipe (mandatory for our grazing tilt camera)** — stripes/lines
  shimmer in the distance without this:
  ```js
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipMapLinearFilter;      // trilinear — kills distance flicker
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); // ~16 (NOT the deprecated getMaxAnisotropy())
  ```
  Use **power-of-two** texture sizes (2048²–4096²) or WebGL disables mipmaps. Set
  `<Canvas dpr={[1,2]}>` first — blurry distant ground is often a DPR problem, not AA.
- **Line markings**: **bake into the texture** (validated winner). Avoid geometry
  lines for ground markings: `Line2`+`worldUnits` has documented oblique-angle
  artifacts (three #26916 — exactly our grazing case) and plain `THREE.Line` ignores
  `linewidth`. Baked 2K–4K texture + max anisotropy is crisp and cheap.
- **Hero-shot grass blades** (optional, High tier only): if ever used, **chunked raw
  `THREE.InstancedMesh`** (e.g. 16×16 chunks for frustum culling), **alpha-test/cutout
  (not alpha-blend** — overdraw is the 60fps killer), 2-tri quads, wind in the vertex
  shader. **Avoid drei `<Instances>` at grass scale.** Deferred + tier-gated, never
  required for a flat pitch.
- **Wear & sheen**: roughness variation; faint worn goal-mouth patches via texture.

---

## 5. VFX & particles (the visual half of "feel")

Cross-references the feel spec (`02-feel-spec.md`) — there it's *when*, here it's *how*.
- **Particle system**: **`three.quarks`** or **`wawa-vfx`** (R3F-friendly) for
  spray/sparks/dust; drei **`<Trail>`** for the ball streak; drei **`<Sparkles>`** for
  ambient motes; **`r3f-confetti`** for the goal burst. Budget **~50k CPU particles /
  <100 draw calls**.
- **Turf spray** (tackle/sprint): short-lived green specks flung along the impact
  vector. **Confetti** (goal): instanced colored quads in scorer's colors. **Impact
  sparks/dust**: small additive bursts. **Ball trail**: ribbon/streak on shots,
  length ∝ speed.
- **Goal net + ripple**: net as an alpha-textured **subdivided plane**; **ripple** via a
  cheap **vertex-shader damped radial displacement** seeded at the ball's contact point
  (no cloth sim) — a key goal-moment beat.
- **Skid/slide marks** (slide tackle): **NOT drei `<Decal>`** — it re-bakes geometry on
  mount and is **static-only** (use `<Decal>` only for *fixed* logos/scuffs). For *live*
  skid marks use a **`CanvasTexture` scuff layer** (blended via `onBeforeCompile`) or a
  **pooled ribbon/quad trail** that fades.

---

## 6. Stadium & atmosphere (alive, on a budget)

- **Stands**: simple raked geometry, instanced sections.
- **Crowd**: **`@threejs-kit/instanced-sprite-mesh`** (animated instanced sprites) or
  instanced low-poly figures; per-instance color noise (team-colored home/away ends);
  **cheap animation** via a vertex/instance sine bounce + a "cheer" swell on goals.
  Thousands of instances, one draw call. Distant stands → **impostor planes**.
- **Floodlights**: emissive fixtures + **bloom** + cheap additive light cones (the
  night look's showpiece).
- **Ad boards / pitch-side**: textured, optionally animated; great for color + life.
- **Budget discipline**: bake stadium lighting, instance everything repeated, LOD/cull
  the far stands, never let static dressing cost per-frame.

---

## 7. Camera & composition

- Tilted **perspective** ~55–60°, **modest FOV (~35–45°)** to limit the distortion
  Codex warned about (D6 mitigation) while keeping depth.
- Subtle **dynamic follow** + slight zoom toward the action; **goal-cam push-in** with
  DoF during slow-mo, driven by `@react-spring/three` or `camera-controls`.
- **Screen shake**: manual **trauma model** (feel §2) — damp a camera-offset with
  `maath/easing` on real time. **Hitstop**: delta-scaled freeze (feel §8). **Goal
  flash**: a fullscreen quad, not a post effect.
- **Motion blur for slow-mo**: ⚠️ **not built into `@react-three/postprocessing`** —
  fake it with the ball `<Trail>` + the time-scale itself, or pull in `realism-effects`
  if a true motion blur is ever wanted (heavier; likely skip).
- **Composition**: keep play in a centered safe band — the **tilt-shift focus band**
  (§3.1) aligns with it, drawing the eye exactly where the game is.
- Optional micro camera-sway for life (real-time, accessibility-disableable).

---

## 8. Quality tiers & performance

Target **60 fps on a mid laptop**. One `quality` setting (auto-detect + manual),
also the low-end fallback. drei **`<PerformanceMonitor>`** + **`<AdaptiveDpr>`** to
auto-scale; **DPR capped ~2**.

| Feature | Low | Medium | High |
|---------|-----|--------|------|
| Shadows | contact-blob only | tight directional 2048 | + SoftShadows/PCSS |
| AO | off | baked only | N8AO dynamic |
| Bloom | light | yes | selective + stronger |
| Tilt-shift | off | gentle | full |
| DoF (goal-cam) | off | off | on |
| Color grade (LUT) | BrightnessContrast | LUT | LUT |
| Vignette / SMAA | on | on | on |
| Chromatic aberration | off | subtle | subtle + impact spikes |
| Crowd | static sprites | instanced static | instanced animated |
| Grass blades | no | no | hero band |

Techniques that keep all of this at 60 fps: **instancing** (drei `<Instances>`/
`<Instance>` — note there is **no** drei `<InstancedMesh>`; raw `<instancedMesh>` for
dense static), **baking** static lighting/AO/shadows, **draw-call merging** (drei
`<Merged>`, `mergeGeometries`; target **<100 draw calls**), tight shadow frustum, DPR
cap. **Adaptive quality**: `useDetectGPU()` picks the initial tier bucket;
`<PerformanceMonitor onDecline/onIncline>` steps DPR/quality under sustained load;
`<AdaptiveDpr pixelated>` + `<AdaptiveEvents>` for transient camera-move regressions;
`<Preload all>` warms shaders/textures (kills first-frame hitches); profile with
`r3f-perf` (`<Perf>` — watch `calls` + `renderer.info.memory`). Only ~11 entities
animate — the budget is spent on the look, not the sim. **Manually dispose** geometry/
material/texture (three does not GC GPU resources).

---

## 9. Mapping to the fidelity ladder

| Ladder layer (overview §3) | This doc |
|----------------------------|----------|
| L2 Lighting + shadows | §2.2, §2.3 |
| L3 Tone mapping | §2.1 |
| L4 PBR + environment | §2.4, §2.5, §4 (pitch) |
| L5 Real models | §5 players (assets), §2.4 materials |
| L6 Animation | players (kick on hitstop frame) |
| L7 Post-processing | §3 (full chain) |
| L8 Juice & dressing | §5 VFX, §6 stadium, §7 camera, §3 impact tie-ins |

---

## 10. Assets, sourcing & tooling

- **Models**: Quaternius (CC0) default footballer; Synty POLYGON Sports (paid/licensed)
  optional. One rigged model, recolored per kit. Draco/meshopt compression.
- **HDRI/Environment**: Poly Haven (CC0). **Textures**: KTX2/basis. **LUT**: author a
  `.cube` from a graded reference frame (or a `leva`-driven grade exported once).
- **License manifest** in `assets/CREDITS.md` (tech §18). CC0-first for the open build.
- **Dev graphics tuning panel** (`leva`): live control of tone mapping/exposure, light
  colors/intensities, fog, bloom/AO/tiltshift/LUT params — author the hero look by eye,
  then freeze values into `config/graphics.ts`. Built alongside the feel panel (M1).

---

## 11. Acceptance (graphics) — see also `04-acceptance-criteria.md`
- [P] The game, at High tier, reads as a **premium stylized stadium**, not a demo —
  judged against the §1.2 references by 3 viewers.
- [P] House-style rules §1.3 hold on every screen (one key light, contrast hierarchy,
  disciplined palette, silhouette reads).
- [T/P] Holds **60 fps** at the target spec on Medium; Low tier holds on weak GPUs;
  tier auto-drops under load.
- [P] Ball height is unmistakable via its shadow at all heights (P4) on every tier.
- [P] Night-floodlight look showcases bloom without blowing out or losing readability.
- [P] Accessibility caps (reduce-motion/flash) visibly tame shake/flash/CA/DoF.

---

## Appendix A — Verified stack, versions & gotchas (research-backed)

Cross-verified against three.js docs, pmndrs drei/postprocessing source, and 2024–2026
articles. **Assumed versions**: three **r161+**, **R3F v9 + React 19**, **drei 10.x**,
**@react-three/postprocessing v3.x** (v3 requires React 19 / R3F v9 / three ≥0.156, is
ESM-only, dropped `<SSR>`). Lock these in `package.json` and re-verify on install.

### A.1 Reference `<Canvas>` + lighting + shadow config (High tier)
```jsx
<Canvas
  dpr={[1, 2]}
  frameloop="never"               // manual fixed-step driver (tech §3.2); else "always"
  gl={{ antialias: false,         // SMAA in post instead (required when N8AO on)
        toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.0,
        powerPreference: 'high-performance' }}>
  <hemisphereLight args={['#9DC9FF', '#3a5a2a', 0.6]} />   {/* sky / grass-ground / int */}
  <ambientLight intensity={0.25} />                         {/* keep 0.1–0.3; high = flat */}
  <directionalLight castShadow position={[40,60,20]} intensity={1.0}
    shadow-mapSize={[2048,2048]}
    shadow-camera-near={1} shadow-camera-far={200}
    shadow-camera-left={-60} shadow-camera-right={60}
    shadow-camera-top={40} shadow-camera-bottom={-40}      {/* wrap the pitch exactly */}
    shadow-normalBias={0.04} />                             {/* normalBias > bias for flat ground */}
  <Environment preset="park" environmentIntensity={0.7} /> {/* IBL/reflections, NOT shadows */}
  <SoftShadows size={20} samples={8} />                     {/* PCSS, global patch; tier-gated */}
</Canvas>
```
Post (one `<EffectComposer multisampling={0}>`, in order):
`N8AO(quality="performance", halfRes) → Bloom(luminanceThreshold=1, mipmapBlur) →
TiltShift → [DepthOfField — goal-cam only] → LUT(.cube) → SMAA → Vignette → [CA tiny]`.

### A.2 Library list (intended dependencies)
| Purpose | Package |
|---------|---------|
| Core | `three`, `@react-three/fiber`, `@react-three/drei` |
| Post | `@react-three/postprocessing`, `postprocessing`, `n8ao` |
| Rim/custom shading | `three-custom-shader-material` |
| Particles | `three.quarks` or `wawa-vfx`; `r3f-confetti` (goals) |
| Camera moves | `@react-spring/three` or `camera-controls` |
| Easing/shake | `maath` (`maath/easing`) |
| Crowd | `@threejs-kit/instanced-sprite-mesh` |
| Perf/dev | `r3f-perf`, drei `useDetectGPU`/`<PerformanceMonitor>`/`<AdaptiveDpr>` |
| Tuning | `leva` (dev only) |
| (Optional) true motion blur | `realism-effects` (heavy; likely skip) |

### A.3 Load-bearing gotchas (each cost someone a day)
1. **Tone mapping stays on `gl`**, not a `<ToneMapping>` post effect (§2.1).
2. **`multisampling={0}` + `antialias:false` + SMAA** whenever N8AO/depth effects are on
   (MSAA breaks them) (§3.1).
3. **Selective bloom = `emissiveIntensity>1` + `toneMapped={false}`** (§3).
4. **`aoMap`/`lightMap` need a `uv2` set**; lightMap is `SRGBColorSpace`, `flipY=false`
   for glTF.
5. **No drei `<InstancedMesh>` and no drei CSM component** — use `<Instances>`/raw
   `<instancedMesh>`; core `three/addons/csm` only if ever truly needed (our fixed cam
   doesn't need CSM).
6. **drei `<Decal>` is static-only** (re-bakes on mount) — live skids use CanvasTexture/
   ribbon (§5).
7. **No built-in MotionBlur** in @react-three/postprocessing (§7).
8. **Memoize shader `uniforms` with `useMemo`**; animate via `useFrame` ref-mutation,
   **never `setState`**; **never allocate in `useFrame`** (hoist scratch vectors).
9. **Pre-r125 `Face3`/`VertexColors` API removed** — `toNonIndexed()` + boolean
   `vertexColors` + 0–1 colors (§2.4).
10. **Manually dispose** GPU resources; cap **DPR ≤ 2** (mobile DPR 3–4 melts the
    fragment shader).

### A.4 Reference R3F football projects (study, don't copy)
`mmaquer2/VirtualSoccerField` (baked-texture pitch) · `giustini/react-soccer-lineup`
(markings + mowing logic) · `dmerello-wip/r3f-football` (R3F + physics scaffold).

### A.5 Key sources
three r152 color mgmt; tone-mapping overview + AgX (#27362); PBR Neutral (modelviewer);
drei `Environment`/`SoftShadows`/`AccumulativeShadows` source; postprocessing v3
releases; `n8ao`; Bloom/SelectiveBloom/SMAA/TiltShift/DoF/LUT pmndrs docs; R3F scaling-
performance + pitfalls; `detect-gpu`; `r3f-perf`; TextureCan #469 pitch set; three issue
#26916 (Line2 oblique-angle); FluffyGrass + Codrops grass article; instanced-grass perf
thread. (Full URLs captured in the research transcripts.)
