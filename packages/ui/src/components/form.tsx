import type { ComponentProps, ReactNode } from 'react';
import { Form as AriaForm, type FormProps as AriaFormProps } from 'react-aria-components';
import { cn } from '../lib/utils';

/* ══ Form — react-aria's Form: native submit + constraint validation, with react-aria fields' errors shown on
   submit (validationBehavior="native") or live ("aria"). `validationErrors` maps server errors onto fields by
   name. FormSection groups fields under an iOS-style section header. ══ */
export function Form({ className, ...props }: AriaFormProps) {
  return <AriaForm data-slot="form" className={cn('flex flex-col gap-5', className)} {...props} />;
}

export interface FormSectionProps extends Omit<ComponentProps<'fieldset'>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
}

export function FormSection({ className, title, description, children, ...props }: FormSectionProps) {
  return (
    <fieldset data-slot="form-section" className={cn('m-0 flex min-w-0 flex-col gap-3 border-0 p-0', className)} {...props}>
      {title ? (
        <legend className="mb-2 p-0 px-1 text-[13px] leading-[18px] font-normal tracking-[.02em] text-muted-foreground uppercase">{title}</legend>
      ) : null}
      {children}
      {description ? <p className="m-0 px-1 text-[13px] leading-[18px] text-muted-foreground">{description}</p> : null}
    </fieldset>
  );
}
