'use client';
import { use, type CSSProperties, type ReactNode } from 'react';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { cva } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { BLSafeCtx } from '@/lib/theme';
import { cn, BARH } from '@/lib/utils';
import { SizeClassProvider } from '@/lib/container';
import { EdgeDrawer, useKeptChildren } from '@/components/ui/edge-drawer';
import { sideDrawer, type SideDrawerOptions, type SideDrawerPresentation } from '@/lib/side-drawer-primitive';
import type { SizeClass } from '@/lib/size-class';

export { createSideDrawerController, sideDrawerPresentation } from '@/lib/side-drawer-primitive';
export type {
  SideDrawerController,
  SideDrawerOpenChangeDetails,
  SideDrawerOpenChangeReason,
  SideDrawerPresentation,
} from '@/lib/side-drawer-primitive';

/* ══ SideDrawer — one panel, three hosts ══
   presentation="fixed": docks as a column beside the detail view (extra-wide). presentation="overlay": a sheet
   from the trailing edge over the host, UI SDK's Drawer (scrim press, Escape and a swipe toward the edge dismiss it).
   presentation="push": the panel takes the whole host and slides in from the trailing edge exactly as a
   NavigationStack screen does: the page before it parallaxes away and dims, and a back button, Escape and an edge
   swipe pop it with the same springs. "auto" (the default) is the overlay, and the push while the host is compact
   (narrower than `breakpoint`). The children stay mounted when the presentation changes. */

/** The root, by presentation: the fixed column (its width springs between 0 and `width`), or a layer over the
 *  host for the overlay and the push. */
export const sideDrawerVariants = cva('', {
  variants: {
    presentation: {
      fixed: 'w-(--side-drawer-w) shrink-0 overflow-hidden bg-background transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
      overlay: 'pointer-events-none absolute inset-0 z-350',
      push: 'pointer-events-none absolute inset-0 z-350',
    },
  },
});

const { Dim, Panel, Bar, Back, Close } = createParts(sideDrawer, {
  dim: 'div',
  panel: 'section',
  bar: 'div',
  back: 'button',
  close: 'button',
});

export interface SideDrawerProps extends SideDrawerOptions {
  title?: ReactNode;
  /** The column's and the overlay's width, px. Default 320. */
  width?: number;
  /** The pushed page's back label (what it returns to). Default "Back". */
  backLabel?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

type RootState = { open: boolean; presentation: Exclude<SideDrawerPresentation, 'auto'>; sizeClass: SizeClass | undefined };

export function SideDrawer({
  open, defaultOpen, onOpenChange, presentation, breakpoint, controller, title, width, backLabel = 'Back', children,
  className, style,
}: SideDrawerProps) {
  width = width || 320;
  const handle = usePrimitive(sideDrawer, { open, defaultOpen, onOpenChange, presentation, breakpoint, controller } as SideDrawerOptions);
  const { api } = handle;
  const kept = useKeptChildren(children);
  const name = typeof title === 'string' ? title : undefined;
  const head = (
    <div className="flex shrink-0 items-center justify-between px-[14px] pt-[13px] pb-1.5">
      <span className="text-[16.5px] font-bold tracking-[-.2px] whitespace-nowrap">{title}</span>
      <Close type="button" aria-label={'Close ' + (name ?? 'panel')}
        className="bl-btn grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground">
        <Icon name="x" size={14} sw={2.6} />
      </Close>
    </div>
  );
  const body = <div ref={kept.dock} className="bl-scroll min-h-0 flex-1 overflow-y-auto">{kept.inline}</div>;
  const content = ({ open: isOpen, presentation: shown }: RootState): ReactNode => {
    if (shown === 'fixed') return <div className="box-border flex h-full w-(--side-drawer-w) flex-col">{head}{body}</div>;
    if (shown === 'overlay') {
      return (
        <EdgeDrawer side="end" open={isOpen} zIndex={0} width={`min(${width}px, 88%)`} aria-label={name ?? 'Panel'}
          onOpenChange={(next, details) => { if (!api.setOpen(next, details)) details.cancel(); }}
          backdropClassName="bg-overlay"
          className="flex flex-col [border-inline-start:1px_solid_var(--border)] bg-background shadow-[-16px_0_48px_black] shadow-black/25">
          {head}{body}
        </EdgeDrawer>
      );
    }
    return <SideDrawerPush open={isOpen} title={title} backLabel={backLabel}>{body}</SideDrawerPush>;
  };
  return usePart(handle, 'root', {}, {
    className: ({ open: isOpen, presentation: shown }: RootState) => cn(
      'group/side-drawer',
      sideDrawerVariants({ presentation: shown }),
      shown === 'fixed' && (isOpen ? '[border-inline-start:1px_solid_var(--border)]' : 'w-0'),
      className,
    ),
    style: { '--side-drawer-w': width + 'px', ...style } as CSSProperties,
    // With `presentation="auto"` the host's measured size class is the scope of the drawer's content, popups included.
    children: (state: RootState) => (
      <SizeClassProvider value={state.sizeClass}>
        {kept.portal}{content(state)}
      </SizeClassProvider>
    ),
  }, 'div');
}

/** Put on the page under a pushed SideDrawer (an element before it in the same host) so it parallaxes away and
 *  follows a swipe as a NavigationStack screen's page does. It reads the host's `--side-drawer-under`. */
export const sideDrawerPageClass = cn(
  'translate-x-[calc(var(--side-drawer-under,0)*-28%*var(--stack-dir,1))] transition-[translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none rtl:[--stack-dir:-1]',
  '[[data-side-drawer-swiping]>&]:transition-none',
  '[[data-side-drawer-settling]>&]:duration-spring-tray [[data-side-drawer-settling]>&]:ease-spring-tray',
);

/* ── The push ──
   The panel is a NavigationStack screen pushed over the host's page: it waits just past the trailing edge, enters on
   the smooth spring, and the page under it (opted in with `sideDrawerPageClass`) parallaxes under a dim. An edge
   swipe scrubs all three with the finger (`data-swiping`, `--stack-progress`, `--side-drawer-progress`,
   `--side-drawer-under`) and, released, all three settle on the tray spring (`data-swipe-settling`). */

function SideDrawerPush({ open, title, backLabel, children }: { open: boolean; title?: ReactNode; backLabel: ReactNode; children: ReactNode }) {
  const safeTop = use(BLSafeCtx);
  return (
    <>
      <Dim
        className={cn(
          'absolute inset-0 bg-black transition-opacity duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
          open ? 'pointer-events-auto opacity-12' : 'pointer-events-none opacity-0',
          'group-data-swiping/side-drawer:opacity-[calc(.12*(1-var(--side-drawer-progress,0)))] group-data-swiping/side-drawer:transition-none',
          'group-data-swipe-settling/side-drawer:duration-spring-tray group-data-swipe-settling/side-drawer:ease-spring-tray',
        )} />
      <Panel aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'pointer-events-auto absolute inset-0 flex touch-pan-y flex-col overflow-hidden bg-background shadow-[-10px_0_30px_black] shadow-black/16 outline-none will-change-transform',
          // Offsets are times `--stack-dir` (-1 right to left): it enters from the trailing edge, swipes from the leading one.
          'rtl:[--stack-dir:-1] rtl:shadow-[10px_0_30px_black]',
          'transition-[translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
          'data-starting-style:translate-x-[calc(103%*var(--stack-dir,1))] data-ending-style:translate-x-[calc(103%*var(--stack-dir,1))] data-ending-style:pointer-events-none',
          'data-swiping:translate-x-[calc(var(--stack-progress)*100%*var(--stack-dir,1))] data-swiping:transition-none',
          'data-swipe-settling:duration-spring-tray data-swipe-settling:ease-spring-tray',
        )}
        style={{ '--side-drawer-bar-h': safeTop + BARH + 'px', '--side-drawer-safe-top': safeTop + 'px' } as CSSProperties}>
        {/* The bar: a NavigationStack screen's — back on the leading edge, the title centred. */}
        <Bar
          className="relative box-border flex h-(--side-drawer-bar-h) shrink-0 items-end px-1.5 pt-(--side-drawer-safe-top) [border-bottom:1px_solid_var(--border)] bg-background/86 backdrop-blur-[18px] backdrop-saturate-[1.7]">
          <div className="flex h-toolbar w-full items-center">
            <Back type="button" aria-label={typeof backLabel === 'string' ? backLabel : 'Back'}
              className="bl-btn relative z-1 flex max-w-[30%] cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-body text-primary">
              <Icon name="chevL" size={24} sw={2.4} className="rtl:-scale-x-100" />
              <span className="truncate">{backLabel}</span>
            </Back>
            <div className="pointer-events-none absolute left-1/2 max-w-[52%] -translate-x-1/2 truncate text-body font-semibold text-foreground">{title}</div>
          </div>
        </Bar>
        {children}
      </Panel>
    </>
  );
}
