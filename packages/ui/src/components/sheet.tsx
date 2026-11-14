'use client';
import { createContext, useContext, type ComponentProps } from 'react';
import {
  Drawer as SdkDrawer,
  DrawerBackdrop as SdkDrawerBackdrop,
  DrawerClose as SdkDrawerClose,
  DrawerContent as SdkDrawerContent,
  DrawerDescription as SdkDrawerDescription,
  DrawerHandle as SdkDrawerHandle,
  DrawerTitle as SdkDrawerTitle,
} from '@ui-sdk/react/drawer';
import { cva } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { springs } from '@/lib/motion';
import { focusRing } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { DialogBody, DialogHeader, closeButtonVariants, surfaceDescriptionVariants, surfaceTitleVariants } from '@/components/ui/dialog';

/* ══ Sheet — UI SDK's Drawer as the kit's edge-pinned modal ══
   Bottom is the iOS card sheet with a grabber; left and right are side panels; top drops down. UI SDK owns the
   behavior: the sheet follows a drag and springs back or away, rests on `snapPoints`, and has a dialog's focus trap,
   Esc, outside press and focus return. It renders into BLProvider's root (see `useLayerHost`), so it slides inside
   the app's frame; `contained` keeps it inside its positioned parent instead (a layer host of its own), the way
   AdaptivePane's drawer and Sidebar's overlay use it. Inside: SheetHeader / SheetTitle / SheetDescription /
   SheetBody / SheetFooter / SheetClose; `SheetContent variant="panel"` is a full-height edge panel without chrome.
   <Sheet side="bottom">
     <SheetTrigger className={buttonVariants({ variant: 'secondary' })}>Filters</SheetTrigger>
     <SheetBackdrop />
     <SheetContent>…</SheetContent>
   </Sheet> ══ */

export { DrawerTrigger as SheetTrigger, createDrawerController as createSheetController } from '@ui-sdk/react/drawer';
export type { DrawerController as SheetController } from '@ui-sdk/react/drawer';

/* The kit's tray spring (`springs.tray`) in the terms UI SDK's sheet takes: its period and its damping ratio. */
const { stiffness, damping, mass } = springs.tray;
const trayPhysics = {
  response: (2 * Math.PI) / Math.sqrt(stiffness / mass),
  dampingRatio: damping / (2 * Math.sqrt(stiffness * mass)),
};

/* Whether the sheet has more than one place to rest, which makes its grabber a handle. */
const SheetResizableContext = createContext(false);

export type SheetProps = ComponentProps<typeof SdkDrawer> & {
  /** Keep the sheet inside its positioned parent rather than BLProvider's root: the Sheet renders a layer host
   *  (`absolute inset-0`, `contain: layout`, `z-index: var(--sheet-z, 30)`) that its scrim, panel and focus trap
   *  stay in, so the rest of the page outside that box stays usable. Default false. */
  contained?: boolean;
};

/** The root: `side` (bottom by default), `snapPoints`, `contained`, and a dialog's `open` / `onOpenChange` /
    `dismissible` / `modal`. */
export function Sheet({ container, physics, snapPoints, contained = false, ...props }: SheetProps) {
  const host = useLayerHost();
  const sheet = (
    <SheetResizableContext.Provider value={(snapPoints?.length ?? 0) > 1}>
      <SdkDrawer
        // Contained, the sheet renders in place: the host below is its box. A contained panel sits on an edge of
        // the page, where iOS Safari's back swipe would otherwise start.
        container={contained ? null : container === undefined ? host : container}
        preventEdgeSwipe={contained || undefined}
        physics={{ ...trayPhysics, ...physics }}
        snapPoints={snapPoints}
        {...props}
      />
    </SheetResizableContext.Provider>
  );
  if (!contained) return sheet;
  // A layer host (UI SDK's `data-layer-host`, with the `contain: layout` it needs), marked in the markup, so a
  // sheet open on the first render is already contained. It lets presses through where the sheet isn't.
  return (
    <div data-slot="sheet-host" data-layer-host="" className="pointer-events-none absolute inset-0 z-[var(--sheet-z,30)] overflow-clip [contain:layout]">
      {sheet}
    </div>
  );
}

/** Scrim behind the sheet. The sheet drives its opacity as it moves, so it has no fade of its own. */
export function SheetBackdrop({ className, style, ...props }: ComponentProps<typeof SdkDrawerBackdrop>) {
  const scope = useThemeScopeProps();
  return (
    <SdkDrawerBackdrop
      data-theme-scope={scope['data-theme-scope']}
      className={cx(['pointer-events-auto fixed inset-0 bg-overlay', scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

/* The panel, by its look and the edge it comes from. UI SDK places and moves it (leave `translate` alone); the strip
   past its edge covers the gap a drag beyond its largest size would open. */
export const sheetVariants = cva(
  "pointer-events-auto relative box-border flex flex-col shadow-[0_0_40px_black] shadow-black/22 outline-none after:absolute after:bg-inherit after:content-[''] data-dragging:select-none",
  {
    variants: {
      /** `card`: the modal sheet (rounded on its free edges, a grabber on the bottom one). `panel`: a full-length
       *  edge panel with no chrome of its own, flush with its edge and divided from the page by a hairline
       *  (a drawer of navigation or an inspector). */
      variant: {
        card: 'bg-card text-card-foreground',
        panel: 'bg-background text-foreground',
      },
      side: {
        bottom: 'max-h-[calc(100%-48px)] w-full pb-[max(12px,env(safe-area-inset-bottom))] after:inset-x-0 after:top-full after:h-24',
        top: 'max-h-[calc(100%-48px)] w-full pt-(--bl-safe-top) after:inset-x-0 after:bottom-full after:h-24',
        left: 'mr-auto h-full w-[85%] max-w-[360px] after:inset-y-0 after:right-full after:w-24',
        right: 'ml-auto h-full w-[85%] max-w-[360px] after:inset-y-0 after:left-full after:w-24',
      },
    },
    compoundVariants: [
      { variant: 'card', side: 'bottom', class: 'rounded-t-sheet' },
      { variant: 'card', side: 'top', class: 'rounded-b-sheet' },
      { variant: 'card', side: 'left', class: 'rounded-r-sheet' },
      { variant: 'card', side: 'right', class: 'rounded-l-sheet' },
      { variant: 'panel', side: 'bottom', class: 'border-t border-border' },
      { variant: 'panel', side: 'top', class: 'border-b border-border' },
      { variant: 'panel', side: 'left', class: 'w-80 max-w-[85%] border-r border-border' },
      { variant: 'panel', side: 'right', class: 'w-80 max-w-[85%] border-l border-border' },
    ],
    defaultVariants: { variant: 'card', side: 'bottom' },
  },
);

/** The grabber's look: a pill centred at the top of a bottom sheet. `handle` adds a press target around it. */
export const sheetGrabberVariants = cva('mx-auto mt-[5px] mb-px block h-[5px] w-9 shrink-0 rounded-full bg-secondary-strong', {
  variants: {
    handle: {
      true: cn('relative cursor-grab border-0 p-0 after:absolute after:-inset-x-4 after:-inset-y-3 active:cursor-grabbing', focusRing),
      false: '',
    },
  },
  defaultVariants: { handle: false },
});

export type SheetContentProps<Payload = unknown> = Parameters<typeof SdkDrawerContent<Payload>>[0] & {
  /** `card` (default): the modal sheet. `panel`: a full-length edge panel whose children are the whole panel. */
  variant?: 'card' | 'panel';
  /** Show the grabber on bottom cards (default true). With more than one snap point it is a SheetHandle. */
  grabber?: boolean;
  /** Whether a drag of the sheet toward its edge closes it (default true). `false` keeps Escape and the scrim,
   *  and the sheet no longer follows the finger (UI SDK's `data-drawer-no-drag`). */
  swipe?: boolean;
  /** Spring the sheet's height when its content changes (a tray stepping through a flow). Use for short,
      content-sized trays; a sheet that scrolls its body should leave this off. */
  animateHeight?: boolean;
};

/** The sheet. Name it with a SheetTitle, or `aria-label`. */
export function SheetContent<Payload = unknown>({
  className, style, children, variant = 'card', grabber = true, swipe = true, animateHeight, ...props
}: SheetContentProps<Payload>) {
  const scope = useThemeScopeProps();
  const resizable = useContext(SheetResizableContext);
  return (
    <SdkDrawerContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      data-variant={variant}
      data-drawer-no-drag={swipe ? undefined : ''}
      className={(state) => cn(sheetVariants({ variant, side: state.side }), scope.className, typeof className === 'function' ? className(state) : className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {(state) => {
        const content = typeof children === 'function' ? children(state) : children;
        // A panel's children are the whole panel: its own classes lay them out.
        if (variant === 'panel') return content;
        const showGrabber = state.side === 'bottom' && grabber;
        return (
          <>
            {showGrabber && !resizable ? <span data-slot="sheet-grabber" aria-hidden="true" className={sheetGrabberVariants()} /> : null}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {animateHeight ? <AnimatedHeight>{content}</AnimatedHeight> : content}
            </div>
            {/* After the content in the tab order (focus lands on the sheet's own controls first), first on screen. */}
            {showGrabber && resizable ? <SheetHandle className="order-first" /> : null}
          </>
        );
      }}
    </SdkDrawerContent>
  );
}

/** The grabber of a sheet with `snapPoints`: a press moves to the next one, and the arrow keys, Home and End step
    through them. SheetContent renders it for you; place your own with `grabber={false}`. */
export function SheetHandle({ className, 'aria-label': label = 'Resize', ...props }: ComponentProps<typeof SdkDrawerHandle>) {
  return <SdkDrawerHandle aria-label={label} className={cx(sheetGrabberVariants({ handle: true }), className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SdkDrawerTitle>) {
  return <SdkDrawerTitle className={cx(cn(surfaceTitleVariants(), 'pe-8'), className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof SdkDrawerDescription>) {
  return <SdkDrawerDescription className={cx(surfaceDescriptionVariants(), className)} {...props} />;
}

/** Closes the sheet. On its own it is the round × pinned to the top-right corner; with children or `render` it is
    whatever you make it (`<SheetClose render={<Button size="pill" />}>Apply</SheetClose>`). */
export function SheetClose({ className, children, render, ...props }: ComponentProps<typeof SdkDrawerClose>) {
  if (children !== undefined || render !== undefined) {
    return <SdkDrawerClose className={className} render={render} {...props}>{children}</SdkDrawerClose>;
  }
  return (
    <SdkDrawerClose aria-label="Close" className={cx(closeButtonVariants({ layout: 'pinned' }), className)} {...props}>
      <Icon name="x" size={15} sw={2.6} />
    </SdkDrawerClose>
  );
}

/** The title block: Dialog's header look, under its own slot. */
export function SheetHeader(props: ComponentProps<'div'>) {
  return <DialogHeader data-slot="sheet-header" {...props} />;
}

/** The scrolling body between the header and the footer: Dialog's body look, under its own slot. */
export function SheetBody(props: ComponentProps<'div'>) {
  return <DialogBody data-slot="sheet-body" {...props} />;
}

/** Pinned bottom area for a sheet's actions. */
export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 px-5 pt-3 pb-2', className)} {...props} />;
}
