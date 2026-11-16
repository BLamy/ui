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
import { Icon } from '@/lib/icon';
import { sectionLabelVariants } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';

/* ══ Field — UI SDK's Field: a control wired to its label, description and error ══
   <Field name="email">
     <FieldLabel>Email</FieldLabel>
     <Input type="email" required />
     <FieldDescription>We never share it.</FieldDescription>
     <FieldError />
   </Field>
   The control is one of ours (Input, Textarea, Select, Checkbox, Switch, RadioGroup…) and keeps its own value and
   constraints; the field gives it `name`, `disabled` and `invalid`. Native constraints show after a submit attempt;
   `invalid` shows an error your code decides. Secondary text (the caption, description and legend) is the foreground
   at 70%, and an error is foreground text after a red icon: `text-muted-foreground` and red text are both below
   WCAG AA on the grouped grey surfaces, and an error is never shown by color alone. A form is a native <form> with
   Fields in it: `<FieldGroup render={<form onSubmit={save} />}>` (see the Forms guide). FieldSet groups fields
   under an iOS-style section header:
   <FieldSet>
     <FieldLegend>Account</FieldLegend>
     <Field>…</Field>
     <FieldDescription>You can change these later.</FieldDescription>
   </FieldSet> */
export type FieldProps = ComponentProps<typeof SdkField>;

export function Field({ className, ...props }: FieldProps) {
  return <SdkField className={cx('group flex flex-col gap-1.5', className)} {...props} />;
}

export type FieldLabelProps = ComponentProps<typeof SdkFieldLabel> & VariantProps<typeof labelVariants>;

/** The field's label, in Label's variants: `field` (the default), the small grouped-form caption over the control,
    or `default` for a body-sized label. */
export function FieldLabel({ className, variant = 'field', ...props }: FieldLabelProps) {
  return <SdkFieldLabel className={cx(labelVariants({ variant }), className)} {...props} />;
}

/** Help text, announced with the control. Right inside a FieldSet it describes the set. */
export function FieldDescription({ className, ...props }: ComponentProps<typeof SdkFieldDescription>) {
  return <SdkFieldDescription className={cx('m-0 px-1 text-footnote leading-[18px] text-foreground/70', className)} {...props} />;
}

/** Shows while the field is invalid: the browser's message, or its children (a node, or a function of the state,
    whose `message` is the browser's). `match` picks the problem it is for. The message follows a red
    `exclamation-circle`, so the error never rests on color alone; `[&>svg]:hidden` drops the icon. */
export function FieldError({ className, children, ...props }: ComponentProps<typeof SdkFieldError>) {
  return (
    <SdkFieldError className={cx('flex items-start gap-1.5 px-1 text-footnote leading-[18px] text-foreground', className)} {...props}>
      {(state) => (
        <>
          <Icon name="exclamation-circle" size={14} className="mt-0.5 shrink-0 text-destructive" />
          <span className="min-w-0">{children === undefined ? state.message : typeof children === 'function' ? children(state) : children}</span>
        </>
      )}
    </SdkFieldError>
  );
}

/** A native <fieldset>: names its fields with its legend, and `disabled` disables them together. */
export function FieldSet({ className, ...props }: ComponentProps<typeof SdkFieldSet>) {
  return <SdkFieldSet className={cx('m-0 flex min-w-0 flex-col gap-3 border-0 p-0', className)} {...props} />;
}

/** The set's uppercase section header. Keep it the set's first child. */
export function FieldLegend({ className, ...props }: ComponentProps<typeof SdkFieldLegend>) {
  return (
    <SdkFieldLegend
      className={cx(cn(sectionLabelVariants({ variant: 'grouped' }), 'mb-2 p-0 px-1'), className)}
      {...props}
    />
  );
}

/** Stacks fields. It has no role: a FieldSet is what names and disables a group. As a form, render it as one:
    `<FieldGroup render={<form onSubmit={save} />} className="gap-5">`. */
export function FieldGroup({ className, ...props }: ComponentProps<typeof SdkFieldGroup>) {
  return <SdkFieldGroup className={cx('flex min-w-0 flex-col gap-3', className)} {...props} />;
}

export { FieldControl, useFieldControl } from '@ui-sdk/react/field';
