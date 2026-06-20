import type { Player, World } from '../world';

const SWITCH_COOLDOWN_TICKS = 18;

function findPlayer(world: World, id: number): Player | undefined {
  return world.players.find((player) => player.id === id);
}

function horizontalDistanceSquared(player: Player, world: World): number {
  const dx = player.pos.x - world.ball.pos.x;
  const dz = player.pos.z - world.ball.pos.z;

  return dx * dx + dz * dz;
}

function nearestHomeOutfieldToBall(world: World): Player | undefined {
  let nearest: Player | undefined;
  let nearestDistanceSquared = Infinity;

  for (const player of world.players) {
    if (player.team !== 0 || player.role === 'GK') {
      continue;
    }

    const distanceSquared = horizontalDistanceSquared(player, world);

    if (distanceSquared < nearestDistanceSquared) {
      nearest = player;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}

function updateControlFlags(world: World): void {
  for (const player of world.players) {
    player.control = player.id === world.controlledId ? 'human' : 'ai';
  }
}

export function switchSystem(world: World): void {
  world.switchCooldown = Math.max(0, world.switchCooldown - 1);

  const owner = world.ball.owner === null ? undefined : findPlayer(world, world.ball.owner);

  if (owner?.team === 0 && owner.role !== 'GK') {
    world.controlledId = owner.id;
    world.switchCooldown = 0;
    updateControlFlags(world);
    return;
  }

  if (owner?.team === 0 && owner.role === 'GK') {
    const nextControlled = nearestHomeOutfieldToBall(world);

    if (nextControlled !== undefined) {
      world.controlledId = nextControlled.id;
    }

    world.switchCooldown = 0;
    updateControlFlags(world);
    return;
  }

  if (world.switchCooldown === 0) {
    const nextControlled = nearestHomeOutfieldToBall(world);

    if (nextControlled !== undefined && nextControlled.id !== world.controlledId) {
      world.controlledId = nextControlled.id;
      world.switchCooldown = SWITCH_COOLDOWN_TICKS;
    }
  }

  updateControlFlags(world);
}
