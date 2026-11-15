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

/** The field's focus line: a 1.5px inset primary ring while anything inside has focus. Shared with the controls that
 *  keep a fill of their own (SearchInput's pill). */
export const fieldFocusRing = 'focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)]';

const surface = [
  'box-border min-w-0 rounded-ctl border-0 bg-input px-3 [font-family:inherit] text-foreground outline-none',
  'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
  'focus-within:bg-transparent', fieldFocusRing,
  'aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]',
  'data-disabled:cursor-not-allowed data-disabled:opacity-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
];
const fieldSizes = {
  sm: 'h-8 text-subhead',
  default: 'h-11 text-body',
  lg: 'h-[50px] rounded-xl text-body',
};

/** The kit's filled field box, shared by every text-shaped control (Input, Textarea, SearchInput, FilterInput, the
 *  date and color inputs, the select and combobox triggers): the input fill, the control radius, the field heights
 *  (32 / 44 / 50: taller than buttons' 32 / 36 / 44 on purpose, as iOS text fields are), a 1.5px inset primary ring
 *  while anything inside has focus, a destructive ring while invalid (`aria-invalid` on a control, `data-invalid` on
 *  a group, both written by its Field), and the disabled dim. Put it on the control itself, or on a group around one
 *  (an `InputGroup`, a segmented date input): focus and invalid read from inside either way. A multi-line control
 *  replaces the height with its own (`h-auto min-h-…`). */
export const fieldSurfaceVariants = cva([surface, 'flex items-center gap-2'], {
  variants: { size: fieldSizes },
  defaultVariants: { size: 'default' },
});

/** Input's classes: the field surface on the <input> itself, with the placeholder color and selectable text. */
export const inputVariants = cva([surface, 'block w-full placeholder:text-tertiary-foreground', selectableText], {
  variants: { size: fieldSizes },
  defaultVariants: { size: 'default' },
});

export type InputProps = Omit<ComponentProps<typeof SdkInput>, 'size'> & VariantProps<typeof inputVariants>;

export function Input({ className, size, ...props }: InputProps) {
  return <SdkInput className={cx(inputVariants({ size }), className)} {...props} />;
}

export { createInputController, type InputController } from '@ui-sdk/react/input';
