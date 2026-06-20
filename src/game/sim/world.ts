import { createRng, type Rng } from '../core/rng';
import { createInputSource, type InputIntent, type InputSource } from '../input/source';

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

export interface Player {
  id: number;
  team: 0 | 1;
  control: 'human' | 'ai';
  pos: Vec3;
  prevPos: Vec3;
  vel: Vec3;
  facing: number;
  prevFacing: number;
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
  players: Player[];
  controlledId: number;
  intent: InputIntent;
  input: InputSource;
  match: MatchState;
  rng: Rng;
  events: FeelEvent[];
}

const INITIAL_BALL_VEL: Vec3 = {
  x: 4,
  y: 0,
  z: 2.5,
};

const INITIAL_PLAYER_POS: Vec3 = {
  x: -3,
  y: 0,
  z: 0,
};

const initialSeeds = new WeakMap<World, number>();

function setVec3(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function createZeroIntent(): InputIntent {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    shoot: false,
    pass: false,
    tackle: false,
  };
}

function setIntentZero(intent: InputIntent): void {
  intent.moveX = 0;
  intent.moveZ = 0;
  intent.sprint = false;
  intent.shoot = false;
  intent.pass = false;
  intent.tackle = false;
}

function setInputZero(input: InputSource): void {
  input.moveX = 0;
  input.moveZ = 0;
  input.sprint = false;
  input.shootBuf = 0;
  input.passBuf = 0;
  input.tackleBuf = 0;
}

function createHumanPlayer(): Player {
  return {
    id: 0,
    team: 0,
    control: 'human',
    pos: { ...INITIAL_PLAYER_POS },
    prevPos: { ...INITIAL_PLAYER_POS },
    vel: { x: 0, y: 0, z: 0 },
    facing: 0,
    prevFacing: 0,
  };
}

function setPlayerInitial(player: Player): void {
  player.id = 0;
  player.team = 0;
  player.control = 'human';
  setVec3(player.pos, INITIAL_PLAYER_POS);
  setVec3(player.prevPos, INITIAL_PLAYER_POS);
  player.vel.x = 0;
  player.vel.y = 0;
  player.vel.z = 0;
  player.facing = 0;
  player.prevFacing = 0;
}

function resetPlayers(players: Player[]): void {
  if (players.length === 0) {
    players.push(createHumanPlayer());
    return;
  }

  players.length = 1;
  setPlayerInitial(players[0]);
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

  resetPlayers(world.players);
  world.controlledId = 0;
  setIntentZero(world.intent);
  setInputZero(world.input);

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
    players: [createHumanPlayer()],
    controlledId: 0,
    intent: createZeroIntent(),
    input: createInputSource(),
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
