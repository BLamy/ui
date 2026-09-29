import type { IconShape } from '../icon';

/** Icon geometry merged in from the former workbench icon set (2.0: one `Icon`). Canonical kebab-case names. */
export const WORKBENCH_SHAPES = {} as const satisfies Record<string, readonly IconShape[]>;
