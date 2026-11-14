'use client';
import type { ComponentProps } from 'react';
import { Toggle as SdkToggle, ToggleIcon as SdkToggleIcon } from '@ui-sdk/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';

/* ══ Toggle — UI SDK's Toggle (a button that stays pressed) with the kit's variants ══
   `pressed` / `defaultPressed` / `onPressedChange(pressed, details)`, `disabled`, and a controller from
   `createToggleController()` to press it from elsewhere. On = tinted, like an iOS toolbar toggle. Inside a
   ToggleGroup use ToggleGroupItem, which takes the group's variant and size. */
export const toggleVariants = cva(
  [
    'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-1.5 border-0 [font-family:inherit] font-semibold whitespace-nowrap text-foreground outline-none',
    'transition-[background-color,color,box-shadow,scale] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.96] motion-reduce:transition-none [&_svg]:shrink-0',
    'hover:not-data-disabled:bg-accent active:not-data-disabled:bg-secondary-strong',
    'data-pressed:bg-primary/15 data-pressed:text-primary data-pressed:active:not-data-disabled:bg-primary/25',
    'focus-visible:ring-[3px] focus-visible:ring-ring/45 data-disabled:cursor-default data-disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        /** Filled resting state, for toggles standing alone on a card. */
        filled: 'bg-secondary',
        outline: 'bg-transparent shadow-hairline data-pressed:shadow-[inset_0_0_0_1px_transparent]',
      },
      size: {
        sm: 'h-8 min-w-8 rounded-lg px-2 text-footnote',
        default: 'h-9 min-w-9 rounded-ctl px-2.5 text-subhead',
        lg: 'h-11 min-w-11 rounded-xl px-3.5 text-body',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ToggleProps = ComponentProps<typeof SdkToggle> & VariantProps<typeof toggleVariants>;

export function Toggle({ className, variant, size, ...props }: ToggleProps) {
  return <SdkToggle className={cx(toggleVariants({ variant, size }), className)} {...props} />;
}

/** An icon inside a toggle: hidden from screen readers (the toggle's text or `aria-label` names it), and
    `mirror` flips it in right-to-left text. */
export function ToggleIcon({ className, ...props }: ComponentProps<typeof SdkToggleIcon>) {
  return <SdkToggleIcon className={cx('inline-flex shrink-0', className)} {...props} />;
}

export { createToggleController } from '@ui-sdk/react/toggle';
