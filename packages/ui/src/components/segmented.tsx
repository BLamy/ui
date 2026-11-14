'use client';
import type { ComponentProps } from 'react';
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from '@ui-sdk/react/segmented-control';
import { cx } from '@/lib/utils';

/** The sliding selected card, shared by Segmented, Tabs and ToggleGroup: its look and its move. It sits behind
    the labels (the group is `relative isolate`); each component adds the box its indicator part measures
    (`top-(--…-top) left-(--…-left) h-(--…-height) w-(--…-width)`) and a radius. The size transitions with the
    position, so the card resizes between unequal items. */
export const segmentIndicator =
  'absolute -z-1 bg-segment shadow-[0_1px_4px_black] shadow-black/14 transition-[top,left,width,height] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none';

/* ══ Segmented — the iOS segmented control, on UI SDK's SegmentedControl ══
   A radio group drawn as a row of buttons: one value, one tab stop, arrows move and select. `value` /
   `defaultValue` / `onValueChange(value, details)`; name it with `aria-label` or a Label.

   <Segmented aria-label="View" value={view} onValueChange={setView}>
     <SegmentedItem value="list">List</SegmentedItem>
     <SegmentedItem value="grid">Grid</SegmentedItem>
   </Segmented>

   The selected card is one element (UI SDK's indicator part, rendered by the root) that slides and resizes to
   the checked segment on the smooth spring. */
export type SegmentedProps<T extends string = string> = ComponentProps<typeof SegmentedControl<T>>;

export function Segmented<T extends string = string>({ className, children, ...props }: SegmentedProps<T>) {
  const indicator = (
    <SegmentedControlIndicator
      className={cx(
        segmentIndicator,
        'top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-[7px]',
      )}
    />
  );
  return (
    <SegmentedControl<T>
      className={cx(
        'relative isolate flex gap-0.5 rounded-[9px] bg-secondary p-0.5 data-[orientation=vertical]:flex-col data-disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {typeof children === 'function' ? (state) => <>{indicator}{children(state)}</> : <>{indicator}{children}</>}
    </SegmentedControl>
  );
}

export type SegmentedItemProps = ComponentProps<typeof SegmentedControlItem>;

/** One segment: a button with the `radio` role (and the hidden native radio a form submits). */
export function SegmentedItem({ className, ...props }: SegmentedItemProps) {
  return (
    <SegmentedControlItem
      className={cx(
        'bl-btn relative flex flex-1 cursor-pointer items-center justify-center rounded-[7px] border-0 bg-transparent px-3 py-[5px] [font-family:inherit] text-footnote leading-[inherit] font-semibold whitespace-nowrap text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-disabled:cursor-default not-in-data-disabled:data-disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

export { createSegmentedControlController } from '@ui-sdk/react/segmented-control';
