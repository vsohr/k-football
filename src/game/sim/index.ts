import type { World } from './world';

const BOUNDARY_MIN = -20;
const BOUNDARY_MAX = 20;

export function simulate(world: World, dt: number): void {
  const { ball } = world;

  ball.prevPos.x = ball.pos.x;
  ball.prevPos.y = ball.pos.y;
  ball.prevPos.z = ball.pos.z;

  ball.pos.x += ball.vel.x * dt;
  ball.pos.y = 0;
  ball.pos.z += ball.vel.z * dt;
  ball.vel.y = 0;

  if (ball.pos.x < BOUNDARY_MIN) {
    ball.pos.x = BOUNDARY_MIN;
    ball.vel.x = -ball.vel.x;
  } else if (ball.pos.x > BOUNDARY_MAX) {
    ball.pos.x = BOUNDARY_MAX;
    ball.vel.x = -ball.vel.x;
  }

  if (ball.pos.z < BOUNDARY_MIN) {
    ball.pos.z = BOUNDARY_MIN;
    ball.vel.z = -ball.vel.z;
  } else if (ball.pos.z > BOUNDARY_MAX) {
    ball.pos.z = BOUNDARY_MAX;
    ball.vel.z = -ball.vel.z;
  }

  world.tick += 1;
}
