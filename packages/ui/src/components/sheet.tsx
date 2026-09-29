import type { ComponentProps } from 'react';
import {
  Dialog as AriaDialog, type DialogProps as AriaDialogProps,
  DialogTrigger,
  Modal, ModalOverlay, type ModalOverlayProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { overlayZ } from '../lib/primitives';
import { cn } from '../lib/utils';
import { AnimatedHeight } from './animated-height';
import { DialogBody, DialogClose, DialogDescription, DialogHeader, DialogTitle } from './dialog';

/* ══ Sheet — a react-aria Modal pinned to an edge (shadcn's Sheet). Bottom is the iOS card sheet with a grabber;
   left/right are side panels; top drops down. Esc, outside press, focus trap and focus return come from
   react-aria. Inside: SheetHeader / SheetTitle / SheetDescription / SheetBody / SheetFooter / SheetClose.
   <Sheet>
     <Button>Filters</Button>
     <SheetContent side="bottom">…</SheetContent>
   </Sheet> ══ */

/** Opens the SheetContent it wraps from its first pressable child (react-aria's DialogTrigger). */
export const Sheet = DialogTrigger;

export const sheetVariants = cva(
  'absolute box-border flex flex-col bg-card text-card-foreground shadow-[0_0_40px_rgba(0,0,0,.22)] outline-none motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out',
  {
    variants: {
      side: {
        bottom: 'inset-x-0 bottom-0 max-h-[calc(100%-48px)] rounded-t-[14px] pb-[max(12px,env(safe-area-inset-bottom))] data-entering:animate-bl-sheet-in-bottom data-exiting:animate-bl-sheet-out-bottom',
        top: 'inset-x-0 top-0 max-h-[calc(100%-48px)] rounded-b-[14px] pt-(--bl-safe-top) data-entering:animate-bl-sheet-in-top data-exiting:animate-bl-sheet-out-top',
        left: 'inset-y-0 left-0 w-[85%] max-w-[360px] rounded-r-[14px] data-entering:animate-bl-sheet-in-left data-exiting:animate-bl-sheet-out-left',
        right: 'inset-y-0 right-0 w-[85%] max-w-[360px] rounded-l-[14px] data-entering:animate-bl-sheet-in-right data-exiting:animate-bl-sheet-out-right',
      },
    },
    defaultVariants: { side: 'bottom' },
  },
);

export interface SheetContentProps extends Omit<ModalOverlayProps, 'children' | 'className'>, VariantProps<typeof sheetVariants> {
  children?: AriaDialogProps['children'];
  className?: string;
  overlayClassName?: string;
  'aria-label'?: string;
  /** Show the grabber on bottom sheets (default true). */
  grabber?: boolean;
  /** Spring the sheet's height when its content changes (a tray stepping through a flow). Use for short,
      content-sized trays; a sheet that scrolls its body should leave this off. */
  animateHeight?: boolean;
}

export function SheetContent({
  className, overlayClassName, side = 'bottom', children, grabber = true, animateHeight, isDismissable = true, 'aria-label': ariaLabel, ...props
}: SheetContentProps) {
  const s = side ?? 'bottom';
  return (
    <ModalOverlay
      data-slot="sheet-overlay"
      isDismissable={isDismissable}
      className={cn('absolute inset-0 bg-overlay data-entering:animate-bl-fade-in data-exiting:animate-bl-fade-out-slow', overlayZ, overlayClassName)}
      {...props}
    >
      <Modal data-slot="sheet" data-side={s} className={cn(sheetVariants({ side: s }), className)}>
        {s === 'bottom' && grabber ? (
          <span data-slot="sheet-grabber" aria-hidden="true" className="mx-auto mt-[5px] mb-px block h-[5px] w-9 shrink-0 rounded-full bg-secondary-strong" />
        ) : null}
        <AriaDialog data-slot="sheet-content" aria-label={ariaLabel} className="relative flex min-h-0 flex-1 flex-col outline-none">
          {animateHeight
            ? (renderProps) => <AnimatedHeight>{typeof children === 'function' ? children(renderProps) : children}</AnimatedHeight>
            : children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Pinned bottom area for a sheet's actions. */
export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 px-5 pt-3 pb-2', className)} {...props} />;
}

/* Sheet anatomy shares the dialog parts. */
export const SheetHeader = DialogHeader;
export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;
export const SheetBody = DialogBody;
export const SheetClose = DialogClose;
