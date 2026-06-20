import type { World } from './world';
import { actionSystem } from './systems/action';
import { ballSystem } from './systems/ball';
import { inputSystem } from './systems/input';
import { movementSystem } from './systems/movement';

export function simulate(world: World, dt: number): void {
  inputSystem(world);
  movementSystem(world, dt);
  ballSystem(world, dt);
  actionSystem(world, dt);
  world.tick += 1;
}
