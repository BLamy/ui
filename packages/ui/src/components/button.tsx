'use client';
import type { ComponentProps } from 'react';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { TextMorph } from '@/components/ui/text-morph';

/* ══ Button — UI SDK's Button with the kit's variants ══
   UI SDK owns the behavior: `onClick` (return a Promise and the button is pending until it settles), `disabled`,
   `focusableWhenDisabled`, and `render` for a link. Variants are cva. A press sinks the button a little on the
   snappy spring (not while it is an open popup's trigger); a plain-text label morphs into the next one
   (TextMorph), so "Continue" → "Confirm" slides the shared letters and the button springs to its new width. */
export const buttonVariants = cva(
  'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap outline-none transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-40 data-pending:cursor-progress',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        ghost: 'bg-transparent text-foreground hover:not-data-disabled:bg-accent',
        destructive: 'bg-destructive text-white',
        link: 'bg-transparent p-0 text-primary',
        /** Borderless and muted until hovered: the toolbar and row-action look. On a UI SDK Toggle wearing these
            classes, `data-pressed` fills it like `active` does. */
        quiet: 'bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary data-pressed:bg-secondary data-pressed:text-foreground',
      },
      size: {
        default: 'h-9 rounded-ctl px-4 text-subhead font-semibold',
        sm: 'h-8 rounded-lg px-3 text-footnote font-semibold',
        lg: 'h-11 rounded-xl px-5 text-callout font-semibold',
        /** Full-width iOS action pill. */
        pill: 'w-full rounded-card px-3 py-[13px] text-callout font-semibold',
        icon: 'size-9 rounded-full p-0',
        /** A small rounded square that hugs its glyph (padding, not a fixed size, so the glyph size sets it). */
        'icon-sm': 'grid place-items-center rounded-[7px] p-[5px]',
      },
      /** The filled "on" state of a `quiet` button (a toolbar tool that is switched on). */
      active: { true: '', false: '' },
    },
    compoundVariants: [{ variant: 'quiet', active: true, class: 'bg-secondary text-foreground' }],
    defaultVariants: { variant: 'default', size: 'default', active: false },
  },
);

export type ButtonProps = ComponentProps<typeof SdkButton> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, active, children, ...props }: ButtonProps) {
  return (
    <SdkButton className={cx(buttonVariants({ variant, size, active }), className)} {...props}>
      {typeof children === 'string' ? <TextMorph>{children}</TextMorph> : children}
    </SdkButton>
  );
}
