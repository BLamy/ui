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
import { DialogBody, DialogHeader, dialogCloseClass, dialogDescriptionClass, dialogTitleClass } from '@/components/ui/dialog';

/* ══ Sheet — UI SDK's Drawer as the kit's edge-pinned modal ══
   Bottom is the iOS card sheet with a grabber; left and right are side panels; top drops down. UI SDK owns the
   behavior: the sheet follows a drag and springs back or away, rests on `snapPoints`, and has a dialog's focus trap,
   Esc, outside press and focus return. It renders into BLProvider's root (see `useLayerHost`), so it slides inside
   the app's frame. Inside: SheetHeader / SheetTitle / SheetDescription / SheetBody / SheetFooter / SheetClose.
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

export type SheetProps = ComponentProps<typeof SdkDrawer>;

/** The root: `side` (bottom by default), `snapPoints`, and a dialog's `open` / `onOpenChange` / `dismissible` /
    `modal`. */
export function Sheet({ container, physics, snapPoints, ...props }: SheetProps) {
  const host = useLayerHost();
  return (
    <SheetResizableContext.Provider value={(snapPoints?.length ?? 0) > 1}>
      <SdkDrawer
        container={container === undefined ? host : container}
        physics={{ ...trayPhysics, ...physics }}
        snapPoints={snapPoints}
        {...props}
      />
    </SheetResizableContext.Provider>
  );
}

/** Scrim behind the sheet. The sheet drives its opacity as it moves, so it has no fade of its own. */
export function SheetBackdrop({ className, style, ...props }: ComponentProps<typeof SdkDrawerBackdrop>) {
  const scope = useThemeScopeProps();
  return (
    <SdkDrawerBackdrop
      data-theme-scope={scope['data-theme-scope']}
      className={cx(['fixed inset-0 bg-overlay', scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    />
  );
}

/* The panel, by the edge it comes from. UI SDK places and moves it (leave `translate` alone); the strip past its
   edge covers the gap a drag beyond its largest size would open. */
export const sheetVariants = cva(
  "relative box-border flex flex-col bg-card text-card-foreground shadow-[0_0_40px_black] shadow-black/22 outline-none after:absolute after:bg-inherit after:content-[''] data-dragging:select-none",
  {
    variants: {
      side: {
        bottom: 'max-h-[calc(100%-48px)] w-full rounded-t-card pb-[max(12px,env(safe-area-inset-bottom))] after:inset-x-0 after:top-full after:h-24',
        top: 'max-h-[calc(100%-48px)] w-full rounded-b-card pt-(--bl-safe-top) after:inset-x-0 after:bottom-full after:h-24',
        left: 'mr-auto h-full w-[85%] max-w-[360px] rounded-r-card after:inset-y-0 after:right-full after:w-24',
        right: 'ml-auto h-full w-[85%] max-w-[360px] rounded-l-card after:inset-y-0 after:left-full after:w-24',
      },
    },
    defaultVariants: { side: 'bottom' },
  },
);

export type SheetContentProps<Payload = unknown> = Parameters<typeof SdkDrawerContent<Payload>>[0] & {
  /** Show the grabber on bottom sheets (default true). With more than one snap point it is a SheetHandle. */
  grabber?: boolean;
  /** Spring the sheet's height when its content changes (a tray stepping through a flow). Use for short,
      content-sized trays; a sheet that scrolls its body should leave this off. */
  animateHeight?: boolean;
};

const grabberClass = 'mx-auto mt-[5px] mb-px block h-[5px] w-9 shrink-0 rounded-full bg-secondary-strong';

/** The sheet. Name it with a SheetTitle, or `aria-label`. */
export function SheetContent<Payload = unknown>({ className, style, children, grabber = true, animateHeight, ...props }: SheetContentProps<Payload>) {
  const scope = useThemeScopeProps();
  const resizable = useContext(SheetResizableContext);
  return (
    <SdkDrawerContent<Payload>
      data-theme-scope={scope['data-theme-scope']}
      className={(state) => cn(sheetVariants({ side: state.side }), scope.className, typeof className === 'function' ? className(state) : className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {(state) => {
        const content = typeof children === 'function' ? children(state) : children;
        return (
          <>
            {state.side === 'bottom' && grabber ? (
              resizable ? <SheetHandle /> : <span data-slot="sheet-grabber" aria-hidden="true" className={grabberClass} />
            ) : null}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {animateHeight ? <AnimatedHeight>{content}</AnimatedHeight> : content}
            </div>
          </>
        );
      }}
    </SdkDrawerContent>
  );
}

/** The grabber of a sheet with `snapPoints`: a press moves to the next one, and the arrow keys, Home and End step
    through them. SheetContent renders it for you; place your own with `grabber={false}`. */
export function SheetHandle({ className, 'aria-label': label = 'Resize', ...props }: ComponentProps<typeof SdkDrawerHandle>) {
  return (
    <SdkDrawerHandle
      aria-label={label}
      className={cx([grabberClass, 'relative cursor-grab border-0 p-0 after:absolute after:-inset-x-4 after:-inset-y-3 active:cursor-grabbing', focusRing], className)}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SdkDrawerTitle>) {
  return <SdkDrawerTitle className={cx(dialogTitleClass, className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof SdkDrawerDescription>) {
  return <SdkDrawerDescription className={cx(dialogDescriptionClass, className)} {...props} />;
}

/** Closes the sheet. On its own it is the round × pinned to the top-right corner; with children or `render` it is
    whatever you make it (`<SheetClose render={<Button size="pill" />}>Apply</SheetClose>`). */
export function SheetClose({ className, children, render, ...props }: ComponentProps<typeof SdkDrawerClose>) {
  if (children !== undefined || render !== undefined) {
    return <SdkDrawerClose className={className} render={render} {...props}>{children}</SdkDrawerClose>;
  }
  return (
    <SdkDrawerClose aria-label="Close" className={cx(dialogCloseClass, className)} {...props}>
      <Icon name="x" size={15} sw={2.6} />
    </SdkDrawerClose>
  );
}

/** Pinned bottom area for a sheet's actions. */
export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 px-5 pt-3 pb-2', className)} {...props} />;
}

/* The header and the scrolling body are the dialog's. */
export const SheetHeader = DialogHeader;
export const SheetBody = DialogBody;
