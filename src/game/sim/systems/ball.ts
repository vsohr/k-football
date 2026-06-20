import { BALL_RADIUS, PITCH } from '../../config/dimensions';
import type { World } from '../world';

export function ballSystem(world: World, dt: number): void {
  const { ball } = world;
  const minX = -PITCH.halfX + BALL_RADIUS;
  const maxX = PITCH.halfX - BALL_RADIUS;
  const minZ = -PITCH.halfZ + BALL_RADIUS;
  const maxZ = PITCH.halfZ - BALL_RADIUS;

  ball.prevPos.x = ball.pos.x;
  ball.prevPos.y = ball.pos.y;
  ball.prevPos.z = ball.pos.z;

  ball.pos.x += ball.vel.x * dt;
  ball.pos.y = 0;
  ball.pos.z += ball.vel.z * dt;
  ball.vel.y = 0;

  if (ball.pos.x < minX) {
    ball.pos.x = minX;
    ball.vel.x = -ball.vel.x;
  } else if (ball.pos.x > maxX) {
    ball.pos.x = maxX;
    ball.vel.x = -ball.vel.x;
  }

  if (ball.pos.z < minZ) {
    ball.pos.z = minZ;
    ball.vel.z = -ball.vel.z;
  } else if (ball.pos.z > maxZ) {
    ball.pos.z = maxZ;
    ball.vel.z = -ball.vel.z;
  }
}
