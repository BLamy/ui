import { cn } from '../utils';

export { cn };

/** Workbench pressables: no tap flash, the host font, and a brightness nudge on hover (dimmer on light surfaces,
    brighter on dark ones — the terminal scope is dark in both appearances). */
export const wbPress =
  '[-webkit-tap-highlight-color:transparent] [font-family:inherit] hover:brightness-[.97] dark:hover:brightness-[1.12]';
