import { Canvas, useThree } from '@react-three/fiber';
import { SoftShadows } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  createLoop,
  createTime,
  createWorld,
  requestHitstop,
  shootTrauma,
  simulate,
  type Loop,
  type MatchPhase,
  type TimeState,
  type World,
} from '@/game';
import { lerp, lerpAngle } from './interpolate';
import { usePlayerInput } from './useInput';
import { FeelController } from './feel/FeelController';
import { AudioBus } from './feel/AudioBus';
import { useMetaStore } from '@/state/metaStore';
import { Field } from './Field';
import { Effects } from './Effects';
import { ConfettiController } from './feel/ConfettiController';
import { makeBallTexture } from './ballTexture';
import { pollGamepad } from './gamepadPoll';

const PHASE_TOAST: Partial<Record<MatchPhase, string>> = {
  GOAL: 'GOAL!',
  HALF_TIME: 'HALF TIME',
  FULL_TIME: 'FULL TIME',
};

/** Camera: near-top-down tilted perspective (~59° from horizontal), framing the whole
 * goal-to-goal pitch incl. both goals; modest FOV to limit distortion (D6). */
const CAMERA_POS: [number, number, number] = [0, 32, 19];
const CAMERA_FOV = 46;
const BALL_RENDER_RADIUS = 0.4;
const KIT_COLOR = ['#E8453C', '#2D6CF0'] as const;
const SKIN_COLOR = '#e8b48a';
const SHORTS_COLOR = '#eef1f5';
const HAIR_COLOR = '#2a2722';

// Reused scratch for ball-roll integration (single ball — no per-frame allocation).
const ROLL_AXIS = new THREE.Vector3();
const ROLL_DELTA = new THREE.Quaternion();

interface GameModel {
  world: World;
  loop: Loop;
  time: TimeState;
  feel: FeelController;
  audio: AudioBus;
  confetti: ConfettiController;
}

/**
 * Authoritative driver. With `frameloop="never"`, our own rAF advances the fixed-step
 * sim loop, drains feel events, interpolates sim state onto mesh refs, applies the
 * real-time camera shake, then calls R3F's `advance(now)` to render once (tech §3.2).
 */
function GameDriver({ model }: { model: GameModel }) {
  const { world, loop, feel, audio, confetti } = model;
  const r3fAdvance = useThree((s) => s.advance);
  const camera = useThree((s) => s.camera);
  const ballGroupRef = useRef<THREE.Group>(null);
  const ballRef = useRef<THREE.Mesh>(null);
  const ballSpin = useRef(new THREE.Quaternion());
  const ballLastPos = useRef(new THREE.Vector3());
  const playerRefs = useRef<(THREE.Group | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const confettiRef = useRef<THREE.InstancedMesh>(null);
  const camBase = useRef(new THREE.Vector3(...CAMERA_POS));
  const gamepadPrev = useRef<boolean[]>([]);
  const ballTexture = useMemo(() => makeBallTexture(), []);
  const lastMeta = useRef<{
    scoreHome: number;
    scoreAway: number;
    clockSec: number;
    half: 1 | 2;
    phase: MatchPhase;
  }>({ scoreHome: -1, scoreAway: -1, clockSec: -1, half: 1, phase: 'PLAYING' });

  const unlockAudio = useCallback(() => audio.unlock(), [audio]);
  usePlayerInput(world.input, unlockAudio);

  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const realDt = (now - last) / 1000;
      last = now;

      // Menu/pause gating: the sim only advances once started and not paused (tech §16).
      const meta = useMetaStore.getState();
      model.time.paused = !meta.started || meta.paused;

      // Gamepad -> InputSource: poll once per frame before the sim advances.
      gamepadPrev.current = pollGamepad(world, gamepadPrev.current, unlockAudio);

      const { alpha } = loop.advance(realDt);

      // Drain semantic feel events into the real-time feel channels (feel §7/§10).
      for (const ev of world.events) {
        switch (ev.type) {
          case 'shoot': {
            const power = ev.power ?? 1;
            feel.addTrauma(shootTrauma(power));
            feel.addFlash(0.12 * power);
            feel.addSquash(1);
            feel.kick(0, -0.35 * power);
            audio.shoot(power);
            break;
          }
          case 'pass':
            // Screen shake is reserved for shooting; the pass keeps only its SFX.
            audio.pass();
            break;
          case 'tackleClean':
            // Screen shake is reserved for shooting; tackles keep only their SFX.
            audio.tackle();
            break;
          case 'tackleWhiff':
            audio.whiff();
            break;
          case 'goal': {
            // Screen shake is reserved for shooting; the goal keeps its flash + SFX.
            feel.addFlash(0.6);
            audio.goal();
            const gx = ev.at?.x ?? 0;
            // +X goal => home (red) scored; -X => away (blue).
            confetti.burst(gx, 1, ev.at?.z ?? 0, gx > 0 ? KIT_COLOR[0] : KIT_COLOR[1]);
            break;
          }
          default:
            break;
        }
      }
      world.events.length = 0;

      // Sync match meta to the DOM HUD store, only when a displayed value changes
      // (no per-frame React churn — tech §8).
      const m = world.match;
      const clockShown = Math.floor(m.clockSec);
      if (
        m.scoreHome !== lastMeta.current.scoreHome ||
        m.scoreAway !== lastMeta.current.scoreAway ||
        clockShown !== lastMeta.current.clockSec ||
        m.half !== lastMeta.current.half ||
        m.phase !== lastMeta.current.phase
      ) {
        lastMeta.current = {
          scoreHome: m.scoreHome,
          scoreAway: m.scoreAway,
          clockSec: clockShown,
          half: m.half,
          phase: m.phase,
        };
        useMetaStore.getState().setMatch({
          scoreHome: m.scoreHome,
          scoreAway: m.scoreAway,
          clockSec: clockShown,
          half: m.half,
          phase: m.phase,
          toast: PHASE_TOAST[m.phase] ?? null,
        });
      }

      // bridge.sync(alpha): interpolate sim transforms onto mesh refs before render.
      const b = world.ball;
      const ballGroup = ballGroupRef.current;
      if (ballGroup) {
        const bx = lerp(b.prevPos.x, b.pos.x, alpha);
        const bz = lerp(b.prevPos.z, b.pos.z, alpha);
        ballGroup.position.set(bx, lerp(b.prevPos.y, b.pos.y, alpha) + BALL_RENDER_RADIUS, bz);
        // squash & stretch on the group (world-aligned) so the spin below stays separate.
        const s = feel.squash;
        ballGroup.scale.set(1 + s * 0.35, 1 - s * 0.3, 1 + s * 0.35);
        // Roll: accumulate spin about (up × travel) by distance / radius so the
        // pentagons visibly tumble in the direction of motion.
        const last = ballLastPos.current;
        const dx = bx - last.x;
        const dz = bz - last.z;
        const dist = Math.hypot(dx, dz);
        // Skip teleports (kickoff/goal reset) so the ball doesn't add a bogus spin step.
        if (dist > 1e-4 && dist < 3 && ballRef.current) {
          ROLL_AXIS.set(dz, 0, -dx).normalize();
          ROLL_DELTA.setFromAxisAngle(ROLL_AXIS, dist / BALL_RENDER_RADIUS);
          ballSpin.current.premultiply(ROLL_DELTA);
          ballRef.current.quaternion.copy(ballSpin.current);
        }
        last.set(bx, 0, bz);
      }
      for (let i = 0; i < world.players.length; i++) {
        const p = world.players[i];
        const g = playerRefs.current[i];
        if (g) {
          g.position.set(lerp(p.prevPos.x, p.pos.x, alpha), 0, lerp(p.prevPos.z, p.pos.z, alpha));
          g.rotation.y = lerpAngle(p.prevFacing, p.facing, alpha);
        }
        // Selection ring follows auto-switch — toggled imperatively because the driver
        // never re-renders React, so a JSX control flag would stay stale (the bug fix).
        const ring = ringRefs.current[i];
        if (ring) ring.visible = p.id === world.controlledId;
      }

      // Confetti (goal celebration) — write pooled instances each frame.
      if (confettiRef.current) confetti.writeTo(confettiRef.current);

      // Camera: ease toward a slight centered zoom-in during the goal celebration, then
      // add the real-time shake/kick offset (keeps moving during hitstop — feel §8).
      const zoom = world.match.phase === 'GOAL' ? 0.86 : 1;
      const ease = Math.min(1, realDt * 3);
      camBase.current.x += (CAMERA_POS[0] * zoom - camBase.current.x) * ease;
      camBase.current.y += (CAMERA_POS[1] * zoom - camBase.current.y) * ease;
      camBase.current.z += (CAMERA_POS[2] * zoom - camBase.current.z) * ease;
      const [ox, oy, oz] = meta.reduceMotion ? [0, 0, 0] : feel.cameraOffset();
      camera.position.set(camBase.current.x + ox, camBase.current.y + oy, camBase.current.z + oz);

      r3fAdvance(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, loop, feel, audio, confetti, camera, r3fAdvance, unlockAudio, model]);

  return (
    <>
      <instancedMesh
        ref={confettiRef}
        args={[undefined, undefined, confetti.max]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 0.35]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <group ref={ballGroupRef}>
        <mesh ref={ballRef} castShadow>
          <sphereGeometry args={[BALL_RENDER_RADIUS, 32, 32]} />
          <meshStandardMaterial
            map={ballTexture}
            color="#ffffff"
            roughness={0.5}
            metalness={0}
            emissive="#ffffff"
            emissiveIntensity={0.08}
          />
        </mesh>
      </group>
      {world.players.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => {
            playerRefs.current[i] = el;
          }}
        >
          <PlayerFigure
            team={p.team}
            ringRef={(el) => {
              ringRefs.current[i] = el;
            }}
          />
        </group>
      ))}
    </>
  );
}

/**
 * Low-poly footballer from primitives, tuned to read from the near-top-down camera:
 * shoulders wider than deep (non-uniform torso scale) and dark hair covering the crown
 * and back of a skin head — so the exposed face cues facing direction from above. The
 * selection ring's visibility is driven imperatively by GameDriver each frame.
 */
function PlayerFigure({
  team,
  ringRef,
}: {
  team: 0 | 1;
  ringRef: (el: THREE.Mesh | null) => void;
}) {
  const kit = KIT_COLOR[team];
  return (
    <group>
      {/* selection ring under the feet — visibility set each frame by the driver */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} visible={false}>
        <ringGeometry args={[0.5, 0.68, 32]} />
        <meshBasicMaterial color="#FFE76A" transparent opacity={0.95} toneMapped={false} />
      </mesh>
      {/* legs */}
      <mesh castShadow position={[-0.13, 0.32, 0]}>
        <capsuleGeometry args={[0.1, 0.4, 6, 10]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0.13, 0.32, 0]}>
        <capsuleGeometry args={[0.1, 0.4, 6, 10]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.8} />
      </mesh>
      {/* shorts */}
      <mesh castShadow position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.27, 0.28, 0.3, 16]} />
        <meshStandardMaterial color={SHORTS_COLOR} roughness={0.7} />
      </mesh>
      {/* torso — broad shoulders, narrow depth so orientation reads from above */}
      <mesh castShadow position={[0, 1.05, 0]} scale={[1.18, 1, 0.82]}>
        <cylinderGeometry args={[0.3, 0.24, 0.6, 16]} />
        <meshStandardMaterial color={kit} roughness={0.55} />
      </mesh>
      {/* arms (short sleeves in the kit colour) */}
      <mesh position={[-0.33, 1.04, 0]} rotation={[0, 0, 0.16]}>
        <capsuleGeometry args={[0.075, 0.42, 5, 8]} />
        <meshStandardMaterial color={kit} roughness={0.6} />
      </mesh>
      <mesh position={[0.33, 1.04, 0]} rotation={[0, 0, -0.16]}>
        <capsuleGeometry args={[0.075, 0.42, 5, 8]} />
        <meshStandardMaterial color={kit} roughness={0.6} />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 1.55, 0]} scale={[1, 1.05, 1]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={SKIN_COLOR} roughness={0.75} />
      </mesh>
      {/* hair: covers crown + back, leaving the face (+Z) skin to show facing */}
      <mesh position={[0, 1.6, -0.05]}>
        <sphereGeometry args={[0.205, 16, 16]} />
        <meshStandardMaterial color={HAIR_COLOR} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Scene() {
  // Build the deterministic sim + loop + feel once. Kept out of React state.
  const model = useMemo<GameModel>(() => {
    const world = createWorld(1);
    const time = createTime();
    const feel = new FeelController();
    const audio = new AudioBus();
    const confetti = new ConfettiController();
    const loop = createLoop({
      time,
      onRealTime: (dt) => {
        feel.update(dt);
        confetti.update(dt);
      },
      simulate: (dt) => {
        simulate(world, dt);
        // sim requests hitstop by writing a frame count; translate it to the time clock
        // synchronously so the loop freezes before the next step (tech §6.1).
        if (world.pendingHitstopFrames > 0) {
          requestHitstop(time, world.pendingHitstopFrames);
          world.pendingHitstopFrames = 0;
        }
      },
    });
    return { world, loop, time, feel, audio, confetti };
  }, []);

  return (
    <>
      <SoftShadows size={26} samples={10} focus={0.85} />
      <hemisphereLight args={['#9DC9FF', '#3a5a2a', 0.6]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        castShadow
        position={[20, 30, 10]}
        intensity={1.1}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-normalBias={0.04}
      />
      <Field />
      <GameDriver model={model} />
    </>
  );
}

export function GameCanvas() {
  return (
    <Canvas
      frameloop="never"
      dpr={[1, 2]}
      shadows
      camera={{ position: CAMERA_POS, fov: CAMERA_FOV, near: 0.1, far: 200 }}
      gl={{
        antialias: true,
        toneMapping: THREE.AgXToneMapping,
        toneMappingExposure: 1.0,
        powerPreference: 'high-performance',
      }}
    >
      <color attach="background" args={['#0d1117']} />
      <Scene />
      <Effects />
    </Canvas>
  );
}
