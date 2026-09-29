import { cn } from '../utils';

export { cn };

/** Workbench pressables: no tap flash, the host font, and a brightness nudge on hover (dimmer on light surfaces,
    brighter on dark ones — the terminal scope is dark in both appearances). */
export const wbPress =
  '[-webkit-tap-highlight-color:transparent] [font-family:inherit] hover:brightness-[.97] dark:hover:brightness-[1.12]';

/** The Workbench brand tile: the accent into iOS indigo (#5E5CE6, a fixed brand color). */
export const wbBrandTile = 'bg-[linear-gradient(135deg,var(--primary),#5E5CE6)]';
