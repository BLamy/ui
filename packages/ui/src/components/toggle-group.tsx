'use client';
import { createContext, use, type ComponentProps } from 'react';
import { ToggleGroup as SdkToggleGroup } from '@ui-sdk/react/toggle';
import { createParts } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { selectionIndicator } from '@/lib/selection-indicator-primitive';
import { Toggle, type ToggleProps, toggleVariants } from '@/components/ui/toggle';
import { segmentIndicator } from '@/components/ui/segmented';

/* ══ ToggleGroup — UI SDK's ToggleGroup: toggles that share one value, one tab stop, arrow keys between them ══
   `value` / `defaultValue` / `onValueChange(value, details)`, where the value is the array of pressed items'
   values. One at a time unless `multiple`; `deselectable={false}` keeps one pressed once any is.

   <ToggleGroup variant="filled" aria-label="View" defaultValue={['grid']} deselectable={false}>
     <ToggleGroupItem value="list">List</ToggleGroupItem>
     <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
   </ToggleGroup>

   Items take the group's variant and size. In a `filled` group that presses one at a time, the pressed card is
   one element that slides between items. */
export const toggleGroupVariants = cva('relative isolate inline-flex w-fit items-center', {
  variants: {
    variant: {
      default: 'gap-1',
      filled: 'gap-0.5 rounded-[11px] bg-secondary p-0.5',
      /** Joined buttons sharing a hairline frame. */
      outline: 'gap-0 overflow-hidden rounded-ctl shadow-hairline',
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
          v === 'outline' && 'rounded-none shadow-none not-first:shadow-[inset_1px_0_0_var(--border)] data-pressed:shadow-none data-pressed:not-first:shadow-[inset_1px_0_0_var(--border)]',
        ],
        className,
      )}
      {...props}
    />
  );
}

export { createToggleGroupController } from '@ui-sdk/react/toggle';
