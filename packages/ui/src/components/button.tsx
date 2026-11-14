'use client';
import type { ComponentProps } from 'react';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { pressableFocusRing } from '@/lib/primitives';
import { TextMorph } from '@/components/ui/text-morph';

/* ══ Button — UI SDK's Button with the kit's variants ══
   UI SDK owns the behavior: `onClick` (return a Promise and the button is pending until it settles), `disabled`,
   `focusableWhenDisabled`, and `render` for a link. Variants are cva. A press sinks the button a little on the
   snappy spring (not while it is an open popup's trigger); a plain-text label morphs into the next one
   (TextMorph), so "Continue" → "Confirm" slides the shared letters and the button springs to its new width.
   A button that stays pressed is a Toggle (`variant="quiet"` is the same toolbar look with `aria-pressed`). */
export const buttonVariants = cva(
  [
    'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap [&_svg]:shrink-0',
    'transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none',
    pressableFocusRing,
    'data-disabled:cursor-default data-disabled:opacity-40 data-pending:cursor-progress',
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        /** A hairline frame on the surface: the quieter partner of `default` and `secondary`. */
        outline: 'bg-transparent text-foreground shadow-hairline hover:not-data-disabled:bg-accent',
        /** Dark on light, light on dark: the "Sign in with …" look. */
        contrast: 'bg-foreground text-background',
        ghost: 'bg-transparent text-foreground hover:not-data-disabled:bg-accent',
        /** Borderless and muted until hovered: the toolbar and row-action look. */
        quiet: 'bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary hover:not-data-disabled:text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        link: 'bg-transparent p-0 text-primary',
      },
      size: {
        sm: 'h-8 rounded-lg px-3 text-footnote font-semibold',
        default: 'h-9 rounded-ctl px-4 text-subhead font-semibold',
        lg: 'h-11 rounded-xl px-5 text-callout font-semibold',
        /** The full-width iOS action pill (the 44px `lg` height, the card radius). */
        pill: 'h-11 w-full rounded-card px-4 text-callout font-semibold',
        /** The 28px toolbar tool: a rounded square for a 12–18px glyph. */
        'icon-sm': 'size-7 rounded-lg p-0',
        /** A 36px round icon button, the height of `default`. */
        icon: 'size-9 rounded-full p-0',
        /** A 44px round icon button, the height of `lg` and of a touch target. */
        'icon-lg': 'size-11 rounded-full p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

export type ButtonProps = ComponentProps<typeof SdkButton> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, children, ...props }: ButtonProps) {
  return (
    <SdkButton className={cx(buttonVariants({ variant, size }), className)} {...props}>
      {typeof children === 'string' ? <TextMorph>{children}</TextMorph> : children}
    </SdkButton>
  );
}
