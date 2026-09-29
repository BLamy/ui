import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

/* ══ Card — shadcn's card as an iOS inset-grouped panel ══ */
export const cardVariants = cva('flex flex-col overflow-hidden rounded-[14px] text-card-foreground', {
  variants: {
    variant: {
      /** Inset-grouped: a card on the grouped (bg2) background. */
      default: 'bg-card',
      /** Floating: lifts off any background. */
      elevated: 'bg-card shadow-[0_6px_24px_rgba(0,0,0,.1),0_0_0_.5px_var(--border)]',
      /** Hairline outline, no fill. */
      outline: 'bg-transparent shadow-[inset_0_0_0_1px_var(--border)]',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface CardProps extends ComponentProps<'div'>, VariantProps<typeof cardVariants> {}

export function Card({ className, variant, ...props }: CardProps) {
  return <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1 px-4 pt-4 pb-1', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('m-0 text-[17px] leading-[22px] font-semibold tracking-[-.2px] text-foreground', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('m-0 text-[13px] leading-[18px] text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-4 py-3 text-[15px] leading-[20px]', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('flex items-center gap-2 px-4 pt-1 pb-4', className)} {...props} />;
}
