/* macOS — a desktop (wallpaper, menu bar, Dock, windows) whose apps are the other examples: Reminders, Mail, Notes,
   Music, Passwords, System Settings, Time Machine, Maps, Delivery, Freeform, GitHub, Discord, Codex, T3 Code and Loop QA. Open one
   from the Dock or from Alfred; windows drag, resize, zoom, minimize and stack. Right-click the Dock to turn
   magnification off or hiding on (a hidden Dock slides up from the bottom edge, and windows take its room).
   Alfred is the launcher on top, on the CommandMenu primitive: type an app's name and press Enter. Its features are
   pages you open with Enter: Calculator (also inline at the root when you type math), Clipboard History with a
   preview and pinning, an Emoji grid, Snippets, File Search with nested folders, System commands (lock, sleep,
   empty Trash, dark mode, restart…), Web Search, and multi-step Workflows. ⌥Space hides and shows the bar; Esc
   clears, then hides. All sample data is invented; the clock is fixed at 9:41.
   Under 640px wide the desktop becomes an iPhone: a status bar, a springboard of the same apps (Search opens Alfred),
   and full-screen apps that zoom out of their icons; the home bar sends one back, and double-tapping it opens the app
   switcher. The phone never moves or minimizes a window, so widening the container brings every app back where it was. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { usePersistentState } from '@/lib/persistent-state';
import { useHotkey, type CommandMenuApi } from '@/components/ui/command-menu';
import { Toaster, createToastQueue } from '@/components/ui/toast';
import { useContainerSize } from '@/lib/container';
import { useSessionRecording } from '@/lib/session-recorder';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { APPS } from './apps';
import { DesktopProvider, useDesktop } from './desktop';
import { Launcher } from './launcher';
import { Dock, Hat, MenuBar, PowerOverlay, Wallpaper, type DockPrefs } from './parts';
import { AppSwitcher, HOME_H, HomeBar, STATUS_H, Springboard, StatusBar, useSwitcher, type Point } from './phone';
import { AlfredProvider, useAlfred } from './state';
import { DesktopWindow } from './windows';

/** Alfred's accent: its hat's purple. */
const ALFRED_TINT = { light: '#5B4BD6', dark: '#8E7FFF' } as const;

/** Menu bar height. */
const MENU_H = 28;

/** The width below which the desktop is a phone. */
const PHONE_W = 640;

export interface MacOSProps {
  /** Apps to have open on load, by id (see apps.ts): ['reminders'], ['mail', 'notes'] — the last is frontmost. */
  initialApps?: string[];
  /** Pages to open on, below the root (e.g. ['calc'], ['folder:~', 'folder:~/Projects']). */
  initialPages?: string[];
  /** Text in the input to start with. */
  initialQuery?: string;
  /** Show the bar on load (default true); ⌥Space toggles it. */
  defaultOpen?: boolean;
  /** Focus the input on load (default true). */
  autoFocus?: boolean;
  /** Record this session for Time Machine (default true): an append-only rrweb recording in localStorage, one per mount. */
  record?: boolean;
  /** The Dock's starting preferences; right-clicking the Dock changes them. Magnification defaults on, hiding off. */
  dock?: Partial<DockPrefs>;
  /** Keep the desktop across reloads, in localStorage: the open windows (where they are, their order, zoomed or
   *  minimized), the Dock's preferences and the dark-mode override. `true` uses the key "bl-macos"; a string is your
   *  own, so two desktops on a page don't share one. Off by default. */
  persist?: boolean | string;
}

type Phase = 'open' | 'closing' | 'closed';

export default function MacOS({ initialApps, initialPages, initialQuery = '', defaultOpen = true, autoFocus = true, record = true, dock, persist = false }: MacOSProps) {
  useSessionRecording({ enabled: record });
  const ambient = useAppearance() === 'dark';
  const key = persist ? (typeof persist === 'string' ? persist : 'bl-macos') : null;
  const [override, setOverride] = usePersistentState<boolean | null>(key && `${key}:dark`, null, (v): v is boolean | null => v === null || typeof v === 'boolean');
  const dark = override ?? ambient;
  const [queue] = useState(createToastQueue);
  const [phase, setPhase] = useState<Phase>(defaultOpen ? 'open' : 'closed');
  // The props seed the first opening; later ones start at the root (a closed bar unmounts, so it mounts fresh).
  const [boot, setBoot] = useState({ pages: initialPages, query: initialQuery, focus: autoFocus });
  const menu = useRef<CommandMenuApi | null>(null);

  // Back to the root with an empty query: after a workflow, or reopening a bar that is still animating out.
  const reset = useCallback(() => menu.current?.reset(), []);
  const close = useCallback(() => setPhase((p) => (p === 'open' ? 'closing' : p)), []);
  const show = useCallback(() => {
    setBoot({ pages: [], query: '', focus: true });
    reset();
    setPhase('open');
  }, [reset]);

  return (
    <BLProvider dark={dark} tint={ALFRED_TINT[dark ? 'dark' : 'light']} className="bg-transparent">
      <AlfredProvider queue={queue} dark={dark} toggleDark={() => setOverride(!dark)} reset={reset} close={close}>
        <Desktop dark={dark} phase={phase} setPhase={setPhase} show={show} close={close} boot={boot} menu={menu} queue={queue} initialApps={initialApps} initialDock={dock} persistKey={key} />
      </AlfredProvider>
    </BLProvider>
  );
}

/** Dock icons shrink to fit the width; below this the dock is left out (Alfred still opens every app). */
const MIN_DOCK_TILE = 28;
const MAX_DOCK_TILE = 48;

function Desktop({ initialApps, persistKey, ...rest }: ScreenProps & { initialApps?: string[] }) {
  const [ref, size] = useContainerSize({ width: 900, height: 640 });
  // The room windows live in: everything under the menu bar.
  const area = useMemo(() => ({ width: size.width, height: Math.max(0, size.height - MENU_H) }), [size.width, size.height]);
  // The last desktop-sized room, where an app opened on the phone is placed for when the width comes back.
  const [wide, setWide] = useState(area.width >= PHONE_W ? area : { width: 900, height: 640 - MENU_H });
  if (area.width >= PHONE_W && (wide.width !== area.width || wide.height !== area.height)) setWide(area);
  return (
    <div ref={ref} data-slot="macos" className="relative h-full w-full">
      <DesktopProvider area={area} openArea={area.width >= PHONE_W ? area : wide} initialApps={initialApps} persistKey={persistKey ? `${persistKey}:desktop` : undefined}>
        <Screen {...rest} persistKey={persistKey} size={size} />
      </DesktopProvider>
    </div>
  );
}

interface ScreenProps {
  dark: boolean; phase: Phase; setPhase: (p: Phase) => void; show: () => void; close: () => void;
  boot: { pages?: string[]; query: string; focus: boolean }; menu: React.RefObject<CommandMenuApi | null>;
  queue: ReturnType<typeof createToastQueue>;
  initialDock?: Partial<DockPrefs>;
  persistKey?: string | null;
}

function Screen({ dark, phase, setPhase, show, close, boot, menu, queue, initialDock, persistKey, size }: ScreenProps & { size: { width: number; height: number } }) {
  const { power, setPower } = useAlfred();
  const desktop = useDesktop();
  // A phone-sized desktop is an iPhone: its own chrome, a springboard, and one full-screen app at a time.
  const phone = size.width < PHONE_W;
  const layer = useMemo(() => ({ width: size.width, height: Math.max(0, size.height - STATUS_H - HOME_H) }), [size.width, size.height]);
  const [origins, setOrigins] = useState<Record<string, Point>>({});
  const switcher = useSwitcher(layer);
  // "Home" and "switcher" are marks in the windows' stacking order, not changes to them: the app up is the frontmost
  // one opened or focused since, and the switcher is over once anything is — so the desktop's windows stay as they are.
  const maxZ = Math.max(0, ...desktop.windows.map((w) => w.z));
  const [homeZ, setHomeZ] = useState(0);
  const [switchZ, setSwitchZ] = useState(0);
  const foreground = phone ? desktop.windows.filter((w) => !w.minimized && w.z > homeZ).sort((a, b) => b.z - a.z)[0]?.app ?? null : null;
  const switching = phone && switcher.open && desktop.windows.length > 0 && maxZ <= switchZ;
  // Most recent first.
  const stack = [...desktop.windows].sort((a, b) => b.z - a.z);
  const goHome = () => { switcher.hide(); setHomeZ(maxZ); };
  const showSwitcher = () => { setSwitchZ(maxZ); switcher.show(); };
  const quit = (id: string) => {
    switcher.setDrag((d) => ({ ...d, [id]: -layer.height }));
    setTimeout(() => { desktop.close(id); switcher.setDrag((d) => ({ ...d, [id]: 0 })); }, 220);
  };
  // Every app, Alfred and the Trash, in the space the dock has.
  const items = APPS.length + 2;
  const tile = Math.min(MAX_DOCK_TILE, Math.floor((size.width - 32 - 12 - (items + 1) * 6 - 6) / items));
  const dock = !phone && size.height >= 480 && tile >= MIN_DOCK_TILE;
  const [dockPrefs, setDockPrefs] = usePersistentState<DockPrefs>(persistKey ? `${persistKey}:dock` : null, () => ({ magnify: true, hide: false, ...initialDock }),
    (v): v is DockPrefs => typeof (v as DockPrefs)?.magnify === 'boolean' && typeof (v as DockPrefs)?.hide === 'boolean');
  // A hidden dock sits off-screen, so windows, Alfred's list and the toasts get its room back.
  const reserve = dock && !dockPrefs.hide;
  const width = Math.min(720, size.width - 24);
  const chrome = phone ? STATUS_H + HOME_H : MENU_H;
  const top = phone ? 12 : Math.round(Math.max(16, Math.min(140, size.height * 0.14)));
  const listHeight = Math.round(Math.max(140, Math.min(400, size.height - chrome - top - 68 - 44 - (reserve ? 88 : 20))));
  const toggle = () => (phase === 'open' ? close() : show());

  // ⌥Tab brings back the window behind the front one (a Mac's ⌘Tab, which the browser keeps for itself).
  const cycle = () => {
    const order = [...desktop.windows].sort((a, b) => b.z - a.z);
    const next = order[1] ?? order[0];
    if (next) desktop.open(next.app);
  };
  useHotkey('alt+tab', cycle, !power && !phone);

  // ⌥Space, Alfred's hotkey (matchesHotkey compares the physical key: on a Mac ⌥Space types a non-breaking space).
  useHotkey('alt+space', toggle, !power);

  const wake = useCallback(() => setPower(null), [setPower]);

  return (
    <Wallpaper dark={dark}>
      <div className="flex h-full flex-col">
        {phone ? <StatusBar dark={dark} inApp={foreground !== null && !switching} /> : <MenuBar dark={dark} onAlfred={toggle} />}
        {/* The desktop: pressing the bare wallpaper puts Finder frontmost, as on a Mac. */}
        <div className="relative min-h-0 flex-1" onPointerDown={(e) => { if (e.target === e.currentTarget) desktop.blur(); }}>
          {phone ? (
            <Springboard
              dark={dark}
              away={foreground !== null || switching}
              onLaunch={(id, from) => { setOrigins((o) => ({ ...o, [id]: from })); desktop.open(id); }}
              onSearch={show}
            />
          ) : null}
          {/* The same windows in both modes, so a resize across the breakpoint keeps every app as it was. */}
          <div data-slot="macos-windows" className="pointer-events-none absolute inset-0 isolate overflow-hidden">
            {desktop.windows.map((w) => {
              const from = origins[w.app] ?? { x: layer.width / 2, y: layer.height / 2 };
              return (
                <DesktopWindow
                  key={w.app} win={w} dark={dark} dock={reserve}
                  phone={phone ? {
                    shown: w.app === foreground,
                    origin: `${from.x}px ${from.y}px`,
                    card: switching ? switcher.place(stack.indexOf(w), w.app, from) : undefined,
                  } : undefined}
                />
              );
            })}
          </div>
          {switching ? (
            <AppSwitcher
              apps={stack.flatMap((w) => APPS.filter((a) => a.id === w.app))}
              layer={layer} switcher={switcher} dark={dark}
              onPick={(id) => { desktop.open(id); switcher.hide(); }}
              onQuit={quit}
              onBack={() => switcher.hide()}
            />
          ) : null}
          {phase !== 'closed' ? (
            <div
              className={cn(
                'absolute left-1/2 z-20 -translate-x-1/2 [--bl-pop-y:-12px]',
                phase === 'open' ? 'animate-bl-pop-in motion-reduce:animate-bl-fade-in' : 'pointer-events-none animate-bl-pop-out motion-reduce:animate-bl-fade-out',
              )}
              style={{ top, width }}
              onAnimationEnd={(e) => { if (e.target === e.currentTarget && phase === 'closing') setPhase('closed'); }}
            >
              <Launcher
                menuRef={menu} initialPages={boot.pages} initialQuery={boot.query} autoFocus={boot.focus}
                width={width} listHeight={listHeight} onClose={close}
              />
            </div>
          ) : !desktop.windows.length && !phone ? (
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: top + 12 }}>
              <button
                type="button"
                onClick={show}
                className={cn(
                  'inline-flex animate-bl-fade-in cursor-pointer items-center gap-2.5 rounded-full border-0 px-4 py-2 text-[13.5px] font-medium whitespace-nowrap backdrop-blur-xl backdrop-saturate-150 transition-transform duration-spring-snappy ease-spring-snappy active:scale-[.97]',
                  dark ? 'bg-white/12 text-white/85 shadow-[inset_0_0_0_.5px_rgba(255,255,255,.2)]' : 'bg-white/45 text-black/70 shadow-[inset_0_0_0_.5px_rgba(255,255,255,.7),0_6px_20px_rgba(0,0,0,.08)]',
                )}
              >
                <Hat size={18} />
                Press
                <span className="inline-flex gap-1">
                  <kbd className={cn('rounded-md px-1.5 py-0.5 font-[inherit] text-caption', dark ? 'bg-white/15' : 'bg-black/8')}>⌥</kbd>
                  <kbd className={cn('rounded-md px-1.5 py-0.5 font-[inherit] text-caption', dark ? 'bg-white/15' : 'bg-black/8')}>Space</kbd>
                </span>
                or click to show Alfred
              </button>
            </div>
          ) : null}
        </div>
        {phone ? <HomeBar dark={dark} inApp={foreground !== null && !switching} onHome={goHome} onSwitcher={showSwitcher} /> : null}
      </div>
      {dock ? <Dock dark={dark} tile={tile} onAlfred={toggle} prefs={dockPrefs} onPrefs={setDockPrefs} /> : null}
      <Toaster queue={queue} inline placement={phone ? 'top' : 'bottom'} offset={phone ? STATUS_H + 8 : reserve ? 92 : 24} aria-label="Alfred notifications" />
      <PowerOverlay state={power} onWake={wake} dark={dark} />
    </Wallpaper>
  );
}
