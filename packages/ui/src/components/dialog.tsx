import { createContext, useContext, type ComponentProps } from 'react';
import {
  Button as AriaButton, type ButtonProps as AriaButtonProps,
  Dialog as AriaDialog, type DialogProps as AriaDialogProps,
  DialogTrigger,
  Heading, type HeadingProps,
  Modal, ModalOverlay, type ModalOverlayProps,
  Text, type TextProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '../lib/icon';
import { focusRing, overlayZ } from '../lib/primitives';
import { cn } from '../lib/utils';

/* ══ Dialog — react-aria's DialogTrigger / ModalOverlay / Modal / Dialog (focus trap, Esc, focus return,
   aria-modal). `alert` is the iOS centered alert card; `default`/`lg` are general-purpose dialogs.
   Portals into BLProvider's root, so the scrim covers the provider (the phone frame), not the page.
   <DialogTrigger>
     <Button>Delete…</Button>
     <DialogContent size="alert">
       <DialogHeader><DialogTitle>Delete photo?</DialogTitle><DialogDescription>…</DialogDescription></DialogHeader>
       <DialogFooter><DialogAction variant="cancel">Cancel</DialogAction><DialogAction variant="destructive">Delete</DialogAction></DialogFooter>
     </DialogContent>
   </DialogTrigger> ══ */

export { DialogTrigger };

export const dialogVariants = cva(
  'relative box-border flex max-h-full flex-col overflow-hidden bg-card text-card-foreground shadow-[0_24px_80px_--alpha(black/30%),0_0_0_.5px_var(--border)] outline-none',
  {
    variants: {
      size: {
        alert: 'w-[270px] rounded-[14px] data-entering:animate-bl-alert-in data-exiting:animate-bl-alert-out motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out',
        default: 'w-full max-w-[400px] rounded-[20px] data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out',
        lg: 'w-full max-w-[560px] rounded-[20px] data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

type DialogSize = NonNullable<VariantProps<typeof dialogVariants>['size']>;
const DialogSizeCtx = createContext<DialogSize>('default');

/** Scrim for modal overlays (Dialog, Sheet). */
export const dialogOverlayClass = cn(
  'absolute inset-0 grid place-items-center bg-overlay p-6 data-entering:animate-bl-fade-in data-exiting:animate-bl-fade-out',
  overlayZ,
);

export interface DialogContentProps extends Omit<ModalOverlayProps, 'children' | 'className'>, VariantProps<typeof dialogVariants> {
  children?: AriaDialogProps['children'];
  className?: string;
  overlayClassName?: string;
  role?: AriaDialogProps['role'];
  'aria-label'?: string;
}

/** ModalOverlay + Modal + Dialog. Alerts are not dismissed by an outside press (as on iOS); Esc closes all sizes. */
export function DialogContent({
  className, overlayClassName, size = 'default', children, role, isDismissable, 'aria-label': ariaLabel, ...props
}: DialogContentProps) {
  const s = size ?? 'default';
  return (
    <ModalOverlay
      data-slot="dialog-overlay"
      isDismissable={isDismissable ?? s !== 'alert'}
      className={cn(dialogOverlayClass, overlayClassName)}
      {...props}
    >
      <Modal data-slot="dialog-content" data-size={s} className={cn(dialogVariants({ size: s }), className)}>
        <DialogSizeCtx.Provider value={s}>
          <AriaDialog
            data-slot="dialog"
            role={role ?? (s === 'alert' ? 'alertdialog' : 'dialog')}
            aria-label={ariaLabel}
            className="flex min-h-0 flex-1 flex-col outline-none"
          >
            {children}
          </AriaDialog>
        </DialogSizeCtx.Provider>
      </Modal>
    </ModalOverlay>
  );
}

/** Bare react-aria Dialog, for custom surfaces (e.g. inside a Popover). */
export function Dialog({ className, ...props }: AriaDialogProps) {
  return <AriaDialog data-slot="dialog" className={cn('outline-none', className)} {...props} />;
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  const size = useContext(DialogSizeCtx);
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1', size === 'alert' ? 'px-4 pt-5 pb-4 text-center' : 'px-5 pt-5 pb-3', className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: HeadingProps) {
  const size = useContext(DialogSizeCtx);
  return (
    <Heading
      slot="title"
      data-slot="dialog-title"
      className={cn('m-0 font-semibold text-foreground', size === 'alert' ? 'text-[17px] leading-[22px]' : 'pr-8 text-[20px] leading-[25px] tracking-[-.3px]', className)}
      {...props}
    />
  );
}

export function DialogDescription({ className, ...props }: TextProps) {
  const size = useContext(DialogSizeCtx);
  return (
    <Text
      elementType="p"
      data-slot="dialog-description"
      className={cn('m-0 text-foreground', size === 'alert' ? 'text-[13px] leading-[18px]' : 'text-[15px] leading-[20px] text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Scrollable body between header and footer (default / lg dialogs). */
export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-body" className={cn('bl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-2 text-[15px]', className)} {...props} />;
}

export interface DialogFooterProps extends ComponentProps<'div'> {
  /** Alert buttons: side by side (default for two) or stacked. */
  orientation?: 'horizontal' | 'vertical';
}

export function DialogFooter({ className, orientation = 'horizontal', ...props }: DialogFooterProps) {
  const size = useContext(DialogSizeCtx);
  return (
    <div
      data-slot="dialog-footer"
      data-orientation={orientation}
      className={cn(
        size === 'alert'
          ? cn('flex shadow-[inset_0_1px_0_var(--border)]', orientation === 'vertical'
            ? 'flex-col [&>*+*]:shadow-[inset_0_1px_0_var(--border)]'
            : '[&>*]:flex-1 [&>*+*]:shadow-[inset_1px_0_0_var(--border)]')
          : 'flex items-center justify-end gap-2 px-5 pt-3 pb-5',
        className,
      )}
      {...props}
    />
  );
}

export const dialogActionVariants = cva(
  cn('bl-btn box-border flex h-11 cursor-pointer items-center justify-center border-0 bg-transparent px-3 [font-family:inherit] text-[17px] whitespace-nowrap text-primary transition-[background-color] duration-exit data-pressed:bg-accent data-disabled:cursor-default data-disabled:opacity-40', focusRing, 'data-focus-visible:ring-inset'),
  {
    variants: {
      variant: {
        default: 'font-normal',
        /** The preferred / cancel action: semibold, like iOS. */
        cancel: 'font-semibold',
        destructive: 'font-normal text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface DialogActionProps extends AriaButtonProps, VariantProps<typeof dialogActionVariants> {}

/** iOS alert button. Closes the dialog by default (react-aria's `close` slot); pass `slot={null}` to keep it open. */
export function DialogAction({ className, variant, slot = 'close', ...props }: DialogActionProps) {
  return (
    <AriaButton
      data-slot="dialog-action"
      slot={slot}
      className={composeRenderProps(className, (cls) => cn(dialogActionVariants({ variant }), cls))}
      {...props}
    />
  );
}

/** Round × button pinned to the top-right corner (default / lg dialogs and sheets). */
export function DialogClose({ className, ...props }: AriaButtonProps) {
  return (
    <AriaButton
      data-slot="dialog-close"
      slot="close"
      aria-label="Close"
      className={composeRenderProps(className, (cls) => cn(
        'bl-btn absolute top-4 right-4 grid size-[30px] cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground data-pressed:bg-secondary-strong',
        focusRing, cls,
      ))}
      {...props}
    >
      <Icon name="x" size={15} sw={2.6} />
    </AriaButton>
  );
}
