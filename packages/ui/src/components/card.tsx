import { renderElement, type PartProps } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { surfaceDescriptionVariants, surfaceTitleVariants } from '@/lib/surface';
import { cx } from '@/lib/utils';

/* ══ Card — shadcn's card as an iOS inset-grouped panel ══
   <Card>
     <CardHeader>
       <CardTitle>Pro plan</CardTitle>
       <CardDescription>Billed yearly</CardDescription>
       <CardAction><Badge variant="tinted">Current</Badge></CardAction>
     </CardHeader>
     <CardContent>…</CardContent>
     <CardFooter>…</CardFooter>
   </Card>
   Every part takes `render`: `<Card render={<article />}>`, `<CardTitle render={<h2 />}>`, and a whole card that is
   a link is `<Card render={<a href="…" />}>`. The surface (radius, fill) is the one List and DisclosureGroup's
   `inset` variant use. */
export const cardVariants = cva('flex flex-col overflow-hidden rounded-panel text-card-foreground', {
  variants: {
    variant: {
      /** Inset-grouped: a card on the grouped (bg2) background. */
      default: 'bg-card [--avatar-ring:var(--card)]',
      /** Floating: lifts off any background. */
      elevated: 'bg-card shadow-raised [--avatar-ring:var(--card)]',
      /** Hairline outline, no fill. */
      outline: 'bg-transparent shadow-hairline',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface CardProps extends PartProps<'div'>, VariantProps<typeof cardVariants> {}

export function Card({ className, variant, render, ...props }: CardProps) {
  return renderElement('div', { 'data-slot': 'card', ...props, className: cx(cardVariants({ variant }), className) }, render);
}

/** Title, description and an optional `CardAction`, which takes the top-right corner. */
export function CardHeader({ className, render, ...props }: PartProps<'div'>) {
  return renderElement(
    'div',
    {
      'data-slot': 'card-header',
      ...props,
      className: cx('grid auto-rows-min items-start gap-1 px-4 pt-4 pb-1 has-data-[slot=card-action]:grid-cols-[1fr_auto]', className),
    },
    render,
  );
}

/** An `h3` by default: `render={<h2 />}` for another level. The small surface title Popover, HoverCard and
    AlertDialog use (`surfaceTitleVariants({ size: 'sm' })`). */
export function CardTitle({ className, render, ...props }: PartProps<'h3'>) {
  return renderElement(
    'h3',
    { 'data-slot': 'card-title', ...props, className: cx(surfaceTitleVariants({ size: 'sm' }), className) },
    render,
  );
}

export function CardDescription({ className, render, ...props }: PartProps<'p'>) {
  return renderElement(
    'p',
    { 'data-slot': 'card-description', ...props, className: cx(surfaceDescriptionVariants({ size: 'sm' }), className) },
    render,
  );
}

/** The header's top-right slot (a badge, a menu button, a link), beside the title and the description. */
export function CardAction({ className, render, ...props }: PartProps<'div'>) {
  return renderElement(
    'div',
    { 'data-slot': 'card-action', ...props, className: cx('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className) },
    render,
  );
}

export function CardContent({ className, render, ...props }: PartProps<'div'>) {
  return renderElement('div', { 'data-slot': 'card-content', ...props, className: cx('px-4 py-3 text-subhead leading-[20px]', className) }, render);
}

export function CardFooter({ className, render, ...props }: PartProps<'div'>) {
  return renderElement('div', { 'data-slot': 'card-footer', ...props, className: cx('flex items-center gap-2 px-4 pt-1 pb-4', className) }, render);
}
