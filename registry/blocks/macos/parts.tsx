/* The desktop's pieces that aren't the launcher's menu: app tiles and file glyphs, the hat, the desktop (wallpaper,
   menu bar, dock) and the power overlays (lock screen, sleep, restart, shut down). */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { IconSwap } from '@/components/ui/icon-swap';
import { NumberMorph } from '@/components/ui/number-morph';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { APPS, type DesktopApp } from './apps';
import type { ClipKind, FileKind } from './data';
import { useDesktop } from './desktop';
import { useAlfred, type PowerState, type RunningTimer } from './state';

/* ── Tiles: macOS-style app icons (a gradient squircle with a white glyph) ── */

/** Gradient stops per tile, top → bottom. Content colors, like app icons. */
export const TILE = {
  calc: ['#FFB340', '#FF8A00'],
  clipboard: ['#5AD8C8', '#1FA89A'],
  emoji: ['#FFE066', '#FFB800'],
  snippets: ['#C58BFF', '#8E4BF2'],
  files: ['#6CB8FF', '#2F7CF6'],
  system: ['#A7A7B0', '#6E6E78'],
  web: ['#5FD0FF', '#1E90FF'],
  workflows: ['#FF7EB3', '#E83E8C'],
  github: ['#3A3F47', '#161B22'],
  timer: ['#FF8A7A', '#F2463A'],
  lock: ['#8E8EA0', '#55556A'],
  sleep: ['#6E7BFF', '#3F3FD0'],
  trash: ['#B9BCC4', '#7D818C'],
  power: ['#FF6B6B', '#E0302E'],
  dark: ['#4B4F63', '#1E2030'],
  light: ['#FFD65C', '#FFA928'],
  google: ['#FFFFFF', '#EEF1F5'],
  wikipedia: ['#F7F7F7', '#E3E3E3'],
  youtube: ['#FF4E45', '#E5231B'],
  maps: ['#7CE08A', '#2FB24C'],
  amazon: ['#FFB547', '#F08A00'],
  alfred: ['#5B4BD6', '#2B1F7A'],
} as const satisfies Record<string, readonly [string, string]>;
export type TileName = keyof typeof TILE;

export function Tile({ tone, icon, glyph, size = 30, dark, className }: {
  /** A named tile, or its two gradient stops. */
  tone: TileName | readonly [string, string]; icon?: string; glyph?: ReactNode; size?: number; /** A dark glyph (light tiles). */ dark?: boolean; className?: string;
}) {
  const [from, to] = typeof tone === 'string' ? TILE[tone] : tone;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-[27%] shadow-[inset_0_.5px_0_rgba(255,255,255,.45),inset_0_0_0_.5px_rgba(0,0,0,.08),0_1px_2px_rgba(0,0,0,.18)]',
        dark ? 'text-black/80' : 'text-white',
        className,
      )}
      style={{ width: size, height: size, backgroundImage: `linear-gradient(180deg, ${from}, ${to})` }}
    >
      {glyph ?? (icon ? <Icon name={icon} size={Math.round(size * 0.6)} sw={2} /> : null)}
    </span>
  );
}

/** An app's icon: its gradient squircle and glyph. */
export function AppTile({ app, size = 30, className }: { app: DesktopApp; size?: number; className?: string }) {
  return <Tile tone={app.tile} icon={app.icon} size={size} dark={app.darkGlyph} className={className} />;
}

/** A calculator keypad glyph (no stock icon draws one). */
export function CalcGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="3" width="16" height="5" rx="1.6" opacity=".95" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <circle key={`${r}${c}`} cx={6.6 + c * 5.4} cy={12 + r * 4.4} r="1.7" opacity={c === 2 ? 1 : 0.85} />
      )))}
    </svg>
  );
}

/** Alfred's bowler hat. */
export function Hat({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {/* Crown, band, and a brim that curls up at both ends. */}
      <path d="M7.3 11.6C7.4 7.6 9.3 4.6 12 4.6s4.6 3 4.7 7c-1.5.5-3 .7-4.7.7s-3.2-.2-4.7-.7z" />
      <path d="M7.3 12.4c1.5.5 3 .7 4.7.7s3.2-.2 4.7-.7l-.1 2.1c-1.4.5-2.9.7-4.6.7s-3.2-.2-4.6-.7z" opacity=".55" />
      <path d="M2.4 13.7c1.4 2 5.3 3.2 9.6 3.2s8.2-1.2 9.6-3.2c.6 2.7-3.7 5.2-9.6 5.2s-10.2-2.5-9.6-5.2z" />
    </svg>
  );
}

/* ── Files ── */

const FILE_TONES: Record<FileKind, { color: string; icon: string; label: string }> = {
  folder: { color: '#3B9BFF', icon: 'folder-fill', label: 'Folder' },
  pdf: { color: '#FF453A', icon: 'doc', label: 'PDF document' },
  image: { color: '#30C759', icon: 'photo', label: 'Image' },
  code: { color: '#8E8E93', icon: 'terminal', label: 'Source code' },
  doc: { color: '#0A84FF', icon: 'doc-text', label: 'Document' },
  sheet: { color: '#28A745', icon: 'table', label: 'Spreadsheet' },
  zip: { color: '#A2845E', icon: 'archivebox', label: 'ZIP archive' },
  video: { color: '#BF5AF2', icon: 'video-fill', label: 'QuickTime movie' },
  audio: { color: '#FF375F', icon: 'music-note', label: 'Audio' },
  app: { color: '#636366', icon: 'internaldrive', label: 'Disk image' },
  md: { color: '#5E5CE6', icon: 'doc-text', label: 'Markdown' },
};
export const fileKindLabel = (k: FileKind) => FILE_TONES[k].label;

/** A Finder-ish glyph: folders are solid, documents sit on a soft tinted card. */
export function FileGlyph({ kind, size = 30 }: { kind: FileKind; size?: number }) {
  const t = FILE_TONES[kind];
  if (kind === 'folder') return <span className="grid shrink-0 place-items-center" style={{ width: size, height: size, color: t.color }}><Icon name="folder-fill" size={size} sw={1.6} /></span>;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[7px]"
      style={{ width: size, height: size, color: t.color, background: `color-mix(in oklab, ${t.color} 16%, transparent)` }}
    >
      <Icon name={t.icon} size={Math.round(size * 0.6)} sw={1.9} />
    </span>
  );
}

const CLIP_ICON: Record<ClipKind, string> = { text: 'textformat', link: 'link', code: 'terminal', color: 'circle-fill', image: 'photo' };

export function ClipGlyph({ kind, text, size = 30 }: { kind: ClipKind; text: string; size?: number }) {
  if (kind === 'color') {
    return <span className="block shrink-0 rounded-lg shadow-[inset_0_0_0_.5px_rgba(0,0,0,.15)]" style={{ width: size, height: size, background: text }} />;
  }
  return (
    <span className="grid shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground" style={{ width: size, height: size }}>
      <Icon name={CLIP_ICON[kind]} size={Math.round(size * 0.56)} sw={1.9} />
    </span>
  );
}

/* ── Desktop ── */

/** Wallpaper blooms (content colors). */
const WALL = {
  light: {
    base: '#E6EAF6',
    blobs: ['#9CC3FF 0%, transparent 55%', '#FFB8D2 0%, transparent 50%', '#FFD9A8 0%, transparent 55%', '#BFB3FF 0%, transparent 55%'],
  },
  dark: {
    base: '#0A0B1A',
    blobs: ['#2E3A9C 0%, transparent 55%', '#7A2B78 0%, transparent 50%', '#16587E 0%, transparent 55%', '#3B1F6E 0%, transparent 60%'],
  },
};
const AT = ['12% 18%', '88% 12%', '78% 92%', '18% 88%'];

export function Wallpaper({ dark, children, className }: { dark: boolean; children?: ReactNode; className?: string }) {
  const w = dark ? WALL.dark : WALL.light;
  const style: CSSProperties = {
    backgroundColor: w.base,
    backgroundImage: [
      // A soft horizon, like the Sonoma hills.
      `radial-gradient(120% 60% at 50% 118%, ${dark ? 'rgba(90,70,200,.45)' : 'rgba(255,255,255,.7)'} 0%, transparent 70%)`,
      ...w.blobs.map((b, i) => `radial-gradient(60% 60% at ${AT[i]}, ${b})`),
    ].join(', '),
  };
  return (
    <div data-slot="macos-wallpaper" className={cn('relative h-full w-full overflow-hidden transition-[background-color] duration-spring-smooth ease-spring-smooth', className)} style={style}>
      {children}
    </div>
  );
}

function useCountdown(timer: RunningTimer | null) {
  const [now, setNow] = useState(() => timer?.startedAt ?? 0);
  useEffect(() => {
    if (!timer) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);
  if (!timer) return null;
  return Math.max(0, Math.round(timer.minutes * 60 - (now - timer.startedAt) / 1000));
}

/** The menu bar: the frontmost app's name and menus, and the status items. The clock is fixed (9:41). */
export function MenuBar({ dark, compact, onAlfred }: { dark: boolean; compact: boolean; onAlfred: () => void }) {
  const { timer } = useAlfred();
  const { front } = useDesktop();
  const app = APPS.find((a) => a.id === front);
  const left = useCountdown(timer);
  return (
    <div
      data-slot="macos-menubar"
      className={cn(
        'relative z-10 flex h-7 shrink-0 items-center gap-4 px-3.5 text-footnote backdrop-blur-xl backdrop-saturate-150',
        dark ? 'bg-black/25 text-white/90' : 'bg-white/35 text-black/85',
      )}
    >
      <Hat size={17} />
      <span className="font-semibold">{app?.name ?? 'Finder'}</span>
      {!compact ? ['File', 'Edit', 'View', app ? 'Window' : 'Go', 'Help'].map((m) => <span key={m} className="opacity-90">{m}</span>) : null}
      <span className="ml-auto flex items-center gap-3.5">
        {timer && left !== null ? (
          <span className="inline-flex animate-bl-pop-in items-center gap-1 rounded-md bg-current/12 px-1.5 py-px font-medium tabular-nums motion-reduce:animate-bl-fade-in">
            <Icon name="clock" size={13} sw={2.2} />
            <span className="inline-flex">
              <NumberMorph value={Math.floor(left / 60)} />:<NumberMorph value={left % 60} format={{ minimumIntegerDigits: 2 }} />
            </span>
          </span>
        ) : null}
        <button type="button" onClick={onAlfred} aria-label="Show Alfred" className="grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-inherit opacity-90 hover:opacity-100">
          <Hat size={16} />
        </button>
        {!compact ? <Icon name="battery-full" size={20} sw={1.6} /> : null}
        <Icon name="wifi" size={15} sw={2} />
        {!compact ? <Icon name="magnifyingglass" size={14} sw={2.2} /> : null}
        <span className="font-medium tabular-nums">{compact ? '9:41' : 'Tue Sep 29  9:41 AM'}</span>
      </span>
    </div>
  );
}

/** The Dock: every app, a dot under the ones that are open, then Alfred and the Trash. Click an app to open it (or
    bring it forward). `tile` is the icon size; the dock sizes it to fit the desktop's width. */
export function Dock({ dark, tile, onAlfred }: { dark: boolean; tile: number; onAlfred: () => void }) {
  const { trash } = useAlfred();
  const d = useDesktop();
  const well = cn('grid place-items-center rounded-[27%]', dark ? 'bg-white/12 text-white/80' : 'bg-white/60 text-black/60');
  const slot = 'group/dock relative grid cursor-pointer place-items-center border-0 bg-transparent p-0 transition-transform duration-spring-snappy ease-spring-snappy hover:-translate-y-1.5 hover:scale-110 active:scale-95 motion-reduce:transition-none';
  return (
    <div
      data-slot="macos-dock"
      className={cn(
        'absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-end gap-1.5 rounded-[20px] p-1.5 backdrop-blur-2xl backdrop-saturate-150',
        dark ? 'bg-white/10 shadow-[inset_0_0_0_.5px_rgba(255,255,255,.18),0_10px_30px_rgba(0,0,0,.35)]' : 'bg-white/35 shadow-[inset_0_0_0_.5px_rgba(255,255,255,.6),0_10px_30px_rgba(0,0,0,.12)]',
      )}
    >
      {APPS.map((app) => (
        <button key={app.id} type="button" aria-label={`${d.isOpen(app.id) ? 'Show' : 'Open'} ${app.name}`} onClick={() => d.open(app.id)} className={slot}>
          <DockLabel dark={dark}>{app.name}</DockLabel>
          <AppTile app={app} size={tile} />
          {d.isOpen(app.id) ? <span aria-hidden="true" className={cn('absolute -bottom-1 size-1 rounded-full', dark ? 'bg-white/80' : 'bg-black/60')} /> : null}
        </button>
      ))}
      <span aria-hidden="true" className={cn('mx-0.5 w-px self-center', dark ? 'bg-white/20' : 'bg-black/12')} style={{ height: tile - 4 }} />
      <button type="button" aria-label="Alfred" onClick={onAlfred} className={slot}>
        <DockLabel dark={dark}>Alfred</DockLabel>
        <Tile tone="alfred" size={tile} glyph={<Hat size={Math.round(tile * 0.62)} />} />
      </button>
      <span aria-label="Trash" role="img" className={cn('group/dock relative', well)} style={{ width: tile, height: tile }}>
        <IconSwap id={trash ? 'full' : 'empty'}><Icon name={trash ? 'trash-fill' : 'trash'} size={Math.round(tile * 0.57)} sw={1.7} /></IconSwap>
        <DockLabel dark={dark}>Trash</DockLabel>
      </span>
    </div>
  );
}

/** The name above a Dock icon, on hover or keyboard focus. */
function DockLabel({ dark, children }: { dark: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md px-2 py-1 text-caption font-medium whitespace-nowrap opacity-0 backdrop-blur-xl transition-opacity duration-150 group-hover/dock:opacity-100 group-focus-visible/dock:opacity-100',
        dark ? 'bg-black/55 text-white/90' : 'bg-white/70 text-black/80 shadow-[0_2px_8px_rgba(0,0,0,.12)]',
      )}
    >
      {children}
    </span>
  );
}

/** The progress bar under the hat while "restarting": fills once, over the restart's length. */
function BootBar() {
  const [go, setGo] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setGo(true)); return () => cancelAnimationFrame(id); }, []);
  return (
    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
      <div className={cn('h-full origin-left rounded-full bg-white transition-transform duration-[2400ms] ease-in-out', go ? 'scale-x-100' : 'scale-x-0')} />
    </div>
  );
}

/* ── Power: lock screen, sleep, restart, shut down ── */

export function PowerOverlay({ state, onWake, dark }: { state: PowerState; onWake: () => void; dark: boolean }) {
  // Any key wakes (not the press that put it to sleep — this listens from the next commit on).
  useEffect(() => {
    if (!state || state === 'restart') return;
    const on = (e: KeyboardEvent) => { e.preventDefault(); onWake(); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [state, onWake]);
  useEffect(() => {
    if (state !== 'restart') return;
    const id = setTimeout(onWake, 2600);
    return () => clearTimeout(id);
  }, [state, onWake]);
  if (!state) return null;

  if (state === 'lock') {
    return (
      <div
        data-slot="macos-lock"
        onClick={onWake}
        className={cn('absolute inset-0 z-30 flex animate-bl-fade-in cursor-pointer flex-col items-center backdrop-blur-2xl', dark ? 'bg-black/40 text-white' : 'bg-black/20 text-white')}
      >
        <div className="mt-[12%] animate-bl-sheet-in-top text-center [text-shadow:0_1px_12px_rgba(0,0,0,.25)] motion-reduce:animate-bl-fade-in">
          <div className="text-subhead font-semibold opacity-90">Tuesday, September 29</div>
          <div className="text-[84px] leading-none font-bold tracking-tight">9:41</div>
        </div>
        <div className="mt-auto mb-[9%] flex animate-bl-pop-in flex-col items-center gap-2 motion-reduce:animate-bl-fade-in">
          <span className="grid size-14 place-items-center rounded-full bg-white/30 text-title font-semibold shadow-[inset_0_0_0_.5px_rgba(255,255,255,.5)] backdrop-blur-md">BL</span>
          <span className="text-detail font-semibold [text-shadow:0_1px_8px_rgba(0,0,0,.3)]">Brett Lamy</span>
          <span className="rounded-full bg-white/20 px-3 py-1 text-[12.5px] backdrop-blur-md">Click or press any key to unlock</span>
        </div>
      </div>
    );
  }
  return (
    <div data-slot="macos-power" onClick={state === 'restart' ? undefined : onWake} className="absolute inset-0 z-30 flex animate-bl-fade-in cursor-pointer flex-col items-center justify-center gap-6 bg-black text-white">
      {state === 'restart' ? (
        <>
          <Hat size={64} />
          <BootBar />
        </>
      ) : state === 'off' ? (
        <button type="button" onClick={onWake} className="grid size-14 cursor-pointer place-items-center rounded-full border-0 bg-white/10 text-white/80 shadow-[inset_0_0_0_.5px_rgba(255,255,255,.25)] hover:bg-white/15" aria-label="Power on">
          <Icon name="power" size={24} sw={2} />
        </button>
      ) : (
        <span className="text-[12.5px] text-white/25">Press any key to wake</span>
      )}
    </div>
  );
}
