/* A macOS window: traffic lights, a title bar you drag (double-click zooms), edges you resize, and the app inside.
   The app stays mounted while the window is minimized, so it comes back as it was. On a phone-sized desktop the
   same window is a full-screen app that zooms out of its springboard icon — no chrome, same mounted app. */
import { Suspense, memo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { AppearanceProvider } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { appById, type DesktopApp } from './apps';
import { DOCK_RESERVE, MIN_H, MIN_W, useDesktop, type Area, type Rect, type WindowState } from './desktop';
import { AppTile } from './parts';

const TITLE_H = 40;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The rect a window actually shows: zoomed fills the desktop above the dock, and a stored rect is kept inside it. */
export function shownRect(win: WindowState, area: Area, dock: boolean): Rect {
  const bottom = dock ? DOCK_RESERVE : 0;
  if (win.zoomed) return { x: 0, y: 0, w: area.width, h: Math.max(MIN_H, area.height - bottom) };
  const w = clamp(win.w, Math.min(MIN_W, area.width), area.width);
  const h = clamp(win.h, Math.min(MIN_H, area.height), area.height);
  return { w, h, x: clamp(win.x, 40 - w, area.width - 40), y: clamp(win.y, 0, Math.max(0, area.height - 48)) };
}

/** The app's body. Memoized, so dragging and resizing move the window without re-rendering what's inside. */
const AppBody = memo(function AppBody({ app, dark }: { app: DesktopApp; dark: boolean }) {
  const { Component } = app;
  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      <Suspense fallback={<div className="grid h-full place-items-center bg-muted text-muted-foreground"><Spinner spin size={24} /></div>}>
        <Component {...app.props} />
      </Suspense>
    </AppearanceProvider>
  );
});

type Edge = 'e' | 's' | 'se';

/** How a window shows on a phone: the one in front is up, the rest are tucked into their icons (`origin`), and in the
    app switcher each is a `card` — a scale and translate from its place, `live` while a finger is moving it. */
export interface PhoneView {
  shown: boolean;
  origin: string;
  card?: { scale: number; translate: string; opacity: number; live: boolean };
}

/** False for the first frame, so a window that mounts hidden can transition in. */
function useSettled() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return settled;
}

export function DesktopWindow({ win, dark, dock, phone }: { win: WindowState; dark: boolean; dock: boolean; phone?: PhoneView }) {
  const d = useDesktop();
  const settled = useSettled();
  const app = appById(win.app);
  const gesture = useRef<{ kind: 'move' | Edge; px: number; py: number; rect: Rect } | null>(null);
  if (!app) return null;
  const front = d.front === win.app;
  const rect = shownRect(win, d.area, dock);
  const card = phone?.card;
  const up = phone ? phone.shown && settled && !card : false;

  const begin = (kind: 'move' | Edge) => (e: ReactPointerEvent) => {
    if (e.button !== 0 || win.zoomed) return;
    if (kind === 'move' && (e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    gesture.current = { kind, px: e.clientX, py: e.clientY, rect };
  };
  const move = (e: ReactPointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (g.kind === 'move') d.setRect(win.app, { ...g.rect, x: clamp(g.rect.x + dx, 60 - g.rect.w, d.area.width - 60), y: clamp(g.rect.y + dy, 0, d.area.height - TITLE_H) });
    else {
      const w = g.kind === 's' ? g.rect.w : clamp(g.rect.w + dx, MIN_W, d.area.width - g.rect.x);
      const h = g.kind === 'e' ? g.rect.h : clamp(g.rect.h + dy, MIN_H, d.area.height - g.rect.y);
      d.setRect(win.app, { ...g.rect, w, h });
    }
  };
  const end = () => { gesture.current = null; };

  const edge = (kind: Edge, className: string) => (
    <div aria-hidden="true" onPointerDown={begin(kind)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} className={cn('absolute z-10 touch-none', className)} />
  );

  return (
    <section
      data-slot="macos-window"
      data-app={app.id}
      data-front={front || undefined}
      aria-label={app.name}
      // Any press inside brings the window forward (capture: before the app's own handlers).
      onPointerDownCapture={() => d.focus(win.app)}
      inert={(phone ? card !== undefined || !phone.shown : win.minimized) || undefined}
      className={cn(
        'pointer-events-auto absolute flex flex-col overflow-hidden bg-background',
        phone
          ? cn(
              'transition-[opacity,scale,translate,border-radius] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
              card
                ? 'rounded-[28px] shadow-[0_8px_30px] shadow-black/35'
                : up ? 'rounded-none' : 'pointer-events-none scale-[.18] rounded-[28px] opacity-0 motion-reduce:scale-100',
            )
          : cn(
              'origin-bottom transition-[opacity,scale,box-shadow] duration-spring-snappy ease-spring-snappy',
              win.zoomed ? 'rounded-none' : 'rounded-panel',
              win.minimized ? 'pointer-events-none scale-75 opacity-0' : 'animate-bl-pop-in motion-reduce:animate-bl-fade-in',
              front
                ? 'shadow-[0_24px_64px_-8px,0_0_0_.5px] shadow-black/40 ring-1 ring-black/20'
                : 'shadow-[0_10px_32px_-8px,0_0_0_.5px] shadow-black/25 ring-1 ring-black/10',
            ),
      )}
      style={phone ? {
        inset: 0, zIndex: win.z, transformOrigin: phone.origin,
        ...(card ? { scale: card.scale, translate: card.translate, opacity: card.opacity, ...(card.live ? { transitionProperty: 'opacity, scale, border-radius' } : null) } : null),
      } : { left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: win.z }}
    >
      {phone ? null : (
        <header
          data-slot="macos-titlebar"
          onPointerDown={begin('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) d.toggleZoom(win.app); }}
          className={cn('group/lights relative flex shrink-0 touch-none items-center bg-card px-3 shadow-hairline-b', win.zoomed ? 'cursor-default' : 'cursor-grab active:cursor-grabbing')}
          style={{ height: TITLE_H }}
        >
          <div className="z-10 flex gap-2">
            <Light label={`Close ${app.name}`} kind="close" active={front} onClick={() => d.close(win.app)} />
            <Light label={`Minimize ${app.name}`} kind="minimize" active={front} onClick={() => d.minimize(win.app)} />
            <Light label={win.zoomed ? `Exit full size ${app.name}` : `Zoom ${app.name}`} kind="zoom" active={front} onClick={() => d.toggleZoom(win.app)} />
          </div>
          <div className={cn('pointer-events-none absolute inset-x-20 flex items-center justify-center gap-1.5 text-footnote font-semibold', front ? 'text-foreground' : 'text-muted-foreground')}>
            <AppTile app={app} size={16} />
            <span className="truncate">{app.name}</span>
          </div>
        </header>
      )}
      <div className="relative isolate min-h-0 flex-1"><AppBody app={app} dark={dark} /></div>
      {win.zoomed || phone ? null : (
        <>
          {edge('e', 'top-0 right-0 h-full w-1.5 cursor-ew-resize')}
          {edge('s', 'bottom-0 left-0 h-1.5 w-full cursor-ns-resize')}
          {edge('se', 'right-0 bottom-0 size-4 cursor-nwse-resize')}
        </>
      )}
    </section>
  );
}

/* The three lights. Colors are the system's, the same in light and dark; an unfocused window's go gray until the
   pointer is over the lights, as on a Mac. */
const CLOSE_ON = 'bg-[#FF5F57]';
const CLOSE_HOVER = 'group-hover/lights:bg-[#FF5F57]';
const MINIMIZE_ON = 'bg-[#FEBC2E]';
const MINIMIZE_HOVER = 'group-hover/lights:bg-[#FEBC2E]';
const ZOOM_ON = 'bg-[#28C840]';
const ZOOM_HOVER = 'group-hover/lights:bg-[#28C840]';
const LIGHT = {
  close: { on: CLOSE_ON, hover: CLOSE_HOVER, icon: 'xmark' },
  minimize: { on: MINIMIZE_ON, hover: MINIMIZE_HOVER, icon: 'minus' },
  zoom: { on: ZOOM_ON, hover: ZOOM_HOVER, icon: 'plus' },
} as const;

function Light({ kind, label, active, onClick }: { kind: keyof typeof LIGHT; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid size-3 cursor-pointer place-items-center rounded-full border-0 p-0 text-black/55 shadow-[inset_0_0_0_.5px] shadow-black/20 transition-colors duration-150',
        active ? LIGHT[kind].on : cn('bg-muted-foreground/35', LIGHT[kind].hover),
      )}
    >
      <span className="opacity-0 transition-opacity group-hover/lights:opacity-100"><Icon name={LIGHT[kind].icon} size={8} sw={3.2} /></span>
    </button>
  );
}
