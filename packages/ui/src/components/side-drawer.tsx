import { use, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { springCss } from '@/lib/motion';
import { BLSafeCtx } from '@/lib/theme';
import { cn, BARH } from '@/lib/utils';
import { EdgeDrawer } from '@/components/ui/edge-drawer';
import { navigationPush } from '@/components/ui/navigation-stack';

/* ══ SideDrawer — one panel, three hosts ══
   mode="fixed": docks as a column beside the detail view (extra-wide). mode="overlay": shadcn-style sheet from
   the right, scrim click dismisses (desktop/tablet) — an EdgeDrawer configuration. In a compact host (a phone)
   the overlay becomes a push: the panel takes the whole host and slides in from the trailing edge exactly as a
   NavigationStack screen does — the page before it parallaxes away and dims, a back button and an edge swipe pop
   it with the same springs. */

/** The fixed column (its width springs between 0 and `width`). The overlay host is an EdgeDrawer. */
export const sideDrawerVariants = cva('', {
  variants: {
    mode: {
      fixed: 'w-(--side-drawer-w) shrink-0 overflow-hidden bg-background transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
      overlay: 'absolute inset-0 z-350 pointer-events-none',
    },
  },
});

export interface SideDrawerProps extends VariantProps<typeof sideDrawerVariants> {
  mode: 'fixed' | 'overlay';
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  width?: number;
  /**
   * Present the overlay as a pushed page (full width, NavigationStack's push, back button, edge swipe to pop).
   * Defaults to whether the host is narrower than `compactBreakpoint`. Ignored in `fixed` mode.
   */
  compact?: boolean;
  /** Host width below which the overlay becomes a push, when `compact` is unset. Default 520. */
  compactBreakpoint?: number;
  /** The pushed page's back label (what it returns to). Default "Back". */
  backLabel?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function SideDrawer({
  mode, open, onClose, title, width, compact: compactProp, compactBreakpoint = 520, backLabel = 'Back', children, className, style,
}: SideDrawerProps) {
  width = width || 320;
  // The overlay root fills the host, so its width is the host's. Measured through a callback ref: the root only
  // exists in overlay mode, and a host can switch from `fixed` to `overlay` at any time.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const [hostWidth, setHostWidth] = useState(Infinity);
  useLayoutEffect(() => {
    if (!hostEl) return undefined;
    const apply = (w: number) => { if (w > 0) setHostWidth(w); };
    apply(hostEl.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => apply(entries[0]!.contentRect.width));
    ro.observe(hostEl);
    return () => ro.disconnect();
  }, [hostEl]);
  const setHost = useCallback((el: HTMLDivElement | null) => { hostRef.current = el; setHostEl(el); }, []);
  const push = mode === 'overlay' && (compactProp ?? hostWidth < compactBreakpoint);
  const head = (
    <div className="flex shrink-0 items-center justify-between px-[14px] pt-[13px] pb-1.5">
      <span className="text-[16.5px] font-bold tracking-[-.2px] whitespace-nowrap">{title}</span>
      <AriaButton onPress={onClose} aria-label={'Close ' + (typeof title === 'string' ? title : 'panel')}
        className="bl-btn grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-secondary p-0 text-muted-foreground">
        <Icon name="x" size={14} sw={2.6} />
      </AriaButton>
    </div>
  );
  const body = <div className="bl-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>;
  const col = <>{head}{body}</>;
  if (mode === 'fixed') {
    return (
      <div data-slot="side-drawer" data-mode="fixed" aria-hidden={!open}
        className={cn(sideDrawerVariants({ mode }), open ? '[border-left:1px_solid_var(--border)]' : 'w-0', className)}
        style={{ '--side-drawer-w': width + 'px', ...style } as CSSProperties}>
        <div className="box-border flex h-full w-(--side-drawer-w) flex-col">{col}</div>
      </div>
    );
  }
  return (
    <div ref={setHost} data-slot="side-drawer" data-mode="overlay" data-presentation={push ? 'push' : 'sheet'}
      data-open={open || undefined} className={cn(sideDrawerVariants({ mode }), className)} style={style}>
      {push ? (
        <SideDrawerPush open={open} onClose={onClose} title={title} backLabel={backLabel} host={hostRef} hostWidth={hostWidth}>
          {body}
        </SideDrawerPush>
      ) : (
        <EdgeDrawer side="right" open={open} onClose={onClose} zIndex={0} width={`min(${width}px, 88%)`}
          scrimClassName="bg-overlay"
          className={cn(
            'flex flex-col [border-left:1px_solid_var(--border)] bg-background data-[open=false]:translate-x-[106%]',
            open && 'shadow-[-16px_0_48px_black] shadow-black/25',
          )}>
          <div className="contents" onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); onClose?.(); } }}>{col}</div>
        </EdgeDrawer>
      )}
    </div>
  );
}

/* ── The compact push ──
   The panel is a NavigationStack screen pushed over the host's page: it waits at `navigationPush.off`, enters on
   the smooth spring, and the page — the drawer's preceding siblings in the host — parallaxes to
   `navigationPush.under` of the host's width under a `navigationPush.dim` shade. An edge swipe scrubs all three
   with the finger and settles on the tray spring, committing past the same distance or flick as the stack. */

interface PushProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  backLabel: ReactNode;
  host: React.RefObject<HTMLDivElement | null>;
  hostWidth: number;
  children: ReactNode;
}

/** The page under the drawer: the elements before it in the host. */
function pageOf(host: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (let el = host?.previousElementSibling; el; el = el.previousElementSibling) {
    if (el instanceof HTMLElement) out.push(el);
  }
  return out;
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function SideDrawerPush({ open, onClose, title, backLabel, host, hostWidth, children }: PushProps) {
  const safeTop = use(BLSafeCtx);
  const panel = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x0: number; y0: number; w: number; last: number; lt: number; vel: number; dx: number; on: boolean; page: HTMLElement[];
  } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Painted (shadow, content) while open and until the pop has settled.
  const [shown, setShown] = useState(open);
  useEffect(() => {
    if (open) { setShown(true); return undefined; }
    const t = setTimeout(() => setShown(false), navigationPush.settleMs);
    return () => clearTimeout(t);
  }, [open]);

  // The page parallaxes on the same spring as the panel. Its transition is set only while the push or pop runs,
  // so the page's own transitions are left alone the rest of the time.
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const page = pageOf(host.current);
    const moving = wasOpen.current !== open && !reducedMotion();
    wasOpen.current = open;
    const under = `${(navigationPush.underPct / 100) * hostWidth}px 0`;
    page.forEach((el) => {
      el.style.transition = moving ? springCss('translate', 'smooth') : '';
      el.style.translate = open ? under : '';
    });
    if (!moving) return undefined;
    const t = setTimeout(() => page.forEach((el) => { el.style.transition = ''; }), navigationPush.settleMs);
    return () => clearTimeout(t);
  }, [open, hostWidth, host]);
  useLayoutEffect(() => {
    const el = host.current;
    return () => pageOf(el).forEach((p) => { p.style.transition = ''; p.style.translate = ''; });
  }, [host]);
  // A pushed page takes focus (so Escape and the keyboard land in it); popping hands it back to where it came from.
  const returnTo = useRef<HTMLElement | null>(null);
  const focusedOpen = useRef(open);
  useEffect(() => {
    if (focusedOpen.current === open) return;
    focusedOpen.current = open;
    if (open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      panel.current?.focus({ preventScroll: true });
    } else if (panel.current?.contains(document.activeElement)) {
      returnTo.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const down = (e: React.PointerEvent) => {
    if (e.button || !open) return;
    const rect = panel.current?.getBoundingClientRect();
    if (!rect || e.clientX - rect.left > navigationPush.edge) return;
    drag.current = { x0: e.clientX, y0: e.clientY, w: rect.width, last: e.clientX, lt: performance.now(), vel: 0, dx: 0, on: false, page: pageOf(host.current) };
    try { panel.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const p = panel.current, s = dim.current;
    if (!d || !p || !s) return;
    const raw = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      // Slop: engage only on a clearly horizontal rightward drag.
      if (raw > 8 && raw > Math.abs(dy) * 1.2) d.on = true;
      else { if (Math.abs(dy) > 14) drag.current = null; return; }
    }
    const dx = Math.max(0, raw);
    d.vel = (e.clientX - d.last) / Math.max(1, performance.now() - d.lt); d.last = e.clientX; d.lt = performance.now(); d.dx = dx;
    const k = 1 - dx / d.w;
    p.style.transition = 'none'; p.style.transform = `translateX(${dx}px)`;
    s.style.transition = 'none'; s.style.opacity = String(navigationPush.dim * k);
    d.page.forEach((el) => { el.style.transition = 'none'; el.style.translate = `${(navigationPush.underPct / 100) * d.w * k}px 0`; });
  };
  const up = () => {
    const d = drag.current; drag.current = null;
    const p = panel.current, s = dim.current;
    if (!d || !d.on || !p || !s) return;
    const commit = d.dx / d.w > navigationPush.commit || d.vel > navigationPush.flick;
    // Release continues on the tray spring from wherever the finger let go.
    p.style.transition = springCss('transform', 'tray');
    s.style.transition = springCss('opacity', 'tray');
    d.page.forEach((el) => { el.style.transition = springCss('translate', 'tray'); });
    if (commit) {
      p.style.transform = `translateX(${navigationPush.off})`;
      s.style.opacity = '0';
      d.page.forEach((el) => { el.style.translate = ''; });
      onCloseRef.current?.();
    } else {
      p.style.transform = 'translateX(0px)';
      s.style.opacity = String(navigationPush.dim);
      d.page.forEach((el) => { el.style.translate = `${(navigationPush.underPct / 100) * d.w}px 0`; });
    }
    // Hand the positions back to the classes once the tray spring has settled.
    setTimeout(() => {
      p.style.transition = ''; p.style.transform = '';
      s.style.transition = ''; s.style.opacity = '';
      d.page.forEach((el) => { el.style.transition = ''; });
    }, 430);
  };

  return (
    <>
      <div ref={dim} data-slot="side-drawer-dim" aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-black transition-opacity duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
          open ? 'pointer-events-auto opacity-12' : 'pointer-events-none opacity-0',
        )} />
      <div ref={panel} data-slot="side-drawer-panel" role="dialog" tabIndex={-1} aria-label={typeof title === 'string' ? title : undefined}
        aria-hidden={!open} inert={!open || undefined}
        onPointerDownCapture={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); onClose?.(); } }}
        className={cn(
          'absolute inset-0 flex touch-pan-y flex-col overflow-hidden bg-background outline-none will-change-transform [transform:translateX(var(--side-drawer-x))] transition-transform duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
          open ? 'pointer-events-auto' : 'pointer-events-none',
          (open || shown) && 'shadow-[-10px_0_30px_black] shadow-black/16',
          !open && !shown && 'invisible',
        )}
        style={{ '--side-drawer-x': open ? '0%' : navigationPush.off, '--side-drawer-bar-h': safeTop + BARH + 'px', '--side-drawer-safe-top': safeTop + 'px' } as CSSProperties}>
        {/* The bar: a NavigationStack screen's — back on the leading edge, the title centred. */}
        <div data-slot="side-drawer-bar"
          className="relative box-border flex h-(--side-drawer-bar-h) shrink-0 items-end px-1.5 pt-(--side-drawer-safe-top) [border-bottom:1px_solid_var(--border)] bg-background/86 backdrop-blur-[18px] backdrop-saturate-[1.7]">
          <div className="flex h-toolbar w-full items-center">
            <AriaButton onPress={onClose} aria-label={typeof backLabel === 'string' ? backLabel : 'Back'}
              className="bl-btn relative z-1 flex max-w-[30%] cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-[17px] text-primary">
              <Icon name="chevL" size={24} sw={2.4} />
              <span className="truncate">{backLabel}</span>
            </AriaButton>
            <div className="pointer-events-none absolute left-1/2 max-w-[52%] -translate-x-1/2 truncate text-[17px] font-semibold text-foreground">{title}</div>
          </div>
        </div>
        {children}
      </div>
    </>
  );
}
