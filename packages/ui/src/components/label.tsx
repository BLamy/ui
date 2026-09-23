import { Label as AriaLabel, type LabelProps as AriaLabelProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* ══ Label — react-aria's Label (auto-wired to its field) ══ */
export const labelVariants = cva('inline-flex items-center gap-1.5 font-medium group-data-disabled:opacity-50', {
  variants: {
    variant: {
      default: 'text-[15px] text-foreground',
      /** iOS grouped-form header: small, secondary, sits above a field. */
      field: 'px-1 text-[13px] text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface LabelProps extends AriaLabelProps, VariantProps<typeof labelVariants> {}

export function Label({ className, variant, ...props }: LabelProps) {
  return <AriaLabel data-slot="label" className={cn(labelVariants({ variant }), className)} {...props} />;
}
