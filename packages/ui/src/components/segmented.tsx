'use client';
import { createContext, use, type ComponentProps } from 'react';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';

/* ══ The segment track ══
   One tray, one segment and one sliding card, shared by Segmented, Tabs `variant="segmented"` and ToggleGroup
   `variant="filled"`, so the three are pixel-alike at the same `size`. The track's height is Button's for the size
   (32 / 36 / 44), the segments are 4px shorter (the track's 2px padding), and the card's radius is the track's
   minus that padding, so the corners stay concentric. Each component adds its own display (`flex` or
   `inline-flex`) and its selected-state attribute does the rest: `data-checked` (Segmented), `data-selected`
   (Tabs), `data-pressed` (ToggleGroup). */

/** The tray: a tinted, padded row (a column with `data-orientation="vertical"`). It is `relative isolate`, so the
    card can sit behind the labels. Add `flex` or `inline-flex`. */
export const segmentTrackVariants = cva(
  'group/segments relative isolate gap-0.5 bg-secondary p-0.5 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
  {
    variants: {
      size: {
        sm: 'rounded-lg',
        default: 'rounded-ctl',
        lg: 'rounded-xl',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

/** One segment: a label-sized button that shares the track's width with its siblings. Medium at rest, semibold
    when selected. On a touch screen its hit area reaches 44px tall. */
export const segmentItemVariants = cva(
  [
    'bl-btn relative box-border flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent [font-family:inherit] font-medium whitespace-nowrap text-foreground outline-none [&_svg]:shrink-0',
    'data-checked:font-semibold data-selected:font-semibold data-pressed:font-semibold',
    // Stacked, each segment keeps its height instead of sharing the track's.
    'group-data-[orientation=vertical]/segments:flex-none',
    // The solid ring of every control, without the offset: the neighbours are 2px away.
    'focus-visible:ring-2 focus-visible:ring-ring',
    'pointer-coarse:group-data-[orientation=horizontal]/segments:after:absolute pointer-coarse:group-data-[orientation=horizontal]/segments:after:inset-x-0',
    'data-disabled:cursor-default not-in-data-disabled:data-disabled:opacity-40',
  ],
  {
    variants: {
      size: {
        sm: 'h-7 px-2.5 text-footnote leading-[inherit] rounded-[calc(var(--radius-lg)-2px)] pointer-coarse:after:-inset-y-2',
        default: 'h-8 px-3 text-subhead leading-[inherit] rounded-[calc(var(--radius-ctl)-2px)] pointer-coarse:after:-inset-y-1.5',
        lg: 'h-10 px-3.5 text-body leading-[inherit] rounded-[calc(var(--radius-xl)-2px)] pointer-coarse:after:-inset-y-0.5',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

/** The selected card's look: its fill (`bg-segment`, a raised gray in dark), shadow and radius. Segmented and
    ToggleGroup slide it with `segmentIndicatorSlide`; Tabs places it inside its own sliding frame; a ToggleGroup
    that presses several at once puts it on each pressed item. */
export const segmentIndicatorVariants = cva('bg-segment shadow-[0_1px_4px_black] shadow-black/14', {
  variants: {
    size: {
      sm: 'rounded-[calc(var(--radius-lg)-2px)]',
      default: 'rounded-[calc(var(--radius-ctl)-2px)]',
      lg: 'rounded-[calc(var(--radius-xl)-2px)]',
    },
  },
  defaultVariants: { size: 'default' },
});

/** How the card moves: behind the labels, sliding and resizing on the smooth spring (still under reduced motion).
    Add the box the indicator part measures (`top-(--…-top) left-(--…-left) h-(--…-height) w-(--…-width)`). */
export const segmentIndicatorSlide =
  'absolute -z-1 transition-[top,left,width,height] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none';

export type SegmentSize = NonNullable<VariantProps<typeof segmentTrackVariants>['size']>;

/* ══ Segmented — the iOS segmented control, on UI SDK's SegmentedControl ══
   A radio group drawn as a row of buttons: one value, one tab stop, arrows move and select. `value` /
   `defaultValue` / `onValueChange(value, details)`; name it with `aria-label` or a Label.

   <Segmented aria-label="View" value={view} onValueChange={setView}>
     <SegmentedItem value="list">List</SegmentedItem>
     <SegmentedItem value="grid">Grid</SegmentedItem>
   </Segmented>

   The selected card is one element (UI SDK's indicator part, rendered by the root) that slides and resizes to
   the checked segment on the smooth spring. */
const SegmentedSizeContext = createContext<SegmentSize>('default');

export type SegmentedProps<T extends string = string> = ComponentProps<typeof SegmentedControl<T>> & {
  /** `sm` 32px, `default` 36px, `lg` 44px tall: Button's heights, so a control lines up with the buttons beside it. */
  size?: SegmentSize;
};

export function Segmented<T extends string = string>({ className, children, size = 'default', ...props }: SegmentedProps<T>) {
  const indicator = (
    <SegmentedControlIndicator
      className={cn(
        segmentIndicatorSlide,
        segmentIndicatorVariants({ size }),
        'top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width)',
      )}
    />
  );
  return (
    <SegmentedSizeContext value={size}>
      <SegmentedControl<T>
        data-size={size}
        className={cx(cn('flex', segmentTrackVariants({ size }), 'data-disabled:opacity-40'), className)}
        {...props}
      >
        {typeof children === 'function' ? (state) => <>{indicator}{children(state)}</> : <>{indicator}{children}</>}
      </SegmentedControl>
    </SegmentedSizeContext>
  );
}

export type SegmentedItemProps = ComponentProps<typeof SegmentedControlItem>;

/** One segment: a button with the `radio` role (and the hidden native radio a form submits). It takes the
    control's `size`. */
export function SegmentedItem({ className, ...props }: SegmentedItemProps) {
  const size = use(SegmentedSizeContext);
  return <SegmentedControlItem className={cx(segmentItemVariants({ size }), className)} {...props} />;
}

export { createSegmentedControlController } from '@ui-sdk/react/segmented-control';
