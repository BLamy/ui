import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* ══ Badge — shadcn's badge as an iOS capsule ══ */
export const badgeVariants = cva(
  'box-border inline-flex h-[22px] shrink-0 items-center justify-center gap-1 rounded-full px-2 text-[12px] leading-none font-semibold whitespace-nowrap [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        tinted: 'bg-primary/15 text-primary',
        outline: 'text-foreground shadow-[inset_0_0_0_1px_var(--bl-sep)]',
        destructive: 'bg-destructive text-white',
        success: 'bg-success text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
