'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
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
import { cn, cx } from '@/lib/utils';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { useMountPresentationKey, usePresentation } from '@/lib/container';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Swap } from '@/components/ui/swap';

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
         <AlertDialogClose variant="destructive" value="confirm">Delete</AlertDialogClose>
       </AlertDialogFooter>
     </AlertDialogContent>
   </AlertDialog>

   The header, title, description, body, footer and close-button recipes below are the kit's surface parts: Sheet
   and the other modal surfaces build their own parts from them. ══ */

export { DialogTrigger, createDialogController } from '@ui-sdk/react/dialog';
export type { DialogController } from '@ui-sdk/react/dialog';
export { AlertDialogTrigger, createAlertDialogController, createConfirm } from '@ui-sdk/react/alert-dialog';
export type { AlertDialogController } from '@ui-sdk/react/alert-dialog';

/* ── Surface parts: shared by every modal surface ── */

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

/** A surface's title: `default` for dialogs and sheets, `sm` for alerts and compact cards. */
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

/* ── Dialog ── */

interface DialogFlow {
  /** The root's `view`; undefined for a dialog that isn't a flow. */
  view: string | undefined;
  /** Travel of the last view change: 1 forward, -1 back (a view seen before), 0 none. */
  direction: -1 | 0 | 1;
  dismissible: boolean;
}
const DialogFlowContext = createContext<DialogFlow>({ view: undefined, direction: 0, dismissible: true });
const DialogHeaderContext = createContext<'default' | 'bar' | null>(null);

/** The direction of each change of `view`: revisiting a view in the trail is going back. */
function useViewDirection(view: string | undefined): -1 | 0 | 1 {
  const trail = useRef<string[]>(view === undefined ? [] : [view]);
  const last = useRef<{ view: string | undefined; direction: -1 | 0 | 1 }>({ view, direction: 0 });
  if (last.current.view !== view && view !== undefined) {
    const at = trail.current.indexOf(view);
    if (at >= 0) {
      trail.current = trail.current.slice(0, at + 1);
      last.current = { view, direction: -1 };
    } else {
      trail.current = [...trail.current, view];
      last.current = { view, direction: 1 };
    }
  }
  return last.current.direction;
}

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
  const direction = useViewDirection(view);
  const flow = useMemo(() => ({ view, direction, dismissible }), [view, direction, dismissible]);
  return (
    <DialogFlowContext.Provider value={flow}>
      <SdkDialog key={key} container={container === undefined ? host : container} presentation={shown} dismissible={dismissible} {...props} />
    </DialogFlowContext.Provider>
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

/** The Dialog's card. Centered it grows out of the middle on the snappy spring; as a sheet UI SDK moves it (so it is
    placed with margins, never a translate), shaped by `variant`. */
export const dialogVariants = cva(
  cn(
    modalCard,
    'group/dialog w-[calc(100%-48px)] duration-spring-snappy ease-spring-snappy',
    'not-data-[presentation=sheet]:data-starting-style:opacity-0 not-data-[presentation=sheet]:data-ending-style:opacity-0 motion-safe:not-data-[presentation=sheet]:data-starting-style:scale-90 motion-safe:not-data-[presentation=sheet]:data-ending-style:scale-96',
    'data-[presentation=sheet]:relative data-[presentation=sheet]:inset-auto data-[presentation=sheet]:max-w-none data-[presentation=sheet]:transition-none',
  ),
  {
    variants: {
      size: {
        default: 'max-w-[400px]',
        lg: 'max-w-[560px]',
      },
      variant: {
        /** As a sheet: attached to the bottom edge, like the kit's Sheet. */
        default:
          'data-[presentation=sheet]:m-0 data-[presentation=sheet]:w-full data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(12px,env(safe-area-inset-bottom))]',
        /** As a sheet: a tray floating inset from the edges. */
        tray: 'data-[presentation=sheet]:mx-2.5 data-[presentation=sheet]:mt-0 data-[presentation=sheet]:mb-[max(10px,env(safe-area-inset-bottom))] data-[presentation=sheet]:w-auto',
      },
    },
    defaultVariants: { size: 'default', variant: 'default' },
  },
);

export type DialogContentProps<Payload = unknown> = Parameters<typeof SdkDialogContent<Payload>>[0] &
  VariantProps<typeof dialogVariants>;

/** The card. Name it with a DialogTitle, or `aria-label`. A sheet that can be dragged away shows a grabber; one that
    isn't `dismissible` doesn't. */
export function DialogContent<Payload = unknown>({
  className, style, size = 'default', variant = 'default', children, ...props
}: DialogContentProps<Payload>) {
  const scope = useThemeScopeProps();
  const { dismissible } = useContext(DialogFlowContext);
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
          {state.presentation === 'sheet' && dismissible ? (
            <span data-slot="dialog-grabber" aria-hidden="true" className="absolute top-[5px] left-1/2 z-3 h-[5px] w-9 -translate-x-1/2 rounded-full bg-secondary-strong" />
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
    <DialogHeaderContext.Provider value={variant}>
      <div data-slot="dialog-header" data-variant={variant} className={cn(surfaceHeaderVariants({ variant }), className)} {...props} />
    </DialogHeaderContext.Provider>
  );
}

/** Names the dialog. In a stacked header it leaves room for the pinned ×; in a bar it takes the row's free width.
    When the root has a `view`, a new title travels in from the side its view comes from (the leaving one plays its
    exit), and long titles wrap rather than run under the ×. */
export function DialogTitle({ className, children, ...props }: ComponentProps<typeof SdkDialogTitle>) {
  const { view, direction } = useContext(DialogFlowContext);
  const header = useContext(DialogHeaderContext);
  const bar = header === 'bar';
  const base = cn(surfaceTitleVariants(), bar ? 'min-w-0 flex-1 py-px' : 'pe-8');
  if (view === undefined) {
    return <SdkDialogTitle className={cx(base, className)} {...props}>{children}</SdkDialogTitle>;
  }
  const key = typeof children === 'string' || typeof children === 'number' ? String(children) : view;
  return (
    <SdkDialogTitle className={cx(base, className)} {...props}>
      {(state) => (
        <Swap value={key} direction={direction} distance={18} blur={3} inline className="grid w-full overflow-x-clip [overflow-clip-margin:8px]">
          <span className="justify-self-start">{typeof children === 'function' ? children(state) : children}</span>
        </Swap>
      )}
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
    sheet, a horizontal row shares the width between its buttons, as iOS does. */
export function DialogFooter({ className, orientation = 'horizontal', ...props }: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      data-orientation={orientation}
      className={cn(surfaceFooterVariants({ orientation }), orientation === 'horizontal' && 'group-data-[presentation=sheet]/dialog:*:flex-1', className)}
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
  const { dismissible } = useContext(DialogFlowContext);
  const header = useContext(DialogHeaderContext);
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
      className="-ms-1 grid w-[30px] shrink-0 place-items-center overflow-clip transition-[width,margin,opacity,scale] duration-spring-snappy ease-spring-snappy [overflow-clip-margin:4px] data-hidden:ms-0 data-hidden:-me-2.5 data-hidden:w-0 data-hidden:scale-40 data-hidden:opacity-0 motion-reduce:transition-none"
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
    focus goes to the card (a control in the new view with `autoFocus` takes it as it mounts). */
export function DialogView({ children, className, ...props }: DialogViewProps) {
  const { view, direction } = useContext(DialogFlowContext);
  const key = view ?? '';
  const [recovery] = useState(() => createFocusRecovery<{ card: HTMLElement | null }>({ fallback: (lost) => lost.props.card }));
  const bind = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      return recovery.bind(el, { key: el.dataset.view ?? '', props: { card: el.closest<HTMLElement>('[data-slot=dialog-content]') } });
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
