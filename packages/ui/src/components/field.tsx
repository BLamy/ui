'use client';
import type { ComponentProps } from 'react';
import {
  Field as SdkField,
  FieldDescription as SdkFieldDescription,
  FieldError as SdkFieldError,
  FieldGroup as SdkFieldGroup,
  FieldLabel as SdkFieldLabel,
  FieldLegend as SdkFieldLegend,
  FieldSet as SdkFieldSet,
} from '@ui-sdk/react/field';
import type { VariantProps } from 'class-variance-authority';
import { labelVariants } from '@/components/ui/label';
import { cx } from '@/lib/utils';

/* ══ Field — UI SDK's Field: a control wired to its label, description and error ══
   <Field name="email">
     <FieldLabel variant="field">Email</FieldLabel>
     <Input type="email" required />
     <FieldDescription>We never share it.</FieldDescription>
     <FieldError />
   </Field>
   The control is one of ours (Input, Textarea, Select, Checkbox, Switch, RadioGroup…) and keeps its own value and
   constraints; the field gives it `name`, `disabled` and `invalid`. Native constraints show after a submit attempt;
   `invalid` shows an error your code decides. FieldSet groups fields under an iOS-style section header:
   <FieldSet>
     <FieldLegend>Account</FieldLegend>
     <Field>…</Field>
     <FieldDescription>You can change these later.</FieldDescription>
   </FieldSet> */
export function Field({ className, ...props }: ComponentProps<typeof SdkField>) {
  return <SdkField className={cx('group flex flex-col gap-1.5', className)} {...props} />;
}

export type FieldLabelProps = ComponentProps<typeof SdkFieldLabel> & VariantProps<typeof labelVariants>;

/** The field's label, in Label's variants: `default`, or `field` for the small grouped-form caption. */
export function FieldLabel({ className, variant, ...props }: FieldLabelProps) {
  return <SdkFieldLabel className={cx(labelVariants({ variant }), className)} {...props} />;
}

/** Help text, announced with the control. Right inside a FieldSet it describes the set. */
export function FieldDescription({ className, ...props }: ComponentProps<typeof SdkFieldDescription>) {
  return <SdkFieldDescription className={cx('m-0 px-1 text-footnote leading-[18px] text-muted-foreground', className)} {...props} />;
}

/** Shows while the field is invalid: the browser's message, or its children. `match` picks the problem it is for. */
export function FieldError({ className, ...props }: ComponentProps<typeof SdkFieldError>) {
  return <SdkFieldError className={cx('px-1 text-footnote leading-[18px] text-destructive', className)} {...props} />;
}

/** A native <fieldset>: names its fields with its legend, and `disabled` disables them together. */
export function FieldSet({ className, ...props }: ComponentProps<typeof SdkFieldSet>) {
  return <SdkFieldSet className={cx('m-0 flex min-w-0 flex-col gap-3 border-0 p-0', className)} {...props} />;
}

/** The set's uppercase section header. Keep it the set's first child. */
export function FieldLegend({ className, ...props }: ComponentProps<typeof SdkFieldLegend>) {
  return (
    <SdkFieldLegend
      className={cx('mb-2 p-0 px-1 text-footnote leading-[18px] font-normal tracking-[.02em] text-muted-foreground uppercase', className)}
      {...props}
    />
  );
}

/** Stacks fields. It has no role: a FieldSet is what names and disables a group. */
export function FieldGroup({ className, ...props }: ComponentProps<typeof SdkFieldGroup>) {
  return <SdkFieldGroup className={cx('flex min-w-0 flex-col gap-3', className)} {...props} />;
}

export { FieldControl, useFieldControl } from '@ui-sdk/react/field';
