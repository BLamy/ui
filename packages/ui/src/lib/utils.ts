import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { COLOR_TOKENS, TEXT_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS, SPACING_TOKENS, FONT_TOKENS } from '@/lib/tokens.generated';

/* tailwind-merge only knows Tailwind's default theme; register ours (generated from tokens.css by
   tools/tokens/build.mjs) so `text-muted-foreground` resolves as a color and `text-footnote` as a size — a conflict
   between two colors collapses, a color and a size don't. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [...COLOR_TOKENS],
      text: [...TEXT_TOKENS],
      radius: [...RADIUS_TOKENS],
      shadow: [...SHADOW_TOKENS],
      spacing: [...SPACING_TOKENS],
      font: [...FONT_TOKENS],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
/** @deprecated Legacy iOS curve. New motion uses the spring tokens (lib/motion.ts `springs`, CSS `--ease-spring-*`). */
export const EASE = 'cubic-bezier(.32,.72,0,1)';
export const BARH = 52;

/** Pressables: no tap flash, the host font, and a brightness nudge on hover (dimmer on light surfaces, brighter on
    dark ones — the terminal scope is dark in both appearances). */
export const pressable =
  '[-webkit-tap-highlight-color:transparent] [font-family:inherit] hover:brightness-[.97] dark:hover:brightness-[1.12]';

/** A brand tile: the accent into iOS indigo (#5E5CE6, a fixed brand color). */
export const brandTile = 'bg-[linear-gradient(135deg,var(--primary),#5E5CE6)]';
