'use client';
import type { ComponentProps } from 'react';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { coarseHitArea, pressableFocusRing } from '@/lib/primitives';
import { TextMorph } from '@/components/ui/text-morph';

/** The filled looks brighten a little under a pointer (dimmer on light surfaces, brighter on dark ones). */
const filledHover = 'hover:not-data-disabled:brightness-[.95] dark:hover:not-data-disabled:brightness-[1.12]';

/* ══ Button — UI SDK's Button with the kit's variants ══
   UI SDK owns the behavior: `onClick` (return a Promise and the button is pending until it settles), `disabled`,
   `focusableWhenDisabled`, and `render` for a link. Variants are cva. A press sinks the button a little on the
   snappy spring (not while it is an open popup's trigger); a plain-text label morphs into the next one
   (TextMorph), so "Continue" → "Confirm" slides the shared letters and the button springs to its new width.
   A button that stays pressed is a Toggle (`variant="quiet"` is the same toolbar look with `aria-pressed`).

   Two text-only looks: `plain` is the iOS bar button ("Cancel", "Edit": the size's height and padding, tint text, no
   fill), `link` is a link in running text (the line's own size and weight, no height or padding, underlined on
   hover; `size` does not apply to it). */
export const buttonVariants = cva(
  [
    'bl-btn box-border inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap [&_svg]:shrink-0',
    'transition-[scale,background-color,opacity,filter] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none',
    pressableFocusRing,
    // Pending dims a little (not as far as disabled), so the wait shows without a pointer; a spinner is yours to add.
    'data-disabled:cursor-default data-disabled:opacity-40 data-pending:cursor-progress data-pending:opacity-70',
  ],
  {
    variants: {
      variant: {
        default: ['bg-primary text-primary-foreground', filledHover],
        secondary: ['bg-secondary text-secondary-foreground', filledHover],
        /** A hairline frame on the surface: the quieter partner of `default` and `secondary`. */
        outline: 'bg-transparent text-foreground shadow-hairline hover:not-data-disabled:bg-accent',
        /** Dark on light, light on dark: the "Sign in with …" look. */
        contrast: ['bg-foreground text-background', filledHover],
        ghost: 'bg-transparent text-foreground hover:not-data-disabled:bg-accent',
        /** Borderless and muted until hovered: the toolbar and row-action look. */
        quiet: 'bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary hover:not-data-disabled:text-foreground',
        destructive: ['bg-destructive text-destructive-foreground', filledHover],
        /** The iOS bar button: tint text, no fill, the size's height and padding; it dims while hovered and pressed. */
        plain: 'bg-transparent text-primary hover:not-data-disabled:opacity-70 active:not-data-disabled:opacity-50',
        /** A link in running text: the line's size, weight and height, `--link`, underlined while hovered. */
        link: 'bg-transparent text-link no-underline underline-offset-4 hover:not-data-disabled:underline active:not-data-disabled:opacity-60',
      },
      size: {
        sm: 'h-8 rounded-lg px-3 text-footnote font-semibold',
        default: 'h-9 rounded-ctl px-4 text-subhead font-semibold',
        lg: 'h-11 rounded-xl px-5 text-callout font-semibold',
        /** The full-width iOS action pill (the 44px `lg` height, the card radius). */
        pill: 'h-11 w-full rounded-card px-4 text-callout font-semibold',
        /** The 28px toolbar tool: a rounded square for a 12–18px glyph. On a touch screen its hit area reaches 44px. */
        'icon-sm': ['relative size-7 rounded-lg p-0', coarseHitArea],
        /** A 36px round icon button, the height of `default`. */
        icon: 'size-9 rounded-full p-0',
        /** A 44px round icon button, the height of `lg` and of a touch target. */
        'icon-lg': 'size-11 rounded-full p-0',
      },
    },
    compoundVariants: [
      // A link takes the line it sits in: whatever `size` says, no box of its own.
      {
        variant: 'link',
        className: 'h-auto w-auto rounded-sm p-0 text-[length:inherit] font-[weight:inherit] whitespace-normal active:not-aria-expanded:not-data-disabled:scale-100',
      },
    ],
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
