'use client';
import type { ComponentProps } from 'react';
import {
  Radio as SdkRadio, RadioGroup as SdkRadioGroup, RadioIndicator as SdkRadioIndicator,
} from '@ui-sdk/react/radio';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';
import { pressableFocusRing } from '@/lib/primitives';

/* ══ RadioGroup — round radios on UI SDK's RadioGroup (one tab stop; arrows move and select) ══
   `value` / `defaultValue` / `onValueChange(value, details)`, `disabled`, `readOnly`, `required`, and `name` to
   submit with a form. Each Radio is the circle (a button with the `radio` role); wrap it and its text in a Label:

   <RadioGroup aria-label="Billing" defaultValue="monthly">
     <Label variant="control"><Radio value="monthly" />Monthly</Label>
     <Label variant="control"><Radio value="yearly" />Yearly</Label>
   </RadioGroup>

   For the iOS segmented look use <Segmented>. */
export const radioGroupVariants = cva('group/radio-group flex', {
  variants: {
    /** How the radios are laid out. Arrow keys on both axes move between them either way. */
    orientation: {
      vertical: 'flex-col gap-3',
      horizontal: 'flex-row flex-wrap gap-5',
    },
  },
  defaultVariants: { orientation: 'vertical' },
});

export type RadioGroupProps<T extends string = string> = ComponentProps<typeof SdkRadioGroup<T>> & VariantProps<typeof radioGroupVariants>;

export function RadioGroup<T extends string = string>({ className, orientation, ...props }: RadioGroupProps<T>) {
  return (
    <SdkRadioGroup<T>
      data-orientation={orientation ?? 'vertical'}
      className={cx(radioGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

/** The circle. Checked, its border thickens to a ring around the dot (the RadioIndicator fills what is left).
    A recipe with no variants: the radio has one look. */
export const radioVariants = cva(
  [
    'box-border grid size-[22px] shrink-0 cursor-pointer rounded-full border-[1.5px] border-control-border bg-transparent p-0',
    'transition-[border-width,border-color,scale] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
    'data-checked:border-[7px] data-checked:border-primary',
    'active:not-data-disabled:scale-90',
    pressableFocusRing,
    // Invalid: the radio itself (`aria-invalid`, which a Field writes on its control) or the group around it.
    'aria-invalid:border-destructive group-aria-invalid/radio-group:border-destructive',
    'data-disabled:cursor-default data-disabled:opacity-40',
  ],
);

export type RadioProps = ComponentProps<typeof SdkRadio>;

export function Radio({ className, children, ...props }: RadioProps) {
  return (
    <SdkRadio className={cx(radioVariants(), className)} {...props}>
      {children ?? <RadioIndicator />}
    </SdkRadio>
  );
}

/** The dot inside the checked radio. */
export function RadioIndicator({ className, ...props }: ComponentProps<typeof SdkRadioIndicator>) {
  return <SdkRadioIndicator className={cx('block size-full rounded-full bg-primary-foreground', className)} {...props} />;
}

export { createRadioGroupController } from '@ui-sdk/react/radio';
