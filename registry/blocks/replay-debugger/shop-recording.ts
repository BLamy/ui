import type { ReplayCache } from '@/components/ui/replay-debugger';
import data from './recordings/shop.json';

/** A real recording, read once: Node running a small shop script (apps/inspector/demos/node in full-stack-osx-demo),
 *  replayed with Replay's native linker by an extractor kept outside this repository, and written down as JSON: 84 steps
 *  in shop.js, with the frames, scopes and objects at each. */
export const SHOP_RECORDING = data as unknown as ReplayCache;
