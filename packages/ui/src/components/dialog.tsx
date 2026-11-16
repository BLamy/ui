'use client';
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react';
import { createFocusRecovery } from '@ui-sdk/core';
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
import { Button as SdkButton } from '@ui-sdk/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { focusRing } from '@/lib/primitives';
import {
  closeButtonVariants,
  sheetGrabberVariants,
  surfaceBodyVariants,
  surfaceDescriptionVariants,
  surfaceFooterVariants,
  surfaceHeaderVariants,
  surfaceTitleVariants,
} from '@/lib/surface';
import { cn, cx } from '@/lib/utils';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { useMountPresentationKey, usePresentation } from '@/lib/container';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Swap } from '@/components/ui/swap';
import { SurfaceFlow, SurfaceFlowTitle, SurfaceHeaderContext, useSurfaceFlow, useSurfaceHeader } from '@/lib/surface-flow';

/* ══ Dialog and AlertDialog — UI SDK's dialogs with the kit's cards ══
   UI SDK owns the behavior: the focus trap, Esc, focus returning to the trigger, the inert page behind,
   `aria-modal`, nested dialogs, the swipe that dismisses a sheet and the keyboard inset under it. Both render into
   BLProvider's root (see `useLayerHost`), so the scrim covers the app's frame, not the page.

   Dialog is responsive by default (`presentation="auto"`): a centered card while the size-class scope it is written
   in is medium or regular, a sheet you can drag down while it is compact. `presentation="dialog"` keeps it a card.
   As a sheet, `DialogContent variant="default"` is attached to the bottom edge like the kit's Sheet, and
   `variant="tray"` floats inset from the edges.
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

   A flow (menu → QR code → done) gives the root a `view`: the card springs its height to each DialogView, the views
   and the title travel in the direction of the flow (a new view from the right, one seen before from the left), and
   a DialogBack grows into the header bar.
   <Dialog open={open} onOpenChange={setOpen} view={view}>
     <DialogBackdrop />
     <DialogContent variant="tray">
       <DialogHeader variant="bar">
         <DialogBack hidden={view === 'menu'} onClick={() => setView('menu')} />
         <DialogTitle>{TITLES[view]}</DialogTitle>
         <DialogClose />
       </DialogHeader>
       <DialogView>…the current view…</DialogView>
     </DialogContent>
   </Dialog>

   AlertDialog is the centered iOS alert, a question that waits for an answer: `role="alertdialog"`, an outside
   press never closes it, focus starts on its first AlertDialogClose (so put the safe answer first), and it stays
   centered in every container.
   <AlertDialog>
     <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete…</AlertDialogTrigger>
     <AlertDialogBackdrop />
     <AlertDialogContent>
       <AlertDialogHeader><AlertDialogTitle>Delete photo?</AlertDialogTitle><AlertDialogDescription>…</AlertDialogDescription></AlertDialogHeader>
       <AlertDialogFooter>
         <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
         <AlertDialogClose tone="destructive" value="confirm">Delete</AlertDialogClose>
       </AlertDialogFooter>
     </AlertDialogContent>
   </AlertDialog>

   The header, title, description, body, footer and close-button recipes below are the kit's surface parts: Sheet
   and the other modal surfaces build their own parts from them. ══ */

export { DialogTrigger, createDialogController } from '@ui-sdk/react/dialog';
export type { DialogController } from '@ui-sdk/react/dialog';
export { AlertDialogTrigger, createAlertDialogController, createConfirm } from '@ui-sdk/react/alert-dialog';
export type { AlertDialogController } from '@ui-sdk/react/alert-dialog';

/* ── Surface parts: shared by every modal surface (defined in lib/surface, hook-free so Card can use them) ── */

export {
  surfaceHeaderVariants,
  surfaceTitleVariants,
  surfaceDescriptionVariants,
  surfaceBodyVariants,
  surfaceFooterVariants,
  closeButtonVariants,
} from '@/lib/surface';

/* ── Dialog ── */

export type DialogProps = ComponentProps<typeof SdkDialog> & {
  /** Key of the current view of a flow. A new key springs the card to its DialogView's height and slides in from
      the right, with its title; a key seen before comes back from the left. */
  view?: string;
};

/** The root. `presentation` defaults to `"auto"`: a sheet in a compact size-class scope, a centered card in a medium
    or regular one (UI SDK's own rule, a small touch screen, outside every scope). `"dialog"` or `"sheet"` fix it. */
export function Dialog({ container, presentation = 'auto', view, dismissible = true, ...props }: DialogProps) {
  const host = useLayerHost();
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'dialog');
  const key = useMountPresentationKey(shown);
  return (
    <SurfaceFlow view={view} dismissible={dismissible}>
      <SdkDialog key={key} container={container === undefined ? host : container} presentation={shown} dismissible={dismissible} {...props} />
    </SurfaceFlow>
  );
}

/* Scrim behind a modal card. It fades with the card; while a Dialog presents as a sheet (its viewport follows the
   backdrop) the sheet drives the dim, so the fade steps aside. */
const dialogBackdropClass =
  'fixed inset-0 bg-overlay transition-opacity duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-exit data-ending-style:ease-exit has-[+[data-slot=dialog-viewport]]:transition-none';

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

/* Every modal card: centered in its host, one radius, one elevation. */
const modalCard =
  'fixed inset-0 m-auto box-border flex h-fit max-h-[calc(100%-48px)] flex-col overflow-hidden rounded-sheet bg-card text-card-foreground shadow-[0_24px_80px_--alpha(black/30%),0_0_0_.5px_var(--border)] outline-none transition-[opacity,scale] data-ending-style:duration-exit data-ending-style:ease-exit motion-reduce:duration-spring-smooth motion-reduce:ease-spring-smooth';

/* The card look shared by `default` and `tray`. */
const dialogCard = cn(
  modalCard,
  'w-[calc(100%-48px)] duration-spring-snappy ease-spring-snappy',
  'not-data-[presentation=sheet]:data-starting-style:opacity-0 not-data-[presentation=sheet]:data-ending-style:opacity-0 motion-safe:not-data-[presentation=sheet]:data-starting-style:scale-90 motion-safe:not-data-[presentation=sheet]:data-ending-style:scale-96',
  'data-[presentation=sheet]:relative data-[presentation=sheet]:inset-auto data-[presentation=sheet]:max-w-none data-[presentation=sheet]:transition-none',
);

/** The Dialog's card. Centered it grows out of the middle on the snappy spring; as a sheet UI SDK moves it (so it is
    placed with margins, never a translate), shaped by `variant`. `plain` draws no card at all. */
export const dialogVariants = cva('group/dialog outline-none', {
  variants: {
    size: {
      default: '',
      lg: '',
    },
    variant: {
      /** As a sheet: attached to the bottom edge, like the kit's Sheet. */
      default: cn(
        dialogCard,
        'data-[presentation=sheet]:m-0 data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(12px,env(safe-area-inset-bottom))]',
      ),
      /** As a sheet: a tray floating `trayInset` (10px) in from the edges, with `--radius-sheet` corners: the same card as FloatingSheet at rest. */
      tray: cn(
        dialogCard,
        'data-[presentation=sheet]:mx-2.5 data-[presentation=sheet]:mt-0 data-[presentation=sheet]:mb-[max(10px,env(safe-area-inset-bottom))] data-[presentation=sheet]:w-auto',
      ),
      /** No card, no size cap, no entry scale or fade, no grabber: the content is entirely the caller's (placement
          included). For a surface that brings its own look and motion, such as a `Morph` the content renders. */
      plain: '',
    },
  },
  compoundVariants: [
    { variant: ['default', 'tray'], size: 'default', className: 'max-w-[400px]' },
    { variant: ['default', 'tray'], size: 'lg', className: 'max-w-[560px]' },
  ],
  defaultVariants: { size: 'default', variant: 'default' },
});

export type DialogContentProps<Payload = unknown> = Parameters<typeof SdkDialogContent<Payload>>[0] &
  VariantProps<typeof dialogVariants>;

/** The card. Name it with a DialogTitle, or `aria-label`. A sheet that can be dragged away shows a grabber; one that
    isn't `dismissible` doesn't. `variant="plain"` keeps the Dialog's focus, dismissal and theme scope but draws
    nothing: `<DialogContent variant="plain" render={<Morph layoutId="player" … />}>`. */
export function DialogContent<Payload = unknown>({
  className, style, size = 'default', variant = 'default', children, ...props
}: DialogContentProps<Payload>) {
  const scope = useThemeScopeProps();
  const { dismissible } = useSurfaceFlow();
  return (
    <SdkDialogContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      data-size={size}
      data-variant={variant}
      className={cx([dialogVariants({ size, variant }), scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {(state) => (
        <>
          {state.presentation === 'sheet' && dismissible && variant !== 'plain' ? (
            <span data-slot="dialog-grabber" aria-hidden="true" className={cn(sheetGrabberVariants(), 'absolute inset-x-0 top-0 z-3')} />
          ) : null}
          {typeof children === 'function' ? children(state) : children}
        </>
      )}
    </SdkDialogContent>
  );
}

export interface DialogHeaderProps extends ComponentProps<'div'>, VariantProps<typeof surfaceHeaderVariants> {}

/** The title and description, stacked (`default`), or the bar of a flow or tray (`bar`): DialogBack, DialogTitle and
    DialogClose in one row. */
export function DialogHeader({ className, variant = 'default', ...props }: DialogHeaderProps) {
  return (
    <SurfaceHeaderContext.Provider value={variant}>
      <div data-slot="dialog-header" data-variant={variant} className={cn(surfaceHeaderVariants({ variant }), className)} {...props} />
    </SurfaceHeaderContext.Provider>
  );
}

/** Names the dialog. In a stacked header it leaves room for the pinned ×; in a bar it takes the row's free width.
    When the root has a `view`, a new title travels in from the side its view comes from (the leaving one plays its
    exit), and long titles wrap rather than run under the ×. */
export function DialogTitle({ className, children, ...props }: ComponentProps<typeof SdkDialogTitle>) {
  const { view } = useSurfaceFlow();
  const header = useSurfaceHeader();
  const bar = header === 'bar';
  const base = cn(surfaceTitleVariants(), bar ? 'min-w-0 flex-1 py-px' : 'pe-8');
  if (view === undefined) {
    return <SdkDialogTitle className={cx(base, className)} {...props}>{children}</SdkDialogTitle>;
  }
  return (
    <SdkDialogTitle className={cx(base, className)} {...props}>
      {(state) => <SurfaceFlowTitle>{typeof children === 'function' ? children(state) : children}</SurfaceFlowTitle>}
    </SdkDialogTitle>
  );
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof SdkDialogDescription>) {
  return <SdkDialogDescription className={cx(surfaceDescriptionVariants(), className)} {...props} />;
}

/** Scrollable body between header and footer. */
export function DialogBody({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="dialog-body" className={cn(surfaceBodyVariants(), className)} {...props} />;
}

export interface DialogFooterProps extends ComponentProps<'div'>, VariantProps<typeof surfaceFooterVariants> {}

/** The card's actions: right-aligned (`horizontal`, the default) or stacked full width (`vertical`). Presented as a
    sheet (a compact, touch scope) the buttons are 44px tall and a horizontal row shares the width between them, as
    iOS does; the footer then ends at the same inset as a Sheet's. */
export function DialogFooter({ className, orientation = 'horizontal', ...props }: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      data-orientation={orientation}
      className={cn(
        surfaceFooterVariants({ orientation }),
        'group-data-[presentation=sheet]/dialog:*:h-11 group-data-[presentation=sheet]/dialog:group-data-[variant=default]/dialog:pb-2',
        orientation === 'horizontal' && 'group-data-[presentation=sheet]/dialog:*:flex-1',
        className,
      )}
      {...props}
    />
  );
}

/** Closes the dialog. On its own it is the round × (pinned to the card's top-end corner, or in the row of a
    `bar` header), left out while the dialog isn't `dismissible`; with children or `render` it is whatever you make
    it (`<DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>`), and closes even a dialog that
    isn't dismissible. A `value` is reported as `returnValue`, and an `action` runs first (a Promise it returns keeps
    the dialog open). */
export function DialogClose({ className, children, render, ...props }: ComponentProps<typeof SdkDialogClose>) {
  const { dismissible } = useSurfaceFlow();
  const header = useSurfaceHeader();
  if (children !== undefined || render !== undefined) {
    return <SdkDialogClose className={className} render={render} {...props}>{children}</SdkDialogClose>;
  }
  if (!dismissible) return null;
  return (
    <SdkDialogClose aria-label="Close" className={cx(closeButtonVariants({ layout: header === 'bar' ? 'inline' : 'pinned' }), className)} {...props}>
      <Icon name="x" size={15} sw={2.6} />
    </SdkDialogClose>
  );
}

export type DialogBackProps = Omit<ComponentProps<typeof SdkButton>, 'children'> & {
  /** Fold the chevron away (it shrinks out of the header and can't be reached). */
  hidden?: boolean;
  children?: ReactNode;
};

/** The back chevron of a `bar` header. It stays mounted and grows in or out with `hidden`, so the title slides over
    as it goes. Its `onClick` steps the root's `view` back. */
export function DialogBack({ hidden = false, className, 'aria-label': label = 'Back', children, ...props }: DialogBackProps) {
  return (
    <span
      data-slot="dialog-back"
      data-hidden={hidden || undefined}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className="-ms-1 grid w-[30px] shrink-0 place-items-center overflow-clip transition-[width,margin,opacity,scale] duration-spring-snappy ease-spring-snappy [overflow-clip-margin:7px] data-hidden:ms-0 data-hidden:-me-2.5 data-hidden:w-0 data-hidden:scale-40 data-hidden:opacity-0 motion-reduce:transition-none"
    >
      <SdkButton aria-label={label} className={cx(closeButtonVariants(), className)} {...props}>
        {children ?? <Icon name="chevL" size={15} sw={2.6} className="rtl:-scale-x-100" />}
      </SdkButton>
    </span>
  );
}

export interface DialogViewProps extends Omit<ComponentProps<typeof AnimatedHeight>, 'children' | 'spring'> {
  children?: ReactNode;
}

/** The current view of a flow. Changing the root's `view` slides to the new one in the direction of travel while the
    card springs to its height. A view taller than the card's room scrolls. When the view that held focus leaves,
    focus goes to the card (a control in the new view with `autoFocus` takes it as it mounts). Without a `view` on the
    root it still springs the card to its content's height as that changes (an error appearing). Sheet's SheetView is
    this part under a Sheet with a `view`. */
export function DialogView({ children, className, ...props }: DialogViewProps) {
  const { view, direction } = useSurfaceFlow();
  const key = view ?? '';
  const [recovery] = useState(() => createFocusRecovery<{ card: HTMLElement | null }>({ fallback: (lost) => lost.props.card }));
  const bind = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      return recovery.bind(el, { key: el.dataset.view ?? '', props: { card: el.closest<HTMLElement>('[data-slot=dialog-content],[data-slot=drawer-content]') } });
    },
    [recovery],
  );
  return (
    <AnimatedHeight spring="tray" className={cn('bl-scroll relative min-h-0 shrink overflow-y-auto', className)} {...props}>
      <Swap value={key} direction={direction} distance={40} blur={6}>
        <div ref={bind} data-slot="dialog-view" data-view={key} className="contents">{children}</div>
      </Swap>
    </AnimatedHeight>
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

/* The alert card settles from slightly larger, on the smooth spring. */
const alertDialogClass = cn(
  modalCard,
  'w-[270px] max-w-[calc(100%-48px)] duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 data-ending-style:opacity-0 motion-safe:data-starting-style:scale-[1.14] motion-safe:data-ending-style:scale-98',
);

export type AlertDialogContentProps<Payload = unknown> = Parameters<typeof SdkAlertDialogContent<Payload>>[0];

/** The alert card. Name it with an AlertDialogTitle. */
export function AlertDialogContent<Payload = unknown>({ className, style, ...props }: AlertDialogContentProps<Payload>) {
  const scope = useThemeScopeProps();
  return (
    <SdkAlertDialogContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      data-size="alert"
      className={cx([alertDialogClass, scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

export function AlertDialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-header" className={cn('flex flex-col gap-1 px-4 pt-5 pb-4 text-center', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof SdkAlertDialogTitle>) {
  return <SdkAlertDialogTitle className={cx(surfaceTitleVariants({ size: 'sm' }), className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: ComponentProps<typeof SdkAlertDialogDescription>) {
  return <SdkAlertDialogDescription className={cx(cn(surfaceDescriptionVariants({ size: 'sm' }), 'text-foreground'), className)} {...props} />;
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
        // The answers round into the card's bottom corners, so an inset focus ring follows the curve the card clips to.
        orientation === 'vertical'
          ? 'flex-col [&>*+*]:shadow-hairline-t [&>*:last-child]:rounded-b-sheet'
          : '[&>*]:flex-1 [&>*+*]:shadow-[inset_1px_0_0_var(--border)] [&>*:first-child]:rounded-es-sheet [&>*:last-child]:rounded-ee-sheet',
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
      },
      /** The answer's semantic colour: `destructive` is the red answer (Delete, Erase). */
      tone: {
        default: '',
        destructive: 'text-destructive',
      },
    },
    defaultVariants: { variant: 'default', tone: 'default' },
  },
);

export type AlertDialogCloseProps = ComponentProps<typeof SdkAlertDialogClose> & VariantProps<typeof alertDialogCloseVariants>;

/** An answer: an iOS alert button that closes the alert. Give the agreeing one `value="confirm"` (it is the
    `returnValue`, and what `createConfirm` resolves `true` for); an `action` runs before it closes, and a Promise it
    returns keeps the alert open, the button pending, until it settles. */
export function AlertDialogClose({ className, variant, tone, ...props }: AlertDialogCloseProps) {
  return <SdkAlertDialogClose className={cx(alertDialogCloseVariants({ variant, tone }), className)} {...props} />;
}
