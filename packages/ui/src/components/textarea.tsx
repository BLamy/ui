'use client';
import type { ComponentProps } from 'react';
import { Textarea as SdkTextarea } from '@ui-sdk/react/textarea';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cx } from '@/lib/utils';

/* ══ Textarea — UI SDK's Textarea, the multi-line sibling of Input ══
   A native <textarea> with Input's `value` / `onValueChange(value, details)` and `controller`. `autoResize` grows
   it with its text between its CSS min and max height; `submitShortcut` ("enter" or "mod+enter") submits its form,
   or calls `onSubmit(value)`. */
export const textareaVariants = cva(
  [
    'box-border block w-full min-w-0 resize-none rounded-ctl border-0 bg-input px-3 py-2.5 [font-family:inherit] text-body leading-[22px] text-foreground outline-none',
    'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground',
    'focus:bg-transparent focus:shadow-[inset_0_0_0_1.5px_var(--primary)]',
    'aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50',
    selectableText,
  ],
  {
    variants: {
      size: {
        default: 'min-h-24',
        sm: 'min-h-16 text-subhead leading-[20px]',
        lg: 'min-h-36',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type TextareaProps = ComponentProps<typeof SdkTextarea> & VariantProps<typeof textareaVariants>;

export function Textarea({ className, size, ...props }: TextareaProps) {
  return <SdkTextarea className={cx(textareaVariants({ size }), className)} {...props} />;
}
