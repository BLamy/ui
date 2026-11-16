'use client';
import { useState, type ComponentProps } from 'react';
import { Input as SdkInput } from '@ui-sdk/react/input';
import { cva, type VariantProps } from 'class-variance-authority';
import { selectableText } from '@/lib/primitives';
import { cx } from '@/lib/utils';

/* ══ Input — UI SDK's Input as the iOS filled text field ══
   A native <input>: `value` / `defaultValue` / `onValueChange(value, details)` (`details.cancel()` rejects a
   change), a `controller` (`createInputController()`) to write it from outside, and every native attribute.
   Inside a <Field> it takes the field's label, description, error, name and disabled state.

   `onValueCommit(value, details)` is for a field that changes something once you're done with it, not on every key
   (a name in an inspector): the text you type is a draft until Enter or leaving the field commits it, if it changed;
   Escape puts `value` back. A commit that's refused (`value` doesn't change) puts it back too. */

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

/** Why `onValueCommit` ran: Enter, or focus leaving the field. */
export interface InputValueCommitDetails {
  reason: 'enter-key' | 'blur';
  event: Event;
}

export type InputProps = Omit<ComponentProps<typeof SdkInput>, 'size'> & VariantProps<typeof inputVariants> & {
  /** The text, once it's changed and you're done with it: Enter, or leaving the field. Until then it's a draft, and
   *  Escape puts `value` back (and goes no further, so a panel it's in stays open). */
  onValueCommit?: (value: string, details: InputValueCommitDetails) => void;
};

export function Input({ className, size, onValueCommit, ...props }: InputProps) {
  if (onValueCommit) return <CommitInput className={className} size={size} onValueCommit={onValueCommit} {...props} />;
  return <SdkInput className={cx(inputVariants({ size }), className)} {...props} />;
}

/** An Input that holds a draft until it's committed. */
function CommitInput({ className, size, onValueCommit, value: valueProp, defaultValue, onValueChange, onKeyDown, onBlur, ...props }: InputProps & { onValueCommit: NonNullable<InputProps['onValueCommit']> }) {
  const [own, setOwn] = useState(() => String(defaultValue ?? ''));
  const value = valueProp === undefined ? own : String(valueProp);
  // What's typed and not committed; null shows `value`. A new `value` from outside drops the draft.
  const [draft, setDraft] = useState<string | null>(null);
  const [was, setWas] = useState(value);
  if (was !== value) {
    setWas(value);
    setDraft(null);
  }
  const commit = (event: Event, reason: InputValueCommitDetails['reason']) => {
    if (draft === null || draft === value) { setDraft(null); return; }
    if (valueProp === undefined) setOwn(draft);
    setDraft(null);
    onValueCommit(draft, { reason, event });
  };
  return (
    <SdkInput
      className={cx(inputVariants({ size }), className)}
      value={draft ?? value}
      onValueChange={(next, details) => {
        onValueChange?.(next, details);
        if (!details.canceled) setDraft(next);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented || e.nativeEvent.isComposing) return;
        if (e.key === 'Enter') commit(e.nativeEvent, 'enter-key');
        else if (e.key === 'Escape' && draft !== null && draft !== value) {
          setDraft(null);
          e.stopPropagation();
        }
      }}
      onBlur={(e) => {
        onBlur?.(e);
        commit(e.nativeEvent, 'blur');
      }}
      {...props}
    />
  );
}

export { createInputController, type InputController } from '@ui-sdk/react/input';
