import {
  Checkbox as AriaCheckbox, type CheckboxProps as AriaCheckboxProps,
  CheckboxGroup as AriaCheckboxGroup, type CheckboxGroupProps as AriaCheckboxGroupProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { cn } from '../lib/utils';

/* ══ Checkbox — react-aria's Checkbox. Round by default (iOS selection circle), square like shadcn on request.
   One selection tick per change. ══ */
export const checkboxVariants = cva(
  [
    'box-border grid size-[22px] shrink-0 place-items-center border-[1.5px] border-bl-label3 text-white',
    'transition-[background-color,border-color,transform] duration-200 ease-ios',
    'group-data-selected:border-primary group-data-selected:bg-primary',
    'group-data-indeterminate:border-primary group-data-indeterminate:bg-primary',
    'group-data-pressed:scale-90 group-data-focus-visible:ring-[3px] group-data-focus-visible:ring-ring/45',
    'group-data-invalid:border-destructive group-data-invalid:group-data-selected:bg-destructive',
  ],
  {
    variants: {
      shape: {
        circle: 'rounded-full',
        square: 'rounded-[6px]',
      },
    },
    defaultVariants: { shape: 'circle' },
  },
);

export interface CheckboxProps extends AriaCheckboxProps, VariantProps<typeof checkboxVariants> {}

export function Checkbox({ className, shape, children, onChange, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox
      data-slot="checkbox"
      onChange={(v) => { Haptics.selection(); onChange?.(v); }}
      className={composeRenderProps(className, (cls) =>
        cn('group relative inline-flex cursor-pointer items-center gap-3 text-[17px] text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40', cls))}
      {...props}
    >
      {composeRenderProps(children, (kids, { isSelected, isIndeterminate }) => (
        <>
          <span data-slot="checkbox-indicator" className={checkboxVariants({ shape })}>
            {isIndeterminate ? (
              <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" strokeWidth={3} strokeLinecap="round" /></svg>
            ) : isSelected ? (
              <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true"><path d="M5.5 12.6l4.3 4.3 8.7-9.3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : null}
          </span>
          {kids}
        </>
      ))}
    </AriaCheckbox>
  );
}

export interface CheckboxGroupProps extends AriaCheckboxGroupProps {}

/** Group of checkboxes sharing a value array; put a <Label> first. Each Checkbox ticks its own change. */
export function CheckboxGroup({ className, ...props }: CheckboxGroupProps) {
  return (
    <AriaCheckboxGroup
      data-slot="checkbox-group"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-3', cls))}
      {...props}
    />
  );
}
