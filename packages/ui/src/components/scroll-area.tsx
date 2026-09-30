import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ══ ScrollArea — overflow container with the kit's thin .bl-scroll scrollbars ══
   Native scrolling (momentum, overscroll) is kept; only the scrollbar is styled. */
export const scrollAreaVariants = cva('bl-scroll relative min-h-0 overscroll-contain outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45', {
  variants: {
    orientation: {
      vertical: 'overflow-x-hidden overflow-y-auto',
      horizontal: 'overflow-x-auto overflow-y-hidden',
      both: 'overflow-auto',
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

export interface ScrollAreaProps extends ComponentProps<'div'>, VariantProps<typeof scrollAreaVariants> {}

export function ScrollArea({ className, orientation, ...props }: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      data-orientation={orientation ?? 'vertical'}
      // Scrollable regions must be keyboard reachable.
      tabIndex={0}
      className={cn(scrollAreaVariants({ orientation }), className)}
      {...props}
    />
  );
}
