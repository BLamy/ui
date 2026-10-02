import type { ComponentProps, CSSProperties } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* ══ Skeleton — loading placeholder. A soft highlight sweeps across it (left to right, the reading direction)
   instead of the whole block pulsing; reduced motion gets a still block. Size it with classes or `width` /
   `height`; `shape` picks the corners. SkeletonText stacks text lines with a shorter last line. Placeholders are
   aria-hidden — mark the region that is loading with role="group", aria-busy and a label instead. ══ */
export const skeletonVariants = cva(
  'block bg-secondary-strong [background-image:linear-gradient(90deg,transparent_25%,color-mix(in_oklab,var(--card)_55%,transparent)_50%,transparent_75%)] [background-size:200%_100%] [background-position:150%_0] [background-repeat:no-repeat] animate-bl-shimmer motion-reduce:animate-none',
  {
    variants: {
      shape: {
        /** 10px corners — cards, buttons, blocks. */
        default: 'rounded-ctl',
        /** Same as default, named for symmetry with `rect`. */
        rounded: 'rounded-ctl',
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
  /** Height of each bar in px (default the `text` shape's 14). */
  lineHeight?: number;
  /** Extra classes for each bar. */
  lineClassName?: string;
  /** Gap between lines in px (default 8). */
  gap?: number;
}

/** A paragraph placeholder: `lines` text bars, the last one shorter. */
export function SkeletonText({ lines = 3, lastLineWidth = '60%', lineHeight, lineClassName, gap = 8, className, style, ...props }: SkeletonTextProps) {
  return (
    <div data-slot="skeleton-text" aria-hidden="true" className={cn('flex w-full flex-col', className)}
      style={{ gap, ...style } as CSSProperties} {...props}>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <Skeleton key={i} shape="text" className={lineClassName}
          height={lineHeight} width={i === lines - 1 && lines > 1 ? lastLineWidth : undefined} />
      ))}
    </div>
  );
}
