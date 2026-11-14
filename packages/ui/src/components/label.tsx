'use client';
import type { ComponentProps } from 'react';
import { Label as SdkLabel } from '@ui-sdk/react/label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';

/* ══ Label — UI SDK's Label: a native <label> that names any control ══
   Point `htmlFor` at the control's `id`, or wrap the control. It names what a plain <label> can't reach (a radio
   group, a slider, a checkbox group), and a press on it checks, focuses or clicks the control as a native label
   would. Inside a Field use FieldLabel, which also ties the field's description and errors to the control.

   <Label variant="control"><Checkbox />Remember me</Label>
   <Label htmlFor="plan" variant="field">Plan</Label> <RadioGroup id="plan">…</RadioGroup> */
export const labelVariants = cva('inline-flex items-center group-data-disabled:opacity-50', {
  variants: {
    variant: {
      default: 'gap-1.5 text-subhead font-medium text-foreground',
      /** iOS grouped-form header: small, secondary, sits above a field. */
      field: 'gap-1.5 px-1 text-footnote font-medium text-muted-foreground',
      /** A checkbox, radio or switch and its text, wrapped together: the whole line presses the control, and
          dims with it when it is disabled. */
      control: 'cursor-pointer gap-3 text-body text-foreground has-data-disabled:cursor-default has-data-disabled:text-foreground/40',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type LabelProps = ComponentProps<typeof SdkLabel> & VariantProps<typeof labelVariants>;

export function Label({ className, variant, ...props }: LabelProps) {
  return <SdkLabel className={cx(labelVariants({ variant }), className)} {...props} />;
}
