import { create } from 'zustand';
import type { MatchPhase } from '@/game';

/**
 * Meta/UI state for the DOM HUD only (score/clock/phase). The simulation writes here
 * on change (throttled), NOT every frame — moving objects are driven imperatively, not
 * via React state (tech §8).
 */
export interface MetaState {
  scoreHome: number;
  scoreAway: number;
  clockSec: number;
  half: 1 | 2;
  phase: MatchPhase;
  toast: string | null;
  setMatch: (m: Partial<Omit<MetaState, 'setMatch'>>) => void;
}

export const useMetaStore = create<MetaState>((set) => ({
  scoreHome: 0,
  scoreAway: 0,
  clockSec: 0,
  half: 1,
  phase: 'PLAYING',
  toast: null,
  setMatch: (m) => set(m),
}));
