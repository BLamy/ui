'use client';
import { createContext, useContext, useMemo, type ComponentProps } from 'react';
import {
  Toolbar as SdkToolbar,
  ToolbarButton as SdkToolbarButton,
  ToolbarGroup as SdkToolbarGroup,
  ToolbarSeparator as SdkToolbarSeparator,
} from '@ui-sdk/react/toolbar';
import { cva, type VariantProps } from 'class-variance-authority';
import { buttonVariants, type ButtonSize, type ButtonVariant } from '@/components/ui/button';
import { barSurface, pressableFocusRing } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';

/* ══ Toolbar — UI SDK's Toolbar with the kit's looks ══
   UI SDK owns the behavior: one tab stop, the arrow keys (Home, End) between the items, a disabled item that stays
   reachable with `aria-disabled`, toggles and menu triggers joining the order. The kit adds three looks:
   - `plain`: no surface; the row sits in whatever holds it (a header, a pane's top edge, a player's controls).
   - `floating`: a raised card over content (a canvas's tools, a message's hover actions).
   - `bar`: the iOS bottom bar (`barSurface`): text actions in the tint, a status in the middle.
   `size` sets the default size of every ToolbarButton inside; a button can still take its own. */

export type ToolbarVariant = 'plain' | 'floating' | 'bar';
export type ToolbarSize = 'sm' | 'default' | 'lg';
/** The semantic color of a ToolbarButton (DECISIONS §3: `tone`). */
export type ToolbarTone = 'default' | 'success' | 'warning' | 'destructive';

export const toolbarVariants = cva(
  'box-border flex min-w-0 items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
  {
    variants: {
      variant: {
        plain: '',
        floating: 'w-fit bg-popover p-1 text-popover-foreground shadow-popover',
        bar: cn(barSurface, 'w-full shrink-0 justify-between px-2'),
      },
      size: {
        sm: 'gap-0.5',
        default: 'gap-1',
        lg: 'gap-2',
      },
    },
    compoundVariants: [
      // The card's corner is its buttons' corner plus the 4px padding, so the two curves stay concentric.
      { variant: 'floating', size: 'sm', className: 'rounded-panel' },
      { variant: 'floating', size: 'default', className: 'rounded-card' },
      { variant: 'floating', size: 'lg', className: 'rounded-2xl' },
    ],
    defaultVariants: { variant: 'plain', size: 'default' },
  },
);

interface ToolbarContextValue {
  variant: ToolbarVariant;
  size: ToolbarSize;
}
const ToolbarContext = createContext<ToolbarContextValue>({ variant: 'plain', size: 'default' });

/** The look and size of the Toolbar around a part (`plain`/`default` outside one). */
export function useToolbar(): ToolbarContextValue {
  return useContext(ToolbarContext);
}

export type ToolbarProps = ComponentProps<typeof SdkToolbar> &
  VariantProps<typeof toolbarVariants> & {
    /** `bar` only: the edge the bar sits on, which puts its hairline on the side facing the content. Default `bottom`. */
    side?: 'top' | 'bottom';
  };

/** The row (or column, `orientation="vertical"`). Name it with `aria-label`. */
export function Toolbar({ variant = 'plain', size = 'default', side = 'bottom', className, ...props }: ToolbarProps) {
  const v = variant ?? 'plain';
  const s = size ?? 'default';
  const value = useMemo(() => ({ variant: v, size: s }), [v, s]);
  return (
    <ToolbarContext.Provider value={value}>
      <SdkToolbar
        data-variant={v}
        data-size={s}
        data-side={v === 'bar' ? side : undefined}
        className={cx(toolbarVariants({ variant: v, size: s }), className)}
        {...props}
      />
    </ToolbarContext.Provider>
  );
}

/** A `bar` toolbar's text action: the tint on the bar, 44px tall, grey (not faded) while it is unavailable. */
const barButton = [
  'bl-btn box-border inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-ctl border-0 bg-transparent px-2 [font-family:inherit] text-body whitespace-nowrap text-primary [&_svg]:shrink-0',
  'transition-opacity duration-spring-snappy ease-spring-snappy active:not-data-disabled:opacity-50 motion-reduce:transition-none',
  pressableFocusRing,
  'data-disabled:cursor-default data-disabled:text-tertiary-foreground',
].join(' ');

// A tone colors an available tool only: an unavailable one goes grey like any other, never a faded tint.
const tones: Record<ToolbarTone, string> = {
  default: '',
  success: 'not-data-disabled:text-success hover:not-data-disabled:text-success',
  warning: 'not-data-disabled:text-warning hover:not-data-disabled:text-warning',
  destructive: 'not-data-disabled:text-destructive hover:not-data-disabled:text-destructive',
};

/** An unavailable tool with no fill of its own: grey at full opacity, as in the `bar` look, not Button's fade.
 *  Filled looks (`default`, `secondary`, `destructive`, `contrast`) keep Button's dimmed fill. */
const unfilledDisabled = 'data-disabled:text-tertiary-foreground data-disabled:opacity-100';
const UNFILLED: ReadonlySet<ButtonVariant> = new Set<ButtonVariant>(['quiet', 'ghost', 'plain', 'outline', 'link']);

/** Icon tools are rounded squares in a toolbar, not Button's circles. */
const iconCorners: Partial<Record<ButtonSize, string>> = { icon: 'rounded-ctl', 'icon-lg': 'rounded-xl' };

/** The classes of a ToolbarButton, for a part rendered through it (`render={<MenuTrigger />}` keeps them). */
export function toolbarButtonVariants({
  toolbar = 'plain',
  variant,
  size = 'default',
  tone = 'default',
}: {
  toolbar?: ToolbarVariant;
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ToolbarTone;
} = {}): string {
  // In a bar, a button with no look of its own is the bar's text action.
  const look = variant ?? 'quiet';
  const base = toolbar === 'bar' && !variant ? barButton : cn(buttonVariants({ variant: look, size }), iconCorners[size], UNFILLED.has(look) && unfilledDisabled);
  return cn(base, tones[tone]);
}

export type ToolbarButtonProps = ComponentProps<typeof SdkToolbarButton> & {
  /** Button's looks. Default: `quiet` (in a `bar` toolbar: the bar's tinted text action). */
  variant?: ButtonVariant;
  /** Button's sizes. Default: the Toolbar's `size`. Icon-only tools take `icon-sm` (28px), `icon` (36px) or `icon-lg` (44px). */
  size?: ButtonSize;
  /** `destructive` for Delete, `success` / `warning` for a status-colored action. Default `default`. */
  tone?: ToolbarTone;
};

/** A button in the toolbar. Give an icon-only one an `aria-label`. */
export function ToolbarButton({ variant, size, tone = 'default', className, ...props }: ToolbarButtonProps) {
  const toolbar = useToolbar();
  return (
    <SdkToolbarButton
      className={cx(toolbarButtonVariants({ toolbar: toolbar.variant, variant, size: size ?? toolbar.size, tone }), className)}
      {...props}
    />
  );
}

export type ToolbarGroupProps = ComponentProps<typeof SdkToolbarGroup>;

/** Related items under one name (`aria-label`); `disabled` disables them together. Lays them out with the toolbar's gap. */
export function ToolbarGroup({ className, ...props }: ToolbarGroupProps) {
  return <SdkToolbarGroup className={cx('flex items-center gap-[inherit] in-data-[orientation=vertical]:flex-col', className)} {...props} />;
}

export type ToolbarSeparatorProps = ComponentProps<typeof SdkToolbarSeparator>;

/** A line between groups of items; it runs across the toolbar (`data-orientation` is the line's own direction). */
export function ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps) {
  return (
    <SdkToolbarSeparator
      className={cx(
        'shrink-0 bg-border data-[orientation=vertical]:mx-1 data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch data-[orientation=vertical]:my-1 data-[orientation=horizontal]:mx-1 data-[orientation=horizontal]:my-1 data-[orientation=horizontal]:h-px',
        className,
      )}
      {...props}
    />
  );
}

export type ToolbarTextProps = ComponentProps<'span'>;

/** Text in the row that isn't a control: a count, a time, a zoom level. Not a tab stop. In a `bar` it takes the
    room between the actions, centered. A status that changes after an action ("2 selected") should be announced:
    give it `aria-live="polite"`. */
export function ToolbarText({ className, ...props }: ToolbarTextProps) {
  const { variant } = useToolbar();
  return (
    <span
      data-slot="toolbar-text"
      className={cn(
        'min-w-0 truncate px-1 text-footnote text-muted-foreground tabular-nums',
        variant === 'bar' && 'flex-1 text-center',
        className,
      )}
      {...props}
    />
  );
}

export { createToolbarController, type ToolbarController } from '@ui-sdk/react/toolbar';
