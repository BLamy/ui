'use client';
import { createContext, use, type ComponentProps } from 'react';
import { Toggle as SdkToggle, ToggleGroup as SdkToggleGroup, ToggleIcon as SdkToggleIcon } from '@ui-sdk/react/toggle';
import { createParts } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { pressableFocusRing } from '@/lib/primitives';
import { selectionIndicator } from '@/lib/selection-indicator-primitive';
import { segmentIndicator } from '@/components/ui/segmented';

/* ══ Toggle — UI SDK's Toggle (a button that stays pressed) with the kit's variants ══
   `pressed` / `defaultPressed` / `onPressedChange(pressed, details)`, `disabled`, and a controller from
   `createToggleController()` to press it from elsewhere. It is a button with `aria-pressed`: for an action use
   Button, for an on/off setting in a form use Switch or Checkbox.

   <Toggle aria-label="Bold"><Icon name="bold" /></Toggle>                                        // tinted while on
   <Toggle variant="quiet" size="icon-sm" aria-label="Bookmark"><Icon name="bookmark" /></Toggle>  // the toolbar tool

   ToggleGroup (below) is toggles that share one value; its items take the group's variant and size. */
export const toggleVariants = cva(
  [
    'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap [&_svg]:shrink-0',
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
        lg: 'h-11 min-w-11 rounded-xl px-3.5 text-body',
        /** Button's icon sizes, so a toggle sits in a row of icon buttons: 28px square, 36px and 44px round. */
        'icon-sm': 'size-7 rounded-lg p-0',
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

   <ToggleGroup variant="filled" aria-label="View" defaultValue={['grid']} deselectable={false}>
     <ToggleGroupItem value="list">List</ToggleGroupItem>
     <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
   </ToggleGroup>

   Items take the group's variant and size. `filled` is a tray; in one that presses one at a time, the pressed card
   is one element that slides between items. `outline` joins the items in one hairline frame. */
export const toggleGroupVariants = cva('relative isolate inline-flex w-fit items-center', {
  variants: {
    variant: {
      default: 'gap-1',
      quiet: 'gap-1',
      filled: 'gap-0.5 rounded-[11px] bg-secondary p-0.5',
      /** Joined items sharing a hairline frame. */
      outline: 'gap-0 rounded-ctl shadow-hairline',
    },
  },
  defaultVariants: { variant: 'default' },
});

type ToggleGroupStyle = VariantProps<typeof toggleVariants>;
const ToggleGroupContext = createContext<ToggleGroupStyle & { single?: boolean }>({});

const { Root: ToggleGroupIndicator } = createParts(selectionIndicator, { root: 'span' });

export type ToggleGroupProps<T extends string = string> = ComponentProps<typeof SdkToggleGroup<T>> & ToggleGroupStyle;

export function ToggleGroup<T extends string = string>({ className, variant, size, children, ...props }: ToggleGroupProps<T>) {
  const single = !props.multiple;
  const indicator = variant === 'filled' && single ? (
    <ToggleGroupIndicator
      className={cx(
        segmentIndicator,
        'top-(--selection-indicator-top) left-(--selection-indicator-left) h-(--selection-indicator-height) w-(--selection-indicator-width) rounded-[9px]',
      )}
    />
  ) : null;
  return (
    <ToggleGroupContext value={{ variant, size, single }}>
      <SdkToggleGroup<T>
        data-variant={variant ?? 'default'}
        className={cx(toggleGroupVariants({ variant }), className)}
        {...props}
      >
        {typeof children === 'function' ? (state) => <>{indicator}{children(state)}</> : <>{indicator}{children}</>}
      </SdkToggleGroup>
    </ToggleGroupContext>
  );
}

export type ToggleGroupItemProps = ToggleProps;

/** A Toggle in the group. Its `value` is what the group's value lists while it is pressed. */
export function ToggleGroupItem({ className, variant, size, ...props }: ToggleGroupItemProps) {
  const group = use(ToggleGroupContext);
  const v = variant ?? group.variant;
  return (
    <Toggle
      variant={v === 'filled' ? 'default' : v}
      size={size ?? group.size}
      className={cx(
        [
          v === 'filled' && (group.single
            // The sliding card draws the pressed state.
            ? 'relative rounded-[9px] data-pressed:bg-transparent data-pressed:text-foreground data-pressed:active:not-data-disabled:bg-transparent'
            : 'rounded-[9px] data-pressed:bg-card data-pressed:text-foreground data-pressed:shadow-[0_1px_4px_black] data-pressed:shadow-black/14 data-pressed:active:not-data-disabled:bg-card'),
          // Joined: square inner corners, a hairline between neighbours, and the focus ring drawn inside the frame.
          v === 'outline' && [
            'rounded-none shadow-none not-first:shadow-[inset_1px_0_0_var(--border)] data-pressed:shadow-none data-pressed:not-first:shadow-[inset_1px_0_0_var(--border)]',
            'first:rounded-s-ctl last:rounded-e-ctl focus-visible:z-10 focus-visible:ring-offset-0 focus-visible:ring-inset',
          ],
        ],
        className,
      )}
      {...props}
    />
  );
}

export { createToggleController, createToggleGroupController } from '@ui-sdk/react/toggle';
