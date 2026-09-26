import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/* tailwind-merge only knows Tailwind's default palette; register ours so `text-bl-label2` resolves as a color
   (not a font size) and conflicting colors collapse correctly. */
const BL = ['bg', 'bg2', 'card', 'card2', 'label', 'label2', 'label3', 'sep', 'fill', 'fill2', 'press', 'bar', 'stick', 'side', 'scrim', 'tint', 'red', 'green'];
const WB = ['bg', 'side', 'card', 'fill', 'fill2', 'sep', 'label', 'label2', 'label3', 'tint', 'green', 'red'];
const SEMANTIC = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'destructive', 'success',
  'border', 'input', 'ring', 'overlay',
];
const twMerge = extendTailwindMerge({
  extend: { theme: { color: [...SEMANTIC, ...BL.map((c) => 'bl-' + c), ...WB.map((c) => 'wb-' + c)] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
/** @deprecated Legacy iOS curve. New motion uses the spring tokens (lib/motion.ts `springs`, CSS `--ease-spring-*`). */
export const EASE = 'cubic-bezier(.32,.72,0,1)';
export const BARH = 52;
