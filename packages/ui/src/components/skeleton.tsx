import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ══ Skeleton — loading placeholder. A soft highlight sweeps across it (left to right, the reading direction)
   instead of the whole block pulsing; reduced motion gets a still block. Size it with classes (`h-24 w-full`), or
   `width` / `height` for a size computed at runtime; `shape` picks the corners. SkeletonText stacks text lines with
   a shorter last line; style its bars with `lineClassName` (`h-3`) and its spacing with `className` (`gap-3`). Placeholders are
   aria-hidden — mark the region that is loading with role="group", aria-busy and a label instead. ══ */
export const skeletonVariants = cva(
  'block bg-secondary-strong [background-image:linear-gradient(90deg,transparent_25%,color-mix(in_oklab,var(--card)_55%,transparent)_50%,transparent_75%)] [background-size:200%_100%] [background-position:150%_0] [background-repeat:no-repeat] animate-bl-shimmer motion-reduce:animate-none',
  {
    variants: {
      shape: {
        /** Control corners (`rounded-ctl`) — cards, buttons, blocks. */
        default: 'rounded-ctl',
        /** Near-square corners — media, thumbnails, table cells. */
        rect: 'rounded-[3px]',
        /** One line of body text: 14px tall, fully rounded. */
        text: 'h-3.5 rounded-full',
        /** Avatars and icons; give it equal width and height (`size-10`). */
        circle: 'shrink-0 rounded-full',
      },
    },
    defaultVariants: { shape: 'default' },
  },
);

export interface SkeletonProps extends ComponentProps<'div'>, VariantProps<typeof skeletonVariants> {
  /** Width — a number is px. Classes work too. */
  width?: number | string;
  /** Height — a number is px. Classes work too. */
  height?: number | string;
}

export function Skeleton({ className, shape, width, height, style, ...props }: SkeletonProps) {
  return (
    <div data-slot="skeleton" data-shape={shape ?? 'default'} aria-hidden="true"
      className={cn(skeletonVariants({ shape }), className)}
      style={width != null || height != null ? { width, height, ...style } : style} {...props} />
  );
}

export interface SkeletonTextProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Number of lines (default 3). */
  lines?: number;
  /** Width of the last line, so the block reads as a paragraph (default `60%`; `100%` for a full line). */
  lastLineWidth?: number | string;
  /** Classes for each bar, such as `h-3` for a smaller line (the `text` shape is `h-3.5`). */
  lineClassName?: string;
}

/** A paragraph placeholder: `lines` text bars, the last one shorter. */
export function SkeletonText({ lines = 3, lastLineWidth = '60%', lineClassName, className, ...props }: SkeletonTextProps) {
  return (
    <div data-slot="skeleton-text" aria-hidden="true" className={cn('flex w-full flex-col gap-2', className)} {...props}>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <Skeleton key={i} shape="text" className={lineClassName}
          width={i === lines - 1 && lines > 1 ? lastLineWidth : undefined} />
      ))}
    </div>
  );
}
