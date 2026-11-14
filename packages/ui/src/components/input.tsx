'use client';
import type { ComponentProps } from 'react';
import { Input as SdkInput } from '@ui-sdk/react/input';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cx } from '@/lib/utils';

/* ══ Input — UI SDK's Input as the iOS filled text field ══
   A native <input>: `value` / `defaultValue` / `onValueChange(value, details)` (`details.cancel()` rejects a
   change), a `controller` (`createInputController()`) to write it from outside, and every native attribute.
   Inside a <Field> it takes the field's label, description, error, name and disabled state. */
export const inputVariants = cva(
  [
    'box-border w-full min-w-0 rounded-ctl border-0 bg-input px-3 [font-family:inherit] text-foreground outline-none',
    'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy placeholder:text-tertiary-foreground',
    'focus:bg-transparent focus:shadow-[inset_0_0_0_1.5px_var(--primary)]',
    'aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-not-allowed data-disabled:opacity-50',
    selectableText,
  ],
  {
    variants: {
      size: {
        sm: 'h-8 text-subhead',
        default: 'h-11 text-body',
        lg: 'h-[50px] rounded-xl text-body',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export type InputProps = Omit<ComponentProps<typeof SdkInput>, 'size'> & VariantProps<typeof inputVariants>;

export function Input({ className, size, ...props }: InputProps) {
  return <SdkInput className={cx(inputVariants({ size }), className)} {...props} />;
}

export { createInputController, type InputController } from '@ui-sdk/react/input';
