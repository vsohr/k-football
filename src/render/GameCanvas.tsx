import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  createLoop,
  createTime,
  createWorld,
  simulate,
  type Loop,
  type World,
} from '@/game';
import { lerp } from './interpolate';

/** Camera framing: near-top-down tilted perspective (~57° from horizontal), modest FOV (D6). */
const CAMERA_POS: [number, number, number] = [0, 26, 15];
const CAMERA_FOV = 40;

/**
 * Authoritative driver. With `frameloop="never"`, our own rAF advances the fixed-step
 * sim loop, interpolates sim state onto mesh refs (bridge.sync), then calls R3F's
 * `advance(now)` to render exactly once. No `useFrame` for game logic (tech §3.2).
 */
function GameDriver({ world, loop }: { world: World; loop: Loop }) {
  const r3fAdvance = useThree((s) => s.advance);
  const camera = useThree((s) => s.camera);
  const ballRef = useRef<THREE.Mesh>(null);

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

      // bridge.sync(alpha): interpolate sim transforms onto mesh refs before render.
      const b = world.ball;
      const mesh = ballRef.current;
      if (mesh) {
        mesh.position.set(
          lerp(b.prevPos.x, b.pos.x, alpha),
          lerp(b.prevPos.y, b.pos.y, alpha) + 0.5,
          lerp(b.prevPos.z, b.pos.z, alpha),
        );
      }

      r3fAdvance(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [world, loop, r3fAdvance]);

  return (
    <mesh ref={ballRef} castShadow>
      <sphereGeometry args={[0.5, 24, 24]} />
      <meshStandardMaterial color="#FFD23F" emissive="#FFD23F" emissiveIntensity={0.25} />
    </mesh>
  );
}

function Scene() {
  // Create the deterministic sim + loop once. Kept out of React state (no re-renders).
  const { world, loop } = useMemo(() => {
    const w = createWorld(1);
    const time = createTime();
    const l = createLoop({ time, simulate: (dt) => simulate(w, dt) });
    return { world: w, loop: l };
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
      {/* Pitch plane (M0 placeholder green; real grass at M5). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#3FAE5A" />
      </mesh>
      <GameDriver world={world} loop={loop} />
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
