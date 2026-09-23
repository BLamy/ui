import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* ══ Skeleton — loading placeholder ══ */
export const skeletonVariants = cva('block animate-pulse bg-bl-fill2', {
  variants: {
    shape: {
      default: 'rounded-[10px]',
      text: 'h-3.5 rounded-full',
      circle: 'rounded-full',
    },
  },
  defaultVariants: { shape: 'default' },
});

export interface SkeletonProps extends ComponentProps<'div'>, VariantProps<typeof skeletonVariants> {}

export function Skeleton({ className, shape, ...props }: SkeletonProps) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn(skeletonVariants({ shape }), className)} {...props} />;
}
