/* macOS — a desktop (wallpaper, menu bar, Dock, windows) whose apps are the other examples: Reminders, Mail, Safari, Notes,
   Music, Passwords, System Settings, Time Machine, Maps, Delivery, Freeform, GitHub, Discord, Codex, VS Code, OpenCode, T3 Code and Loop QA. Open one
   from the Dock or from Alfred; windows drag, resize, zoom, minimize and stack. Right-click the Dock to turn
   magnification off or hiding on (a hidden Dock slides up from the bottom edge, and windows take its room).
   Alfred is the launcher on top, on the CommandMenu primitive: type an app's name and press Enter. Its features are
   pages you open with Enter: Calculator (also inline at the root when you type math), Clipboard History with a
   preview and pinning, an Emoji grid, Snippets, File Search with nested folders, System commands (lock, sleep,
   empty Trash, dark mode, restart…), Web Search, and multi-step Workflows. ⌥Space hides and shows the bar; Esc
   clears, then hides. All sample data is invented; the clock is fixed at 9:41.
   The menu bar's Tailscale and Wi-Fi items open menus. The desktop owns one Tailscale controller (the real Tailscale by
   default; the WebAssembly client loads only when someone signs in), shared by the Tailscale menu, Safari and VS Code:
   sign in from either, and an exit node chosen in either shows in both. The Tailscale menu composes the core Tailscale parts
   with exit nodes drawn like Wi-Fi networks; the Wi-Fi menu is invented sample data.
   Under 640px wide the desktop becomes an iPhone: a status bar, a springboard of the same apps (Search opens Alfred),
   and full-screen apps that zoom out of their icons; the home bar sends one back, and double-tapping it opens the app
   switcher. The phone never moves or minimizes a window, so widening the container brings every app back where it was. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePersistentState } from '@/lib/persistent-state';
import { createCommandMenuController, type CommandMenuController } from '@/components/ui/command-menu';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { ToastRegion, createHud, type Hud } from '@/components/ui/toast';
import { useShortcut } from '@ui-sdk/react/shortcuts';
import { useContainerSize } from '@/lib/container';
import { usePresence } from '@/lib/presence';
import { sizeClassOf } from '@/lib/size-class';
import { useSessionRecording } from '@/lib/session-recorder';
import { BLProvider, useAppearance } from '@/lib/theme';
import type { Tailscale, TailscaleOptions } from '@/lib/tailscale';
import { TailscaleProvider } from '@/lib/tailscale-react';
import { cn } from '@/lib/utils';
import { APPS } from './apps';
import { DesktopProvider, useDesktop } from './desktop';
import { Launcher } from './launcher';
import { Dock, Hat, MenuBar, PowerOverlay, Wallpaper, type DockPrefs } from './parts';
import { AppSwitcher, HOME_H, HomeBar, STATUS_H, Springboard, StatusBar, useSwitcher, type Point } from './phone';
import { AlfredProvider, useAlfred } from './state';
import type { StatusMenu } from './status-items';
import { desktopTailnet } from './tailnet';
import { DesktopWindow } from './windows';

/** Alfred's accent: its hat's purple. */
const ALFRED_TINT = { light: '#5B4BD6', dark: '#8E7FFF' } as const;

/** Menu bar height. */
const MENU_H = 28;

/** A compact desktop (under the kit's medium size class, 640px) is a phone. The desktop measures its box anyway, for
    the windows' room, so the class comes from the same measurement. */
const isPhone = (width: number) => sizeClassOf(width) === 'compact';

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
  /** Options for the one Tailscale controller the desktop makes (shared by the menu bar and Safari). Default: the real Tailscale,
   *  with this tab as the device (see tailnet.ts). Stories and tests pass the simulated tailnet's (`createDemoTailnet().options`). */
  tailscale?: TailscaleOptions;
  /** A controller you made yourself (and perhaps signed in). Takes precedence over `tailscale`. */
  controller?: Tailscale;
  /** Open one of the menu bar's menus on load. */
  initialMenu?: StatusMenu;
}

export default function MacOS({ initialApps, initialPages, initialQuery = '', defaultOpen = true, autoFocus = true, record = true, dock, persist = false, tailscale, controller, initialMenu }: MacOSProps) {
  useSessionRecording({ enabled: record });
  const ambient = useAppearance() === 'dark';
  const key = persist ? (typeof persist === 'string' ? persist : 'bl-macos') : null;
  const [override, setOverride] = usePersistentState<boolean | null>(key && `${key}:dark`, null, (v): v is boolean | null => v === null || typeof v === 'boolean');
  const dark = override ?? ambient;
  const [hud] = useState(() => createHud());
  const [open, setOpen] = useState(defaultOpen);
  // The props seed the first opening; later ones start at the root, in a fresh bar (`opening` keys it, so showing it
  // again while it is still leaving mounts a new one inside the same, interrupted, animation).
  const [boot, setBoot] = useState({ pages: initialPages, query: initialQuery, focus: autoFocus, opening: 0 });
  const [menu] = useState(createCommandMenuController);
  // The one Tailscale controller of this desktop, made once on first render; the real Tailscale unless told otherwise.
  const [real] = useState(() => (controller || tailscale ? null : desktopTailnet()));

  // Back to the root with an empty query: after a workflow, or reopening a bar that is still animating out.
  const reset = useCallback(() => { menu.setPages([]); menu.setQuery(''); }, [menu]);
  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => {
    setBoot((b) => ({ pages: [], query: '', focus: true, opening: b.opening + 1 }));
    reset();
    setOpen(true);
  }, [reset]);

  return (
    <BLProvider dark={dark} tint={ALFRED_TINT[dark ? 'dark' : 'light']} className="bg-transparent">
      <TailscaleProvider tailscale={controller} options={tailscale ?? real ?? undefined}>
        <AlfredProvider hud={hud} dark={dark} toggleDark={() => setOverride(!dark)} reset={reset} close={close}>
          <Desktop dark={dark} open={open} show={show} close={close} boot={boot} menu={menu} hud={hud} initialApps={initialApps} initialDock={dock} persistKey={key} initialMenu={initialMenu} />
        </AlfredProvider>
      </TailscaleProvider>
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
  const [wide, setWide] = useState(!isPhone(size.width) ? area : { width: 900, height: 640 - MENU_H });
  if (!isPhone(size.width) && (wide.width !== area.width || wide.height !== area.height)) setWide(area);
  return (
    <div ref={ref} data-slot="macos" className="relative h-full w-full">
      <DesktopProvider area={area} openArea={!isPhone(size.width) ? area : wide} initialApps={initialApps} persistKey={persistKey ? `${persistKey}:desktop` : undefined}>
        <Screen {...rest} persistKey={persistKey} size={size} />
      </DesktopProvider>
    </div>
  );
}

interface ScreenProps {
  dark: boolean; open: boolean; show: () => void; close: () => void;
  boot: { pages?: string[]; query: string; focus: boolean; opening: number }; menu: CommandMenuController;
  hud: Hud;
  initialDock?: Partial<DockPrefs>;
  persistKey?: string | null;
  initialMenu?: StatusMenu;
}

function Screen({ dark, open, show, close, boot, menu, hud, initialDock, persistKey, initialMenu, size }: ScreenProps & { size: { width: number; height: number } }) {
  const { power, setPower } = useAlfred();
  const desktop = useDesktop();
  // A phone-sized desktop is an iPhone: its own chrome, a springboard, and one full-screen app at a time.
  const phone = isPhone(size.width);
  // Alfred's bar pops in, and out on close (the kit's presence on UI SDK's animateIn / animateOut): it stays mounted,
  // inert, until its exit has played, and showing it again turns the exit around.
  const bar = usePresence<HTMLDivElement>(open, { appear: true });
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
  const toggle = () => (open ? close() : show());

  // ⌥Tab brings back the window behind the front one (a Mac's ⌘Tab, which the browser keeps for itself).
  const cycle = () => {
    const order = [...desktop.windows].sort((a, b) => b.z - a.z);
    const next = order[1] ?? order[0];
    if (next) desktop.open(next.app);
  };
  useShortcut(!power && !phone ? 'alt+tab' : null, (event) => { event.preventDefault(); cycle(); });

  // ⌥Space, Alfred's hotkey. Matched by the physical key: on a Mac ⌥Space types a non-breaking space, which UI SDK's
  // shortcut matcher reads as another key (see the report's UI SDK gaps).
  useEffect(() => {
    if (power) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.repeat) return;
      e.preventDefault();
      toggle();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [power, toggle]);

  const wake = useCallback(() => setPower(null), [setPower]);

  return (
    <Wallpaper dark={dark}>
      <div className="flex h-full flex-col">
        {phone ? <StatusBar dark={dark} inApp={foreground !== null && !switching} /> : <MenuBar dark={dark} onAlfred={toggle} initialMenu={initialMenu} />}
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
          {bar.mounted ? (
            <div
              ref={bar.ref}
              data-slot="macos-alfred"
              className={cn(
                'absolute left-1/2 z-20 -translate-x-1/2 transition-[opacity,translate,scale] duration-spring-snappy ease-spring-snappy',
                'data-starting-style:opacity-0 motion-safe:data-starting-style:-translate-y-3 motion-safe:data-starting-style:scale-90',
                'data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-exit data-ending-style:ease-exit motion-safe:data-ending-style:scale-96',
              )}
              style={{ top, width }}
            >
              <Launcher
                key={boot.opening}
                controller={menu} initialPages={boot.pages} initialQuery={boot.query} autoFocus={boot.focus}
                width={width} listHeight={listHeight} onClose={close}
              />
            </div>
          ) : !desktop.windows.length && !phone ? (
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: top + 12 }}>
              <SdkButton
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
              </SdkButton>
            </div>
          ) : null}
        </div>
        {phone ? <HomeBar dark={dark} inApp={foreground !== null && !switching} onHome={goHome} onSwitcher={showSwitcher} /> : null}
      </div>
      {dock ? <Dock dark={dark} tile={tile} onAlfred={toggle} prefs={dockPrefs} onPrefs={setDockPrefs} /> : null}
      <ToastRegion variant="hud" toaster={hud.toaster} side={phone ? 'top' : 'bottom'} offset={phone ? STATUS_H + 8 : reserve ? 92 : 24} aria-label="Alfred notifications" />
      <PowerOverlay state={power} onWake={wake} dark={dark} />
    </Wallpaper>
  );
}
