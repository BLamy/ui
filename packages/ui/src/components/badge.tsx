import { renderElement, type PartProps } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { cx } from '@/lib/utils';

/* ══ Badge — shadcn's badge as an iOS capsule ══
   <Badge variant="success">Live</Badge>
   <Badge size="sm" variant="tinted" aria-label="12 unread">12</Badge>        // a count in a row or a tab
   <Badge render={<a href="#failures" />} variant="destructive">3 failed</Badge>   // a link that looks like a badge
   A single character is a circle: the capsule is never narrower than it is tall. */
export const badgeVariants = cva(
  'box-border inline-flex shrink-0 items-center justify-center gap-1 rounded-full leading-none font-semibold whitespace-nowrap tabular-nums',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        tinted: 'bg-primary/15 text-primary',
        outline: 'text-foreground shadow-hairline',
        destructive: 'bg-destructive text-white',
        // Black on the light iOS green and yellow (about 9:1); white would be 2.2:1.
        success: 'bg-success text-black',
        warning: 'bg-warning text-black',
      },
      size: {
        /** A count beside a row's title, a tab or a button. */
        sm: 'h-[18px] min-w-[18px] px-1.5 text-caption2 [&>svg]:size-2.5',
        default: 'h-[22px] min-w-[22px] px-2 text-caption [&>svg]:size-3',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface BadgeProps extends PartProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, render, ...props }: BadgeProps) {
  return renderElement('span', { 'data-slot': 'badge', ...props, className: cx(badgeVariants({ variant, size }), className) }, render);
}
