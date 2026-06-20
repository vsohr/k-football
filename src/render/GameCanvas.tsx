import { Canvas, useThree } from '@react-three/fiber';
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
import { ConfettiController } from './feel/ConfettiController';

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
  const ballRef = useRef<THREE.Mesh>(null);
  const playerRefs = useRef<(THREE.Group | null)[]>([]);
  const confettiRef = useRef<THREE.InstancedMesh>(null);
  const camBase = useRef(new THREE.Vector3(...CAMERA_POS));
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
            feel.addTrauma(0.04);
            audio.pass();
            break;
          case 'tackleClean':
            feel.addTrauma(0.3);
            feel.kick(0, -0.25);
            audio.tackle();
            break;
          case 'tackleWhiff':
            audio.whiff();
            break;
          case 'goal': {
            feel.addTrauma(0.7);
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
      if (ballRef.current) {
        ballRef.current.position.set(
          lerp(b.prevPos.x, b.pos.x, alpha),
          lerp(b.prevPos.y, b.pos.y, alpha) + BALL_RENDER_RADIUS,
          lerp(b.prevPos.z, b.pos.z, alpha),
        );
        // squash & stretch: flatten vertically + bulge horizontally on a strike.
        const s = feel.squash;
        ballRef.current.scale.set(1 + s * 0.35, 1 - s * 0.3, 1 + s * 0.35);
      }
      for (let i = 0; i < world.players.length; i++) {
        const p = world.players[i];
        const g = playerRefs.current[i];
        if (!g) continue;
        g.position.set(lerp(p.prevPos.x, p.pos.x, alpha), 0, lerp(p.prevPos.z, p.pos.z, alpha));
        g.rotation.y = lerpAngle(p.prevFacing, p.facing, alpha);
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
      const [ox, oy, oz] = feel.cameraOffset();
      camera.position.set(camBase.current.x + ox, camBase.current.y + oy, camBase.current.z + oz);

      r3fAdvance(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, loop, feel, audio, camera, r3fAdvance]);

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
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[BALL_RENDER_RADIUS, 24, 24]} />
        <meshStandardMaterial color="#FFD23F" emissive="#FFD23F" emissiveIntensity={0.25} />
      </mesh>
      {world.players.map((p, i) => (
        <group
          key={p.id}
          ref={(el) => {
            playerRefs.current[i] = el;
          }}
        >
          <mesh castShadow position={[0, 0.9, 0]}>
            <capsuleGeometry args={[0.4, 1, 8, 16]} />
            <meshStandardMaterial color={KIT_COLOR[p.team]} />
          </mesh>
          {/* facing pip (local +Z = forward) */}
          <mesh position={[0, 0.9, 0.45]}>
            <boxGeometry args={[0.18, 0.18, 0.3]} />
            <meshStandardMaterial color="#0d1117" />
          </mesh>
          {p.control === 'human' && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
              <ringGeometry args={[0.62, 0.78, 28]} />
              <meshBasicMaterial color="#FFD23F" transparent opacity={0.9} />
            </mesh>
          )}
        </group>
      ))}
    </>
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
    </Canvas>
  );
}
