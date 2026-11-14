'use client';
import type { ComponentProps } from 'react';
import {
  Dialog as SdkDialog,
  DialogBackdrop as SdkDialogBackdrop,
  DialogClose as SdkDialogClose,
  DialogContent as SdkDialogContent,
  DialogDescription as SdkDialogDescription,
  DialogTitle as SdkDialogTitle,
} from '@ui-sdk/react/dialog';
import {
  AlertDialog as SdkAlertDialog,
  AlertDialogBackdrop as SdkAlertDialogBackdrop,
  AlertDialogClose as SdkAlertDialogClose,
  AlertDialogContent as SdkAlertDialogContent,
  AlertDialogDescription as SdkAlertDialogDescription,
  AlertDialogTitle as SdkAlertDialogTitle,
} from '@ui-sdk/react/alert-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { focusRing } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { useMountPresentationKey, usePresentation } from '@/lib/container';

/* ══ Dialog and AlertDialog — UI SDK's dialogs with the kit's cards ══
   UI SDK owns the behavior: the focus trap, Esc, focus returning to the trigger, the inert page behind,
   `aria-modal`, nested dialogs, and `presentation="auto"`, which turns a Dialog into a bottom sheet in a compact
   container. Both render into BLProvider's root (see `useLayerHost`), so the scrim covers the app's frame, not the
   page.

   Dialog is a general-purpose card (`size`: `default`, `lg`) with a header, a scrolling body and a footer:
   <Dialog>
     <DialogTrigger className={buttonVariants()}>Rename…</DialogTrigger>
     <DialogBackdrop />
     <DialogContent>
       <DialogClose />
       <DialogHeader><DialogTitle>Rename project</DialogTitle><DialogDescription>…</DialogDescription></DialogHeader>
       <DialogBody>…</DialogBody>
       <DialogFooter><DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>…</DialogFooter>
     </DialogContent>
   </Dialog>

   AlertDialog is the centered iOS alert, a question that waits for an answer: `role="alertdialog"`, an outside
   press never closes it, and focus starts on its first AlertDialogClose (so put the safe answer first).
   <AlertDialog>
     <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete…</AlertDialogTrigger>
     <AlertDialogBackdrop />
     <AlertDialogContent>
       <AlertDialogHeader><AlertDialogTitle>Delete photo?</AlertDialogTitle><AlertDialogDescription>…</AlertDialogDescription></AlertDialogHeader>
       <AlertDialogFooter>
         <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
         <AlertDialogClose variant="destructive" value="confirm">Delete</AlertDialogClose>
       </AlertDialogFooter>
     </AlertDialogContent>
   </AlertDialog> ══ */

export { DialogTrigger, createDialogController } from '@ui-sdk/react/dialog';
export type { DialogController } from '@ui-sdk/react/dialog';
export { AlertDialogTrigger, createAlertDialogController, createConfirm } from '@ui-sdk/react/alert-dialog';
export type { AlertDialogController } from '@ui-sdk/react/alert-dialog';

/* A Dialog grows out of the middle on the snappy spring. Presented as a sheet it is shaped like the kit's bottom
   Sheet, and the sheet moves it. */
const dialogPop =
  'duration-spring-snappy ease-spring-snappy not-data-[presentation=sheet]:data-starting-style:opacity-0 not-data-[presentation=sheet]:data-ending-style:opacity-0 motion-safe:not-data-[presentation=sheet]:data-starting-style:scale-90 motion-safe:not-data-[presentation=sheet]:data-ending-style:scale-96';
const dialogSheet =
  'data-[presentation=sheet]:relative data-[presentation=sheet]:inset-auto data-[presentation=sheet]:m-0 data-[presentation=sheet]:w-full data-[presentation=sheet]:max-w-none data-[presentation=sheet]:rounded-t-card data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(12px,env(safe-area-inset-bottom))] data-[presentation=sheet]:transition-none';

/* The card. It centers itself in its host; an alert has its own entrance (it settles from slightly larger). */
export const dialogVariants = cva(
  'fixed inset-0 m-auto box-border flex h-fit max-h-[calc(100%-48px)] flex-col overflow-hidden bg-card text-card-foreground shadow-[0_24px_80px_--alpha(black/30%),0_0_0_.5px_var(--border)] outline-none transition-[opacity,scale] data-ending-style:duration-exit data-ending-style:ease-exit motion-reduce:duration-spring-smooth motion-reduce:ease-spring-smooth',
  {
    variants: {
      size: {
        alert: 'w-[270px] max-w-[calc(100%-48px)] rounded-card duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:data-starting-style:scale-[1.14] motion-safe:data-ending-style:scale-98',
        default: `w-[calc(100%-48px)] max-w-[400px] rounded-[20px] ${dialogPop} ${dialogSheet}`,
        lg: `w-[calc(100%-48px)] max-w-[560px] rounded-[20px] ${dialogPop} ${dialogSheet}`,
      },
    },
    defaultVariants: { size: 'default' },
  },
);

/* Scrim behind a modal card. It fades with the card; while a Dialog presents as a sheet (its viewport follows the
   backdrop) the sheet drives the dim, so the fade steps aside. */
const dialogBackdropClass =
  'fixed inset-0 bg-overlay transition-opacity duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-exit data-ending-style:ease-exit has-[+[data-slot=dialog-viewport]]:transition-none';

/* Shared with Sheet, whose title, description and close button are the same parts of another primitive. */
export const dialogTitleClass = 'm-0 pr-8 text-title leading-[25px] font-semibold tracking-[-.3px] text-foreground';
export const dialogDescriptionClass = 'm-0 text-subhead leading-[20px] text-muted-foreground';
export const dialogCloseClass = cn(
  'bl-btn absolute top-4 right-4 grid size-[30px] cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground active:bg-secondary-strong',
  focusRing,
);

/* ── Dialog ── */

export type DialogProps = ComponentProps<typeof SdkDialog>;

export function Dialog({ container, presentation, ...props }: DialogProps) {
  const host = useLayerHost();
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'dialog');
  const key = useMountPresentationKey(shown);
  return <SdkDialog key={key} container={container === undefined ? host : container} presentation={shown} {...props} />;
}

export function DialogBackdrop({ className, style, ...props }: ComponentProps<typeof SdkDialogBackdrop>) {
  const scope = useThemeScopeProps();
  return (
    <SdkDialogBackdrop
      data-theme-scope={scope['data-theme-scope']}
      className={cx([dialogBackdropClass, scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

export type DialogContentProps<Payload = unknown> = Parameters<typeof SdkDialogContent<Payload>>[0] & {
  size?: Exclude<NonNullable<VariantProps<typeof dialogVariants>['size']>, 'alert'>;
};

/** The card. Name it with a DialogTitle, or `aria-label`. */
export function DialogContent<Payload = unknown>({ className, style, size = 'default', ...props }: DialogContentProps<Payload>) {
  const scope = useThemeScopeProps();
  return (
    <SdkDialogContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      data-size={size}
      className={cx([dialogVariants({ size }), scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-1 px-5 pt-5 pb-3', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof SdkDialogTitle>) {
  return <SdkDialogTitle className={cx(dialogTitleClass, className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof SdkDialogDescription>) {
  return <SdkDialogDescription className={cx(dialogDescriptionClass, className)} {...props} />;
}

/** Scrollable body between header and footer. */
export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-body" className={cn('bl-scroll min-h-0 flex-1 overflow-y-auto px-5 py-2 text-subhead', className)} {...props} />;
}

/** The card's actions, right-aligned. */
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-footer" className={cn('flex items-center justify-end gap-2 px-5 pt-3 pb-5', className)} {...props} />;
}

/** Closes the dialog. On its own it is the round × pinned to the card's top-right corner; with children or `render`
    it is whatever you make it (`<DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>`). A
    `value` is reported as `returnValue`, and an `action` runs first (a Promise it returns keeps the dialog open). */
export function DialogClose({ className, children, render, ...props }: ComponentProps<typeof SdkDialogClose>) {
  if (children !== undefined || render !== undefined) {
    return <SdkDialogClose className={className} render={render} {...props}>{children}</SdkDialogClose>;
  }
  return (
    <SdkDialogClose aria-label="Close" className={cx(dialogCloseClass, className)} {...props}>
      <Icon name="x" size={15} sw={2.6} />
    </SdkDialogClose>
  );
}

/* ── AlertDialog ── */

export type AlertDialogProps = ComponentProps<typeof SdkAlertDialog>;

export function AlertDialog({ container, ...props }: AlertDialogProps) {
  const host = useLayerHost();
  return <SdkAlertDialog container={container === undefined ? host : container} {...props} />;
}

export function AlertDialogBackdrop({ className, style, ...props }: ComponentProps<typeof SdkAlertDialogBackdrop>) {
  const scope = useThemeScopeProps();
  return (
    <SdkAlertDialogBackdrop
      data-theme-scope={scope['data-theme-scope']}
      className={cx([dialogBackdropClass, scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

export type AlertDialogContentProps<Payload = unknown> = Parameters<typeof SdkAlertDialogContent<Payload>>[0];

/** The alert card. Name it with an AlertDialogTitle. */
export function AlertDialogContent<Payload = unknown>({ className, style, ...props }: AlertDialogContentProps<Payload>) {
  const scope = useThemeScopeProps();
  return (
    <SdkAlertDialogContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      data-size="alert"
      className={cx([dialogVariants({ size: 'alert' }), scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

export function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-header" className={cn('flex flex-col gap-1 px-4 pt-5 pb-4 text-center', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof SdkAlertDialogTitle>) {
  return <SdkAlertDialogTitle className={cx('m-0 text-body leading-[22px] font-semibold text-foreground', className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: ComponentProps<typeof SdkAlertDialogDescription>) {
  return <SdkAlertDialogDescription className={cx('m-0 text-footnote leading-[18px] text-foreground', className)} {...props} />;
}

export interface AlertDialogFooterProps extends ComponentProps<'div'> {
  /** The answers side by side (the default, for two) or stacked. */
  orientation?: 'horizontal' | 'vertical';
}

export function AlertDialogFooter({ className, orientation = 'horizontal', ...props }: AlertDialogFooterProps) {
  return (
    <div
      data-slot="alert-dialog-footer"
      data-orientation={orientation}
      className={cn(
        'flex shadow-hairline-t',
        orientation === 'vertical' ? 'flex-col [&>*+*]:shadow-hairline-t' : '[&>*]:flex-1 [&>*+*]:shadow-[inset_1px_0_0_var(--border)]',
        className,
      )}
      {...props}
    />
  );
}

export const alertDialogCloseVariants = cva(
  cn(
    'bl-btn box-border flex h-11 cursor-pointer items-center justify-center border-0 bg-transparent px-3 [font-family:inherit] text-body whitespace-nowrap text-primary transition-[background-color] duration-exit active:bg-accent disabled:cursor-default disabled:opacity-40 data-pending:cursor-progress',
    focusRing,
    'focus-visible:ring-inset',
  ),
  {
    variants: {
      variant: {
        default: 'font-normal',
        /** The preferred / cancel answer: semibold, like iOS. */
        cancel: 'font-semibold',
        destructive: 'font-normal text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export type AlertDialogCloseProps = ComponentProps<typeof SdkAlertDialogClose> & VariantProps<typeof alertDialogCloseVariants>;

/** An answer: an iOS alert button that closes the alert. Give the agreeing one `value="confirm"` (it is the
    `returnValue`, and what `createConfirm` resolves `true` for); an `action` runs before it closes, and a Promise it
    returns keeps the alert open, the button pending, until it settles. */
export function AlertDialogClose({ className, variant, ...props }: AlertDialogCloseProps) {
  return <SdkAlertDialogClose className={cx(alertDialogCloseVariants({ variant }), className)} {...props} />;
}
