import { cva } from 'class-variance-authority';
import { focusRing } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ Surface parts — the header, title, description, body, footer and × of the kit's surfaces ══
   Dialog, AlertDialog, Sheet and AdaptivePane draw their chrome from these (Dialog's sheet presentation also takes
   the sheet grabber), and Card, Popover, HoverCard and Toast take the title / description / × from them, so a title
   or a close button looks the same on every surface.
   A plain module with no hooks (no 'use client'), so a Server Component (Card) can call them too.
   dialog.tsx re-exports them: `import { surfaceTitleVariants } from '@/components/ui/dialog'` works as well. ══ */

/** A surface's header: `default` stacks the title over its description (the × pinned in the corner beside it);
    `bar` is one row (back · title · close), for flows and for trays. */
export const surfaceHeaderVariants = cva('flex', {
  variants: {
    variant: {
      default: 'flex-col gap-1 px-5 pt-5 pb-3',
      // The row keeps the height its buttons give it, so a back chevron or a × can come and go.
      bar: 'relative z-2 min-h-[54px] shrink-0 items-start gap-2.5 ps-5 pe-4 pt-4 pb-2',
    },
  },
  defaultVariants: { variant: 'default' },
});

/** A surface's title: `default` for dialogs and sheets, `sm` for alerts, cards and popups. */
export const surfaceTitleVariants = cva('m-0 font-semibold text-foreground', {
  variants: {
    size: {
      sm: 'text-body leading-[22px]',
      default: 'text-title leading-[25px] tracking-[-.3px]',
    },
  },
  defaultVariants: { size: 'default' },
});

/** A surface's description, one step down from its title. */
export const surfaceDescriptionVariants = cva('m-0 text-muted-foreground', {
  variants: {
    size: {
      sm: 'text-footnote leading-[18px]',
      default: 'text-subhead leading-[20px]',
    },
  },
  defaultVariants: { size: 'default' },
});

/** The scrolling area between a surface's header and footer. */
export const surfaceBodyVariants = cva('bl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-2 text-subhead');

/** A surface's actions: a right-aligned row (`horizontal`) or full-width buttons stacked (`vertical`). */
export const surfaceFooterVariants = cva('flex gap-2 px-5 pt-3 pb-5', {
  variants: {
    orientation: {
      horizontal: 'items-center justify-end',
      vertical: 'flex-col',
    },
  },
  defaultVariants: { orientation: 'horizontal' },
});

/** The round × (and ‹) of every surface: 30px, in the header row (`inline`) or pinned to the top-end corner. */
export const closeButtonVariants = cva(
  cn(
    'bl-btn grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground transition-[background-color,color] duration-exit hover:text-foreground active:bg-secondary-strong disabled:cursor-default disabled:opacity-40',
    focusRing,
  ),
  {
    variants: {
      layout: {
        inline: '',
        pinned: 'absolute top-4 end-4 z-2',
      },
    },
    defaultVariants: { layout: 'inline' },
  },
);

/** The grabber's look: a pill centred at the top of a bottom sheet (Sheet, and Dialog presented as a sheet).
    `handle` adds a press target around it (SheetHandle). */
export const sheetGrabberVariants = cva('mx-auto mt-[5px] mb-px block h-[5px] w-9 shrink-0 rounded-full bg-secondary-strong', {
  variants: {
    handle: {
      true: cn('relative cursor-grab border-0 p-0 after:absolute after:-inset-x-4 after:-inset-y-3 active:cursor-grabbing', focusRing),
      false: '',
    },
  },
  defaultVariants: { handle: false },
});
