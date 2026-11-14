'use client';
import type { ComponentProps } from 'react';
import {
  Checkbox as SdkCheckbox, CheckboxGroup as SdkCheckboxGroup, CheckboxIndicator as SdkCheckboxIndicator,
} from '@ui-sdk/react/checkbox';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';

/* ══ Checkbox — UI SDK's Checkbox. Round by default (the iOS selection circle), square like shadcn on request ══
   `checked` / `defaultChecked` / `onCheckedChange(checked, details)`, where checked is `true`, `false` or
   `'indeterminate'`; `disabled`, `readOnly`, `required`, and `name` / `value` to submit with a form. The root is
   the box (a button with the `checkbox` role); with no children it renders its `CheckboxIndicator`, the tick that
   draws itself on. Wrap it and its text in a Label, or pass `aria-label`:

   <Label variant="control"><Checkbox defaultChecked />Remember me</Label>

   CheckboxGroup keeps one list of checked values (`value` / `defaultValue` / `onValueChange`); each Checkbox in it
   gives its `value`, and one with `parent` checks or clears them all. */
export const checkboxVariants = cva(
  [
    'box-border grid size-[22px] shrink-0 cursor-pointer place-items-center border-[1.5px] border-tertiary-foreground bg-transparent p-0 text-white outline-none',
    'transition-[background-color,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
    'data-checked:border-primary data-checked:bg-primary',
    'data-indeterminate:border-primary data-indeterminate:bg-primary',
    'active:not-data-disabled:scale-90 focus-visible:ring-[3px] focus-visible:ring-ring/45',
    // Invalid: the box itself (`aria-invalid`, which a Field writes on its control) or the group around it.
    'aria-invalid:border-destructive group-aria-invalid:border-destructive',
    'aria-invalid:data-checked:border-destructive aria-invalid:data-checked:bg-destructive group-aria-invalid:data-checked:border-destructive group-aria-invalid:data-checked:bg-destructive',
    'data-disabled:cursor-default data-disabled:opacity-40',
  ],
  {
    variants: {
      shape: {
        circle: 'rounded-full',
        square: 'rounded-md',
      },
    },
    defaultVariants: { shape: 'circle' },
  },
);

export type CheckboxProps = ComponentProps<typeof SdkCheckbox> & VariantProps<typeof checkboxVariants>;

export function Checkbox({ className, shape, children, ...props }: CheckboxProps) {
  return (
    <SdkCheckbox className={cx(checkboxVariants({ shape }), className)} {...props}>
      {children ?? <CheckboxIndicator />}
    </SdkCheckbox>
  );
}

export type CheckboxIndicatorProps = ComponentProps<typeof SdkCheckboxIndicator>;

/** The mark inside the box: a tick, or a dash while indeterminate. It stays mounted, so the tick draws itself on
    (stroke-dashoffset) and off, and the dash morphs from and to the tick's middle. Children replace the mark. */
export function CheckboxIndicator({ className, children, keepMounted = true, ...props }: CheckboxIndicatorProps) {
  return (
    <SdkCheckboxIndicator keepMounted={keepMounted} className={cx('grid place-items-center', className)} {...props}>
      {children ?? ((state) => (
        <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true">
          <path d={state.indeterminate ? 'M6 12h12' : 'M5.5 12.6l4.3 4.3 8.7-9.3'} pathLength={1} fill="none" stroke="currentColor" strokeWidth={3}
            strokeLinecap="round" strokeLinejoin="round"
            className={cn(
              '[stroke-dasharray:1] transition-[stroke-dashoffset,opacity] motion-reduce:transition-none',
              state.checked || state.indeterminate
                ? '[stroke-dashoffset:0] opacity-100 duration-spring-smooth ease-spring-smooth'
                : '[stroke-dashoffset:1] opacity-0 duration-exit ease-exit',
            )} />
        </svg>
      ))}
    </SdkCheckboxIndicator>
  );
}

export type CheckboxGroupProps<T extends string = string> = ComponentProps<typeof SdkCheckboxGroup<T>>;

/** Checkboxes that share one list of checked values. Name it with `aria-label`, or a Label whose `htmlFor` is
    the group's `id`. */
export function CheckboxGroup<T extends string = string>({ className, ...props }: CheckboxGroupProps<T>) {
  return <SdkCheckboxGroup<T> className={cx('group flex flex-col gap-3', className)} {...props} />;
}

export { createCheckboxController, createCheckboxGroupController } from '@ui-sdk/react/checkbox';
