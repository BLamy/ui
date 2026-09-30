'use client';
import {
  FieldError as AriaFieldError, type FieldErrorProps as AriaFieldErrorProps,
  Text, type TextProps,
  TextField as AriaTextField, type TextFieldProps as AriaTextFieldProps,
  composeRenderProps,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

/* ══ TextField — react-aria's TextField: wires a Label, an Input/Textarea, a description and a FieldError ══
   <TextField isRequired>
     <Label variant="field">Email</Label>
     <Input type="email" />
     <FieldDescription>We never share it.</FieldDescription>
     <FieldError />
   </TextField> */
export interface TextFieldProps extends AriaTextFieldProps {}

export function TextField({ className, ...props }: TextFieldProps) {
  return (
    <AriaTextField
      data-slot="text-field"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}

/** Help text under a field (react-aria's `description` slot, announced with the field). */
export function FieldDescription({ className, ...props }: TextProps) {
  return <Text data-slot="field-description" slot="description" className={cn('px-1 text-footnote leading-[18px] text-muted-foreground', className)} {...props} />;
}

/** Validation message; renders only while the field is invalid. */
export function FieldError({ className, ...props }: AriaFieldErrorProps) {
  return (
    <AriaFieldError
      data-slot="field-error"
      className={composeRenderProps(className, (cls) => cn('px-1 text-footnote leading-[18px] text-destructive', cls))}
      {...props}
    />
  );
}
