import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* ══ Skeleton — loading placeholder. A soft highlight sweeps across it (left to right, the reading direction)
   instead of the whole block pulsing; reduced motion gets a still block. ══ */
export const skeletonVariants = cva(
  'block bg-bl-fill2 [background-image:linear-gradient(90deg,transparent_25%,color-mix(in_oklab,var(--bl-card)_55%,transparent)_50%,transparent_75%)] [background-size:200%_100%] [background-position:150%_0] [background-repeat:no-repeat] animate-bl-shimmer motion-reduce:animate-none',
  {
    variants: {
      shape: {
        default: 'rounded-[10px]',
        text: 'h-3.5 rounded-full',
        circle: 'rounded-full',
      },
    },
    defaultVariants: { shape: 'default' },
  },
);

export interface SkeletonProps extends ComponentProps<'div'>, VariantProps<typeof skeletonVariants> {}

export function Skeleton({ className, shape, ...props }: SkeletonProps) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn(skeletonVariants({ shape }), className)} {...props} />;
}
