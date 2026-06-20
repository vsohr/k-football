import { PITCH } from './dimensions';

export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface Slot {
  role: Role;
  nx: number;
  nz: number;
}

const ANCHOR_SCALE_X = 0.92;
const ANCHOR_SCALE_Z = 0.85;

export const FORMATION_2_2: Slot[] = [
  { role: 'GK', nx: -0.95, nz: 0.0 },
  { role: 'DEF', nx: -0.55, nz: -0.4 },
  { role: 'DEF', nx: -0.55, nz: 0.4 },
  { role: 'FWD', nx: -0.12, nz: -0.45 },
  { role: 'FWD', nx: -0.12, nz: 0.45 },
];

export function anchorFor(slot: Slot, team: 0 | 1): { x: number; y: number; z: number } {
  const mirroredNx = team === 0 ? slot.nx : -slot.nx;

  return {
    x: mirroredNx * ANCHOR_SCALE_X * PITCH.halfX,
    y: 0,
    z: slot.nz * ANCHOR_SCALE_Z * PITCH.halfZ,
  };
}
