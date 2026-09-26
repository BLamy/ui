import { Button as AriaButton, type ButtonProps as AriaButtonProps, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import type { JSX } from 'react';
import { cn } from '../lib/utils';
import { TextMorph } from './text-morph';

/* ══ Button — shadcn's button on react-aria's Button ══
   Press, hover, and focus-visible come from react-aria as data attributes; variants are cva. A press sinks the
   button a little on the snappy spring (not while it is an open overlay's trigger — react-aria keeps those
   `data-pressed` for as long as the overlay is open); a plain-text label morphs into the next one (TextMorph), so
   "Continue" → "Confirm" slides the shared letters and the button springs to its new width. */
export const buttonVariants = cva(
  'bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap outline-none transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy data-pressed:not-aria-expanded:scale-[.97] motion-reduce:transition-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-40',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        ghost: 'bg-transparent text-foreground data-hovered:bg-accent',
        destructive: 'bg-destructive text-white',
        link: 'bg-transparent p-0 text-primary',
      },
      size: {
        default: 'h-9 rounded-[10px] px-4 text-[15px] font-semibold',
        sm: 'h-8 rounded-lg px-3 text-[13px] font-semibold',
        lg: 'h-11 rounded-xl px-5 text-[16px] font-semibold',
        /** Full-width iOS action pill. */
        pill: 'w-full rounded-[14px] px-3 py-[13px] text-[16px] font-semibold',
        icon: 'size-9 rounded-full p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends Omit<AriaButtonProps, 'render'>, VariantProps<typeof buttonVariants> {
  /** Tooltip — react-aria's Button drops `title`, so it is rendered onto the <button> here. */
  title?: string;
}

export function Button({ className, variant, size, title, children, ...props }: ButtonProps) {
  return (
    <AriaButton
      data-slot="button"
      className={composeRenderProps(className, (cls) => cn(buttonVariants({ variant, size }), cls))}
      {...props}
      children={typeof children === 'string' ? <TextMorph>{children}</TextMorph> : children}
      {...(title ? { render: (p: JSX.IntrinsicElements['button']) => <button {...p} title={title} /> } : {})}
    />
  );
}
