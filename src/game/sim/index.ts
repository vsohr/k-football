import type { World } from './world';
import { actionSystem } from './systems/action';
import { aiSystem } from './systems/ai';
import { ballSystem } from './systems/ball';
import { inputSystem } from './systems/input';
import { keeperSystem } from './systems/keeper';
import { matchSystem } from './systems/match';
import { movementSystem } from './systems/movement';
import { switchSystem } from './systems/switch';

export function simulate(world: World, dt: number): void {
  inputSystem(world);
  matchSystem(world, dt);

  if (world.match.phase === 'PLAYING') {
    switchSystem(world);
    movementSystem(world, dt);
    keeperSystem(world, dt);
    ballSystem(world, dt);
    aiSystem(world, dt);
    actionSystem(world, dt);
  }

  world.tick += 1;
}
