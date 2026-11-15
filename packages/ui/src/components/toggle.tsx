'use client';
import { createContext, use, type ComponentProps } from 'react';
import { Toggle as SdkToggle, ToggleGroup as SdkToggleGroup, ToggleIcon as SdkToggleIcon } from '@ui-sdk/react/toggle';
import { createParts } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';
import { coarseHitArea, pressableFocusRing } from '@/lib/primitives';
import { selectionIndicator } from '@/lib/selection-indicator-primitive';
import {
  segmentIndicatorSlide, segmentIndicatorVariants, segmentItemVariants, segmentTrackVariants, type SegmentSize,
} from '@/components/ui/segmented';

/* ══ Toggle — UI SDK's Toggle (a button that stays pressed) with the kit's variants ══
   `pressed` / `defaultPressed` / `onPressedChange(pressed, details)`, `disabled`, and a controller from
   `createToggleController()` to press it from elsewhere. It is a button with `aria-pressed`: for an action use
   Button, for an on/off setting in a form use Switch or Checkbox.

   <Toggle aria-label="Bold"><Icon name="bold" /></Toggle>                                        // tinted while on
   <Toggle variant="quiet" size="icon-sm" aria-label="Bookmark"><Icon name="bookmark" /></Toggle>  // the toolbar tool

   ToggleGroup (below) is toggles that share one value; its items take the group's variant and size. */
export const toggleVariants = cva(
  [
    'bl-btn box-border inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap [&_svg]:shrink-0',
    'transition-[background-color,color,box-shadow,scale] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none',
    pressableFocusRing,
    'data-disabled:cursor-default data-disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        /** Transparent at rest, tinted while on: the iOS toolbar toggle. */
        default: [
          'bg-transparent text-foreground hover:not-data-disabled:bg-accent active:not-data-disabled:bg-secondary-strong',
          'data-pressed:bg-primary/15 data-pressed:text-primary data-pressed:active:not-data-disabled:bg-primary/25',
        ],
        /** Filled at rest, for toggles standing alone on a card. */
        filled: [
          'bg-secondary text-foreground hover:not-data-disabled:bg-accent active:not-data-disabled:bg-secondary-strong',
          'data-pressed:bg-primary/15 data-pressed:text-primary data-pressed:active:not-data-disabled:bg-primary/25',
        ],
        /** A hairline frame, tinted while on. */
        outline: [
          'bg-transparent text-foreground shadow-hairline hover:not-data-disabled:bg-accent active:not-data-disabled:bg-secondary-strong',
          'data-pressed:bg-primary/15 data-pressed:text-primary data-pressed:shadow-none data-pressed:active:not-data-disabled:bg-primary/25',
        ],
        /** Muted until hovered, a grey fill while on: Button's `quiet` toolbar look, with a pressed state. */
        quiet: [
          'bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary hover:not-data-disabled:text-foreground',
          'data-pressed:bg-secondary data-pressed:text-foreground active:not-data-disabled:bg-secondary-strong',
        ],
      },
      size: {
        sm: 'h-8 min-w-8 rounded-lg px-2 text-footnote',
        default: 'h-9 min-w-9 rounded-ctl px-2.5 text-subhead',
        lg: 'h-11 min-w-11 rounded-xl px-3.5 text-callout',
        /** Button's icon sizes, so a toggle sits in a row of icon buttons: 28px square (a 44px hit area on a touch
            screen), 36px and 44px round. */
        'icon-sm': ['relative size-7 rounded-lg p-0', coarseHitArea],
        icon: 'size-9 rounded-full p-0',
        'icon-lg': 'size-11 rounded-full p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ToggleVariant = NonNullable<VariantProps<typeof toggleVariants>['variant']>;
export type ToggleSize = NonNullable<VariantProps<typeof toggleVariants>['size']>;

export type ToggleProps = ComponentProps<typeof SdkToggle> & VariantProps<typeof toggleVariants>;

export function Toggle({ className, variant, size, ...props }: ToggleProps) {
  return <SdkToggle className={cx(toggleVariants({ variant, size }), className)} {...props} />;
}

/** An icon inside a toggle: hidden from screen readers (the toggle's text or `aria-label` names it), and
    `mirror` flips it in right-to-left text. */
export function ToggleIcon({ className, ...props }: ComponentProps<typeof SdkToggleIcon>) {
  return <SdkToggleIcon className={cx('inline-flex shrink-0', className)} {...props} />;
}

/* ══ ToggleGroup — UI SDK's ToggleGroup: toggles that share one value, one tab stop, arrow keys between them ══
   `value` / `defaultValue` / `onValueChange(value, details)`, where the value is the array of pressed items'
   values. One at a time unless `multiple`; `deselectable={false}` keeps one pressed once any is. Arrow keys only
   move focus: for one required choice where arrows select, use Segmented; for a choice in a form, RadioGroup.

   <ToggleGroup variant="segmented" aria-label="View" defaultValue={['grid']} deselectable={false}>
     <ToggleGroupItem value="list">List</ToggleGroupItem>
     <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
   </ToggleGroup>

   The group's `variant` is a Toggle variant (each item is that toggle, a little apart from the next) or one of two
   group looks: `segmented` is Segmented's track (the same tray, segments and card at the same `size`, spelled as
   on Tabs; in a group that presses one at a time the card is one element that slides between items), and `outline`
   joins the items in one hairline frame. `orientation="vertical"` stacks the items in every look. */
export const toggleGroupVariants = cva(
  'group/toggle-group relative isolate inline-flex w-fit items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
  {
    variants: {
      variant: {
        default: 'gap-1',
        filled: 'gap-1',
        quiet: 'gap-1',
        /** Joined items sharing a hairline frame. */
        outline: 'gap-0 rounded-ctl shadow-hairline',
        /** Segmented's track (`segmentTrackVariants`, sized by the group's `size`). */
        segmented: '',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type ToggleGroupVariant = NonNullable<VariantProps<typeof toggleGroupVariants>['variant']>;

type ToggleGroupStyle = { variant?: ToggleGroupVariant | null; size?: ToggleSize | null };
const ToggleGroupContext = createContext<ToggleGroupStyle & { single?: boolean }>({});

const { Root: ToggleGroupIndicator } = createParts(selectionIndicator, { root: 'span' });

export type ToggleGroupProps<T extends string = string> = ComponentProps<typeof SdkToggleGroup<T>> & ToggleGroupStyle;

/** A toggle size as a segment size: the icon sizes are square segments of the same height. */
const SEGMENT_SIZE: Record<ToggleSize, SegmentSize> = {
  sm: 'sm', default: 'default', lg: 'lg', 'icon-sm': 'sm', icon: 'default', 'icon-lg': 'lg',
};

export function ToggleGroup<T extends string = string>({ className, variant, size, children, ...props }: ToggleGroupProps<T>) {
  const single = !props.multiple;
  const segmented = variant === 'segmented';
  const segment = SEGMENT_SIZE[size ?? 'default'];
  const indicator = segmented && single ? (
    <ToggleGroupIndicator
      className={cn(
        segmentIndicatorSlide,
        segmentIndicatorVariants({ size: segment }),
        'top-(--selection-indicator-top) left-(--selection-indicator-left) h-(--selection-indicator-height) w-(--selection-indicator-width)',
      )}
    />
  ) : null;
  return (
    <ToggleGroupContext value={{ variant, size, single }}>
      <SdkToggleGroup<T>
        data-variant={variant ?? 'default'}
        className={cx(cn(toggleGroupVariants({ variant }), segmented && segmentTrackVariants({ size: segment })), className)}
        {...props}
      >
        {typeof children === 'function' ? (state) => <>{indicator}{children(state)}</> : <>{indicator}{children}</>}
      </SdkToggleGroup>
    </ToggleGroupContext>
  );
}

export type ToggleGroupItemProps = ToggleProps;

/** A Toggle in the group. Its `value` is what the group's value lists while it is pressed. It takes the group's
    `variant` and `size`; its own `variant` picks another Toggle look for this item (not in a `segmented` group,
    whose items are all segments). In a `segmented` group it is a segment (`segmentItemVariants`): when several
    can be pressed, each pressed one wears the card. */
export function ToggleGroupItem({ className, variant, size, ...props }: ToggleGroupItemProps) {
  const group = use(ToggleGroupContext);
  const s = size ?? group.size ?? 'default';
  if (group.variant === 'segmented') {
    const segment = SEGMENT_SIZE[s];
    const base = cn(segmentItemVariants({ size: segment }), s.startsWith('icon') && 'aspect-square flex-none px-0');
    const card = segmentIndicatorVariants({ size: segment });
    return (
      <SdkToggle
        className={(state) => cn(base, !group.single && state.pressed && card, typeof className === 'function' ? className(state) : className)}
        {...props}
      />
    );
  }
  const joined = group.variant === 'outline';
  const v = variant ?? group.variant ?? 'default';
  return (
    <Toggle
      variant={v}
      size={s}
      className={cx(
        // Joined: square inner corners, a hairline between neighbours (beside them in a row, above them in a
        // column), and the focus ring drawn inside the frame.
        joined && [
          'rounded-none shadow-none data-pressed:shadow-none focus-visible:z-10 focus-visible:ring-offset-0 focus-visible:ring-inset',
          'not-data-[orientation=vertical]:first:rounded-s-ctl not-data-[orientation=vertical]:last:rounded-e-ctl',
          'not-data-[orientation=vertical]:not-first:shadow-[inset_1px_0_0_var(--border)] not-data-[orientation=vertical]:data-pressed:not-first:shadow-[inset_1px_0_0_var(--border)]',
          'data-[orientation=vertical]:first:rounded-t-ctl data-[orientation=vertical]:last:rounded-b-ctl',
          'data-[orientation=vertical]:not-first:shadow-hairline-t data-[orientation=vertical]:data-pressed:not-first:shadow-hairline-t',
        ],
        className,
      )}
      {...props}
    />
  );
}

export { createToggleController, createToggleGroupController } from '@ui-sdk/react/toggle';
