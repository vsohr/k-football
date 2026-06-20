import type { Vec3 } from '@/game';

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate each axis of two Vec3s into a target tuple (no allocation when reused). */
export function lerpVec3(prev: Vec3, cur: Vec3, t: number): [number, number, number] {
  return [lerp(prev.x, cur.x, t), lerp(prev.y, cur.y, t), lerp(prev.z, cur.z, t)];
}
