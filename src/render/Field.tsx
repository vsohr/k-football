import { useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { PITCH, GOAL } from '@/game';
import { makePitchTexture } from './pitchTexture';

const HALF_X = PITCH.halfX;
const HALF_Z = PITCH.halfZ;
const GOAL_HW = GOAL.halfWidth;
const GOAL_HEIGHT = 2.5;
const GOAL_DEPTH = 2.0;
const POST = 0.18;
const BOARD_H = 0.35;
const BOARD_T = 0.2;

/** A goal at one end. `dir` = +1 for the +X end, -1 for the -X end (posts/net mirror). */
function Goal({ dir }: { dir: 1 | -1 }) {
  const x = dir * HALF_X;
  const netX = x + dir * (GOAL_DEPTH / 2);
  return (
    <group>
      {/* posts */}
      {[-GOAL_HW, GOAL_HW].map((z) => (
        <mesh key={z} position={[x, GOAL_HEIGHT / 2, z]} castShadow>
          <boxGeometry args={[POST, GOAL_HEIGHT, POST]} />
          <meshStandardMaterial color="#f2f2f2" />
        </mesh>
      ))}
      {/* crossbar */}
      <mesh position={[x, GOAL_HEIGHT, 0]} castShadow>
        <boxGeometry args={[POST, POST, GOAL_HW * 2 + POST]} />
        <meshStandardMaterial color="#f2f2f2" />
      </mesh>
      {/* net (back + roof), faint */}
      <mesh position={[x + dir * GOAL_DEPTH, GOAL_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.04, GOAL_HEIGHT, GOAL_HW * 2]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>
      <mesh position={[netX, GOAL_HEIGHT, 0]}>
        <boxGeometry args={[GOAL_DEPTH, 0.04, GOAL_HW * 2]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

/** Low side/end boards (with goal-mouth gaps), the pitch plane, and both goals. */
export function Field() {
  const endSegLen = HALF_Z - GOAL_HW; // board length above/below the goal mouth
  const gl = useThree((s) => s.gl);
  const pitchTexture = useMemo(() => makePitchTexture(gl), [gl]);
  return (
    <group>
      {/* pitch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[HALF_X * 2 + 6, HALF_Z * 2 + 6]} />
        <meshStandardMaterial map={pitchTexture} roughness={0.92} metalness={0} />
      </mesh>

      {/* side boards (full length) */}
      {[-HALF_Z, HALF_Z].map((z) => (
        <mesh key={z} position={[0, BOARD_H / 2, z]} castShadow>
          <boxGeometry args={[HALF_X * 2 + BOARD_T, BOARD_H, BOARD_T]} />
          <meshStandardMaterial color="#dfe6ee" />
        </mesh>
      ))}

      {/* end boards (above + below each goal mouth) */}
      {([-1, 1] as const).map((dx) =>
        ([-1, 1] as const).map((dz) => (
          <mesh
            key={`${dx}:${dz}`}
            position={[dx * HALF_X, BOARD_H / 2, dz * (GOAL_HW + endSegLen / 2)]}
            castShadow
          >
            <boxGeometry args={[BOARD_T, BOARD_H, endSegLen]} />
            <meshStandardMaterial color="#dfe6ee" />
          </mesh>
        )),
      )}

      <Goal dir={1} />
      <Goal dir={-1} />
    </group>
  );
}
