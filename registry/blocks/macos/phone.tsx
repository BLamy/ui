/* The desktop at phone width: an iPhone. A status bar with the Dynamic Island, a springboard of app icons (paged when
   they don't fit, four in the dock), a Search pill that opens Alfred, and a home bar that sends the open app back to
   its icon; double-tap it for the app switcher — every running app as a card you swipe between, tap to open or flick
   up to quit. The apps are the desktop's own windows and the phone never moves or minimizes them, so they keep running
   (and keep their desktop places) when the width crosses over. */
import { useCallback, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useContainerSize } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { APPS, type DesktopApp } from './apps';
import type { Area } from './desktop';
import { AppTile, Hat } from './parts';

/** Status bar and home bar heights. */
export const STATUS_H = 44;
export const HOME_H = 24;

const COLUMNS = 4;
/** Apps kept in the dock, in order. */
const DOCK = ['mail', 'notes', 'music', 'maps'];
const DOCK_APPS = DOCK.flatMap((id) => APPS.filter((a) => a.id === id));
const PAGE_APPS = APPS.filter((a) => !DOCK.includes(a.id));

/** The clock is fixed, like the Mac's. `inApp` gives the bar the app's own surface. */
export function StatusBar({ dark, inApp }: { dark: boolean; inApp: boolean }) {
  return (
    <div
      data-slot="macos-statusbar"
      className={cn(
        'relative z-10 flex shrink-0 items-center justify-between px-8 pt-1 text-subhead font-semibold transition-colors duration-spring-smooth ease-spring-smooth',
        inApp ? 'bg-background text-foreground' : dark ? 'text-white' : 'text-black',
      )}
      style={{ height: STATUS_H }}
    >
      <span className="tabular-nums">9:41</span>
      <span aria-hidden="true" className="absolute top-2 left-1/2 h-7 w-[94px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
          {[3, 5.5, 8, 10.5].map((h, i) => <rect key={h} x={i * 4.6} y={12 - h} width="3" height={h} rx="1" />)}
        </svg>
        <Icon name="wifi" size={16} sw={2} />
        <Icon name="battery-full" size={22} sw={1.6} />
      </span>
    </div>
  );
}

/** Two taps this close together on the home bar open the app switcher (a Mac's default double-click speed, so a
    trackpad double-tap — and the first tap's animation running under it — still counts). */
const DOUBLE_TAP = 500;

/** The home bar: tap it to leave the open app (or the switcher) for the springboard; double-tap it for the switcher. */
export function HomeBar({ dark, inApp, onHome, onSwitcher }: { dark: boolean; inApp: boolean; onHome: () => void; onSwitcher: () => void }) {
  const last = useRef(0);
  const tap = () => {
    onHome();
    const now = Date.now();
    if (now - last.current < DOUBLE_TAP) { last.current = 0; onSwitcher(); } else last.current = now;
  };
  return (
    <div className={cn('grid shrink-0 place-items-center transition-colors duration-spring-smooth ease-spring-smooth', inApp ? 'bg-background' : 'bg-transparent')} style={{ height: HOME_H }}>
      <button type="button" aria-label="Home" onClick={tap} className="grid size-full cursor-pointer place-items-center border-0 bg-transparent p-0">
        <span aria-hidden="true" className={cn('block h-1 w-34 rounded-full', inApp ? 'bg-foreground/85' : dark ? 'bg-white/70' : 'bg-black/55')} />
      </button>
    </div>
  );
}

export interface Point { x: number; y: number }

interface SpringboardProps {
  dark: boolean;
  /** An app is up: the springboard recedes behind it. */
  away: boolean;
  /** `from` is the icon's center in the springboard's box, where the app zooms from. */
  onLaunch: (id: string, from: Point) => void;
  onSearch: () => void;
}

export function Springboard({ dark, away, onLaunch, onSearch }: SpringboardProps) {
  const root = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  // The pages' room decides the icon size and how many rows fit before the next page.
  const [paneRef, pane] = useContainerSize({ width: 390, height: 420 });
  const tile = Math.max(44, Math.min(64, Math.floor((pane.width - 40) / COLUMNS) - 16));
  const rowH = tile + 34;
  const rows = Math.max(1, Math.floor((pane.height - 12) / rowH));
  const perPage = rows * COLUMNS;
  const pages = Array.from({ length: Math.ceil(PAGE_APPS.length / perPage) }, (_, i) => PAGE_APPS.slice(i * perPage, (i + 1) * perPage));

  const launch = (app: DesktopApp) => (e: MouseEvent<HTMLButtonElement>) => {
    const box = root.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    onLaunch(app.id, box ? { x: Math.round(r.left + r.width / 2 - box.left), y: Math.round(r.top + r.height / 2 - box.top) } : { x: r.left, y: r.top });
  };
  const icon = (app: DesktopApp, label: boolean) => (
    <button key={app.id} type="button" aria-label={app.name} onClick={launch(app)} className="group/icon flex cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent p-0 transition-transform duration-spring-snappy ease-spring-snappy active:scale-90 motion-reduce:transition-none">
      <AppTile app={app} size={tile} />
      {label ? <span aria-hidden="true" className={cn('max-w-full truncate text-[11.5px] leading-none font-medium', dark ? 'text-white [text-shadow:0_1px_3px_rgba(0,0,0,.45)]' : 'text-black/85')}>{app.name}</span> : null}
    </button>
  );

  return (
    <div
      ref={root}
      data-slot="macos-springboard"
      inert={away || undefined}
      className={cn('absolute inset-0 flex flex-col transition-[opacity,scale] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none', away && 'pointer-events-none scale-[1.06] opacity-0 motion-reduce:scale-100')}
    >
      <div
        ref={paneRef}
        onScroll={(e) => setPage(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {pages.map((apps, i) => (
          <div key={i} className="grid w-full shrink-0 snap-center content-start gap-y-3 px-5 pt-4" style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}>
            {apps.map((app) => <div key={app.id} className="flex justify-center">{icon(app, true)}</div>)}
          </div>
        ))}
      </div>
      {pages.length > 1 ? (
        <div aria-hidden="true" className="flex shrink-0 justify-center gap-2 pb-2.5">
          {pages.map((_, i) => <span key={i} className={cn('size-1.5 rounded-full transition-colors', i === page ? (dark ? 'bg-white' : 'bg-black/70') : dark ? 'bg-white/35' : 'bg-black/25')} />)}
        </div>
      ) : null}
      <button
        type="button"
        onClick={onSearch}
        className={cn(
          'mx-auto mb-3 inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-4 py-1.5 text-footnote font-medium backdrop-blur-xl backdrop-saturate-150 transition-transform duration-spring-snappy ease-spring-snappy active:scale-95 motion-reduce:transition-none',
          dark ? 'bg-white/15 text-white/85' : 'bg-white/45 text-black/70',
        )}
      >
        <Hat size={15} />
        Search
      </button>
      <div
        data-slot="macos-phone-dock"
        className={cn(
          'mx-3 mb-1 grid shrink-0 rounded-[32px] px-3.5 py-3 backdrop-blur-2xl backdrop-saturate-150',
          dark ? 'bg-white/12 shadow-[inset_0_0_0_.5px_rgba(255,255,255,.16)]' : 'bg-white/35 shadow-[inset_0_0_0_.5px_rgba(255,255,255,.6)]',
        )}
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }}
      >
        {DOCK_APPS.map((app) => <div key={app.id} className="flex justify-center">{icon(app, false)}</div>)}
      </div>
    </div>
  );
}

/* ── App switcher ── */

/** Gap between cards, and how far the cards sit below the middle (room for the name above them). */
const CARD_GAP = 20;
const CARD_DROP = 10;
/** Flicking a card up past this closes the app. */
const QUIT_DISTANCE = 80;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Where a window's center ends up when it is scaled by `scale` about `from` and moved by (dx, dy): the CSS
    `translate` that does it, so a window can fly from its icon into a card without moving its transform origin. */
function cardPlacement(layer: Area, from: Point, scale: number, dx: number, dy: number) {
  return { scale, translate: `${(layer.width / 2 - from.x) * (1 - scale) + dx}px ${(layer.height / 2 - from.y) * (1 - scale) + dy}px` };
}

/** The switcher's state and card geometry. `layer` is the box the apps fill (between the status and home bars). */
export function useSwitcher(layer: Area) {
  const [open, setOpen] = useState(false);
  const [scrollX, setScrollX] = useState(0);
  // A scroll or a drag is moving cards under a finger: their position follows it instead of easing.
  const [live, setLive] = useState(false);
  const [drag, setDrag] = useState<Record<string, number>>({});
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scale = clamp((layer.height - 150) / Math.max(1, layer.height), 0.42, 0.68);
  const cardW = scale * layer.width;
  const step = cardW + CARD_GAP;

  const show = useCallback(() => { setScrollX(0); setDrag({}); setOpen(true); }, []);
  const hide = useCallback(() => setOpen(false), []);
  const scrolled = useCallback((x: number) => {
    setScrollX(x);
    setLive(true);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => setLive(false), 140);
  }, []);

  /** The card for the `index`th app, as a window's phone view. */
  const place = (index: number, app: string, from: Point) => {
    const lift = drag[app] ?? 0;
    return {
      ...cardPlacement(layer, from, scale, index * step - scrollX, CARD_DROP + lift),
      opacity: clamp(1 + lift / (layer.height * 0.6), 0, 1),
      live,
    };
  };
  return { open, show, hide, scrolled, setLive, drag, setDrag, scale, cardW, step, place };
}
export type Switcher = ReturnType<typeof useSwitcher>;

/** The switcher's touch layer over the apps (which the windows lay out as cards): scroll between them, tap one to
    open it, flick one up to quit it, tap the empty space to go back. */
export function AppSwitcher({ apps, layer, switcher, dark, onPick, onQuit, onBack }: {
  apps: DesktopApp[]; layer: Area; switcher: Switcher; dark: boolean;
  onPick: (id: string) => void; onQuit: (id: string) => void; onBack: () => void;
}) {
  const { scale, cardW } = switcher;
  const cardH = scale * layer.height;
  const cardTop = layer.height / 2 + CARD_DROP - cardH / 2;
  return (
    <div
      data-slot="macos-switcher"
      onScroll={(e) => switcher.scrolled(Math.round(e.currentTarget.scrollLeft))}
      onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-card]')) onBack(); }}
      className="absolute inset-0 z-10 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
    >
      <div className="relative flex h-full w-max" style={{ paddingInline: (layer.width - cardW) / 2 }}>
        {apps.map((app, i) => (
          <SwitcherCard
            key={app.id} app={app} dark={dark} switcher={switcher}
            style={{ width: cardW, marginRight: i < apps.length - 1 ? CARD_GAP : 0 }} top={cardTop} height={cardH}
            onPick={() => onPick(app.id)} onQuit={() => onQuit(app.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SwitcherCard({ app, dark, switcher, style, top, height, onPick, onQuit }: {
  app: DesktopApp; dark: boolean; switcher: Switcher; style: { width: number; marginRight: number }; top: number; height: number;
  onPick: () => void; onQuit: () => void;
}) {
  // Where the press began, and whether it turned into a flick (so the click that follows it doesn't open the app).
  const start = useRef<number | null>(null);
  const flicked = useRef(false);
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = e.clientY;
    flicked.current = false;
  };
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    const dy = Math.min(0, e.clientY - start.current);
    if (!flicked.current && dy > -6) return;
    flicked.current = true;
    switcher.setLive(true);
    switcher.setDrag((d) => ({ ...d, [app.id]: dy }));
  };
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const from = start.current;
    start.current = null;
    if (!flicked.current || from === null) return;
    switcher.setLive(false);
    if (e.clientY - from < -QUIT_DISTANCE) onQuit();
    else switcher.setDrag((d) => ({ ...d, [app.id]: 0 }));
  };
  const ink = dark ? 'text-white' : 'text-black/85';
  return (
    <div className="relative h-full shrink-0 snap-center" style={style}>
      <div data-card="" className={cn('absolute inset-x-0 flex items-center gap-2 px-1', ink)} style={{ top: top - 34, opacity: Math.max(0, 1 + (switcher.drag[app.id] ?? 0) / 120) }}>
        <AppTile app={app} size={22} />
        <span className="min-w-0 flex-1 truncate text-footnote font-semibold [text-shadow:0_1px_3px_rgba(0,0,0,.25)]">{app.name}</span>
        <button type="button" aria-label={`Close ${app.name}`} onClick={onQuit} className={cn('grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 p-0 backdrop-blur-xl', dark ? 'bg-white/20 text-white' : 'bg-black/12 text-black/70')}>
          <Icon name="xmark" size={11} sw={3} />
        </button>
      </div>
      <button
        type="button"
        data-card=""
        aria-label={`Open ${app.name}`}
        onClick={() => { if (!flicked.current) onPick(); }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { start.current = null; switcher.setLive(false); switcher.setDrag((d) => ({ ...d, [app.id]: 0 })); }}
        className="absolute inset-x-0 cursor-pointer touch-pan-x rounded-[28px] border-0 bg-transparent p-0"
        style={{ top, height }}
      />
    </div>
  );
}
