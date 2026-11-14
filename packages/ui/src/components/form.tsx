import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/* ══ Form — a native <form> as a vertical stack of fields ══
   UI SDK has no form component: its controls submit under their `name`, validate with the browser's constraints,
   and each <Field> shows its own error after a submit attempt (the first invalid control takes focus). So this is
   the element itself, with the kit's spacing: `onSubmit`, `action` (a server action too), `onReset` and `noValidate`
   are the native ones. Group fields with FieldSet (components/field); show a server's error with `invalid` on the
   Field and a `<FieldError match>`. */
export function Form({ className, ...props }: ComponentProps<'form'>) {
  return <form data-slot="form" className={cn('flex flex-col gap-5', className)} {...props} />;
}
