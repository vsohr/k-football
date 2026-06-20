import type { World } from './world';
import { actionSystem } from './systems/action';
import { ballSystem } from './systems/ball';
import { inputSystem } from './systems/input';
import { movementSystem } from './systems/movement';
import { switchSystem } from './systems/switch';

export function simulate(world: World, dt: number): void {
  inputSystem(world);
  switchSystem(world);
  movementSystem(world, dt);
  ballSystem(world, dt);
  actionSystem(world, dt);
  world.tick += 1;
}
