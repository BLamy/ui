/* The desktop at phone width: an iPhone. A status bar with the Dynamic Island, a springboard of app icons (paged when
   they don't fit, four in the dock), a Search pill that opens Alfred, and a home bar that sends the open app back to
   its icon. The apps are the desktop's own windows, so they keep running when the width crosses over. */
import { useRef, useState, type MouseEvent } from 'react';
import { useContainerSize } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { APPS, type DesktopApp } from './apps';
import { useDesktop } from './desktop';
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

/** The home bar: the open app's way back to the springboard. */
export function HomeBar({ dark, inApp }: { dark: boolean; inApp: boolean }) {
  const d = useDesktop();
  const pill = <span aria-hidden="true" className={cn('block h-1 w-34 rounded-full', inApp ? 'bg-foreground/85' : dark ? 'bg-white/70' : 'bg-black/55')} />;
  return (
    <div className={cn('grid shrink-0 place-items-center transition-colors duration-spring-smooth ease-spring-smooth', inApp ? 'bg-background' : 'bg-transparent')} style={{ height: HOME_H }}>
      {inApp ? <button type="button" aria-label="Home" onClick={d.home} className="grid size-full cursor-pointer place-items-center border-0 bg-transparent p-0">{pill}</button> : pill}
    </div>
  );
}

interface SpringboardProps {
  dark: boolean;
  /** An app is up: the springboard recedes behind it. */
  away: boolean;
  /** `origin` is the icon's center in the springboard's box, where the app zooms from. */
  onLaunch: (id: string, origin: string) => void;
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
    const from = root.current?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    onLaunch(app.id, from ? `${Math.round(r.left + r.width / 2 - from.left)}px ${Math.round(r.top + r.height / 2 - from.top)}px` : '50% 50%');
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
