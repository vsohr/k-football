import { createRng, type Rng } from '../core/rng';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type MatchPhase =
  | 'MENU'
  | 'KICKOFF'
  | 'PLAYING'
  | 'GOAL'
  | 'HALF_TIME'
  | 'FULL_TIME';

export interface Ball {
  pos: Vec3;
  prevPos: Vec3;
  vel: Vec3;
}

export interface MatchState {
  phase: MatchPhase;
  scoreHome: number;
  scoreAway: number;
  clockSec: number;
  half: 1 | 2;
}

export type FeelEventType =
  | 'shoot'
  | 'pass'
  | 'tackleClean'
  | 'tackleWhiff'
  | 'post'
  | 'save'
  | 'goal'
  | 'bounce';

export interface FeelEvent {
  type: FeelEventType;
  tick: number;
  power?: number;
  at?: Vec3;
}

export interface World {
  tick: number;
  ball: Ball;
  match: MatchState;
  rng: Rng;
  events: FeelEvent[];
}

const INITIAL_BALL_VEL: Vec3 = {
  x: 4,
  y: 0,
  z: 2.5,
};

const initialSeeds = new WeakMap<World, number>();

function setVec3(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function applyInitialState(world: World, seed: number): void {
  world.tick = 0;

  world.ball.pos.x = 0;
  world.ball.pos.y = 0;
  world.ball.pos.z = 0;
  world.ball.prevPos.x = 0;
  world.ball.prevPos.y = 0;
  world.ball.prevPos.z = 0;
  setVec3(world.ball.vel, INITIAL_BALL_VEL);

  world.match.phase = 'PLAYING';
  world.match.scoreHome = 0;
  world.match.scoreAway = 0;
  world.match.clockSec = 0;
  world.match.half = 1;

  world.rng = createRng(seed);
  world.events.length = 0;
  initialSeeds.set(world, seed);
}

export function createWorld(seed: number): World {
  const world: World = {
    tick: 0,
    ball: {
      pos: { x: 0, y: 0, z: 0 },
      prevPos: { x: 0, y: 0, z: 0 },
      vel: { x: INITIAL_BALL_VEL.x, y: INITIAL_BALL_VEL.y, z: INITIAL_BALL_VEL.z },
    },
    match: {
      phase: 'PLAYING',
      scoreHome: 0,
      scoreAway: 0,
      clockSec: 0,
      half: 1,
    },
    rng: createRng(seed),
    events: [],
  };

  initialSeeds.set(world, seed);

  return world;
}

export function resetWorld(world: World, seed?: number): void {
  applyInitialState(world, seed ?? initialSeeds.get(world) ?? 0);
}
