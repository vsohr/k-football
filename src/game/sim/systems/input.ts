import { sampleIntent } from '../../input/source';
import type { World } from '../world';

export function inputSystem(world: World): void {
  world.intent = sampleIntent(world.input);
}
