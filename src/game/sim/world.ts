import { createRng, type Rng } from '../core/rng';
import { FORMATION_2_2, anchorFor, type Role, type Slot } from '../config/formations';
import { MATCH } from '../config/pace';
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
  owner: number | null;
  pendingImpulse: Vec3 | null;
  cooldown: number;
}

export type KeeperState = 'SET' | 'COMMIT' | 'RECOVER';

export interface Player {
  id: number;
  team: 0 | 1;
  role: Role;
  control: 'human' | 'ai';
  anchor: Vec3;
  pos: Vec3;
  prevPos: Vec3;
  vel: Vec3;
  facing: number;
  prevFacing: number;
  recoverFrames: number;
  keeperState: KeeperState;
  keeperTimer: number;
  holdTimer: number;
  aiMoveX: number;
  aiMoveZ: number;
  aiSprint: boolean;
  decisionTimer: number;
}

export interface MatchState {
  phase: MatchPhase;
  scoreHome: number;
  scoreAway: number;
  clockSec: number;
  half: 1 | 2;
  phaseTimer: number;
  kickoffTeam: 0 | 1;
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
  pendingHitstopFrames: number;
  switchCooldown: number;
  chaser: [number, number];
}

const CONTROLLED_HOME_ID = 3;

const initialSeeds = new WeakMap<World, number>();

function createZeroIntent(): InputIntent {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    shoot: false,
    pass: false,
    tackle: false,
    switch: false,
  };
}

function setIntentZero(intent: InputIntent): void {
  intent.moveX = 0;
  intent.moveZ = 0;
  intent.sprint = false;
  intent.shoot = false;
  intent.pass = false;
  intent.tackle = false;
  intent.switch = false;
}

function setInputZero(input: InputSource): void {
  input.moveX = 0;
  input.moveZ = 0;
  input.sprint = false;
  input.shootBuf = 0;
  input.passBuf = 0;
  input.tackleBuf = 0;
  input.switchBuf = 0;
}

function createPlayer(slot: Slot, slotIndex: number, team: 0 | 1): Player {
  const id = team * FORMATION_2_2.length + slotIndex;
  const anchor = anchorFor(slot, team);
  const facing = team === 0 ? Math.PI / 2 : -Math.PI / 2;

  return {
    id,
    team,
    role: slot.role,
    control: id === CONTROLLED_HOME_ID ? 'human' : 'ai',
    anchor: { ...anchor },
    pos: { ...anchor },
    prevPos: { ...anchor },
    vel: { x: 0, y: 0, z: 0 },
    facing,
    prevFacing: facing,
    recoverFrames: 0,
    keeperState: 'SET',
    keeperTimer: 0,
    holdTimer: 0,
    aiMoveX: 0,
    aiMoveZ: 0,
    aiSprint: false,
    decisionTimer: 0,
  };
}

function createPlayers(): Player[] {
  const players: Player[] = [];

  for (const team of [0, 1] as const) {
    for (let slotIndex = 0; slotIndex < FORMATION_2_2.length; slotIndex += 1) {
      players.push(createPlayer(FORMATION_2_2[slotIndex], slotIndex, team));
    }
  }

  return players;
}

function resetPlayers(players: Player[]): void {
  const initialPlayers = createPlayers();

  players.length = 0;
  players.push(...initialPlayers);
}

function applyInitialState(world: World, seed: number): void {
  world.tick = 0;

  world.ball.pos.x = 0;
  world.ball.pos.y = 0;
  world.ball.pos.z = 0;
  world.ball.prevPos.x = 0;
  world.ball.prevPos.y = 0;
  world.ball.prevPos.z = 0;
  world.ball.vel.x = 0;
  world.ball.vel.y = 0;
  world.ball.vel.z = 0;
  world.ball.owner = null;
  world.ball.pendingImpulse = null;
  world.ball.cooldown = 0;

  resetPlayers(world.players);
  world.controlledId = CONTROLLED_HOME_ID;
  setIntentZero(world.intent);
  setInputZero(world.input);

  world.match.phase = 'KICKOFF';
  world.match.scoreHome = 0;
  world.match.scoreAway = 0;
  world.match.clockSec = 0;
  world.match.half = 1;
  world.match.phaseTimer = MATCH.kickoffBeatSec;
  world.match.kickoffTeam = 0;

  world.rng = createRng(seed);
  world.events.length = 0;
  world.pendingHitstopFrames = 0;
  world.switchCooldown = 0;
  world.chaser[0] = -1;
  world.chaser[1] = -1;
  initialSeeds.set(world, seed);
}

export function createWorld(seed: number): World {
  const world: World = {
    tick: 0,
    ball: {
      pos: { x: 0, y: 0, z: 0 },
      prevPos: { x: 0, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      owner: null,
      pendingImpulse: null,
      cooldown: 0,
    },
    players: createPlayers(),
    controlledId: CONTROLLED_HOME_ID,
    intent: createZeroIntent(),
    input: createInputSource(),
    match: {
      phase: 'KICKOFF',
      scoreHome: 0,
      scoreAway: 0,
      clockSec: 0,
      half: 1,
      phaseTimer: MATCH.kickoffBeatSec,
      kickoffTeam: 0,
    },
    rng: createRng(seed),
    events: [],
    pendingHitstopFrames: 0,
    switchCooldown: 0,
    chaser: [-1, -1],
  };

  initialSeeds.set(world, seed);

  return world;
}

export function resetWorld(world: World, seed?: number): void {
  applyInitialState(world, seed ?? initialSeeds.get(world) ?? 0);
}
