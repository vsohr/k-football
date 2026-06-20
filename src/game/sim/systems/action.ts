import { FEEL, shootHitstopFrames } from '../../config/feel';
import { BALL, DRIBBLE } from '../../config/pace';
import { consumeAction } from '../../input/source';
import type { World } from '../world';

export function actionSystem(world: World, _dt: number): void {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined || world.ball.owner !== player.id || !world.intent.shoot) {
    return;
  }

  const power = 1;
  const dirX = Math.sin(player.facing);
  const dirZ = Math.cos(player.facing);

  world.ball.pendingImpulse = {
    x: dirX * BALL.shotSpeed * power,
    y: 0,
    z: dirZ * BALL.shotSpeed * power,
  };
  world.ball.owner = null;
  world.ball.cooldown = DRIBBLE.shotCooldownTicks;
  world.pendingHitstopFrames = shootHitstopFrames(power);
  world.events.push({
    type: FEEL.shoot.sfx,
    tick: world.tick,
    power,
    at: { ...world.ball.pos },
  });
  consumeAction(world.input, 'shoot');
}
