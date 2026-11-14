'use client';
import type { ComponentProps } from 'react';
import { Textarea as SdkTextarea } from '@ui-sdk/react/textarea';
import { cva, type VariantProps } from 'class-variance-authority';
import { fieldSurfaceVariants } from '@/components/ui/input';
import { selectableText } from '@/lib/primitives';
import { cx } from '@/lib/utils';

/* ══ Textarea — UI SDK's Textarea, the multi-line sibling of Input ══
   A native <textarea> with Input's `value` / `onValueChange(value, details)` and `controller`. `autoResize` grows
   it with its text between its CSS min and max height; `submitShortcut` ("enter" or "mod+enter") submits its form,
   or calls `onSubmit(value)`. The box is Input's field surface (`fieldSurfaceVariants`) with a minimum height in
   place of a fixed one. */
export const textareaVariants = cva(
  ['block h-auto w-full resize-none py-2.5 leading-[22px] placeholder:text-tertiary-foreground', selectableText],
  {
    variants: {
      size: {
        sm: 'min-h-16 text-subhead leading-[20px]',
        default: 'min-h-24 text-body',
        lg: 'min-h-36 text-body',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type TextareaProps = ComponentProps<typeof SdkTextarea> & VariantProps<typeof textareaVariants>;

export function Textarea({ className, size, ...props }: TextareaProps) {
  return <SdkTextarea className={cx([fieldSurfaceVariants({ size }), textareaVariants({ size })], className)} {...props} />;
}
