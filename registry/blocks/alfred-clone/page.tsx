/* Alfred clone — a macOS launcher on the CommandMenu primitive: the bar floats over a desktop (wallpaper, menu
   bar, dock). Features are pages you open with Enter: Calculator (also inline at the root when you type math),
   Clipboard History with a preview and pinning, an Emoji grid, Snippets, File Search with nested folders, System
   commands (lock, sleep, empty Trash, dark mode, restart…), Web Search, and multi-step Workflows. ⌥Space hides
   and shows the bar; Esc clears, then hides. All sample data is invented; the clock is fixed at 9:41. */
import { useCallback, useRef, useState } from 'react';
import { useHotkey, type CommandMenuApi } from '@/components/ui/command-menu';
import { Toaster, createToastQueue } from '@/components/ui/toast';
import { useContainerSize } from '@/lib/container';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Launcher } from './launcher';
import { Dock, Hat, MenuBar, PowerOverlay, Wallpaper } from './parts';
import { AlfredProvider, useAlfred } from './state';

/** Alfred's accent: its hat's purple. */
const ALFRED_TINT = { light: '#5B4BD6', dark: '#8E7FFF' } as const;

export interface AlfredCloneProps {
  /** Pages to open on, below the root (e.g. ['calc'], ['folder:~', 'folder:~/Projects']). */
  initialPages?: string[];
  /** Text in the input to start with. */
  initialQuery?: string;
  /** Show the bar on load (default true); ⌥Space toggles it. */
  defaultOpen?: boolean;
  /** Focus the input on load (default true). */
  autoFocus?: boolean;
}

type Phase = 'open' | 'closing' | 'closed';

export default function AlfredClone({ initialPages, initialQuery = '', defaultOpen = true, autoFocus = true }: AlfredCloneProps) {
  const ambient = useAppearance() === 'dark';
  const [override, setOverride] = useState<boolean | null>(null);
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
        <Desktop dark={dark} phase={phase} setPhase={setPhase} show={show} close={close} boot={boot} menu={menu} queue={queue} />
      </AlfredProvider>
    </BLProvider>
  );
}

function Desktop({ dark, phase, setPhase, show, close, boot, menu, queue }: {
  dark: boolean; phase: Phase; setPhase: (p: Phase) => void; show: () => void; close: () => void;
  boot: { pages?: string[]; query: string; focus: boolean }; menu: React.RefObject<CommandMenuApi | null>;
  queue: ReturnType<typeof createToastQueue>;
}) {
  const { power, setPower } = useAlfred();
  const [ref, size] = useContainerSize({ width: 900, height: 640 });
  const compact = size.width < 640;
  const dock = size.height >= 480 && size.width >= 420;
  const width = Math.min(720, size.width - 24);
  const top = Math.round(Math.max(16, Math.min(140, size.height * 0.14)));
  const listHeight = Math.round(Math.max(140, Math.min(400, size.height - 28 - top - 68 - 44 - (dock ? 88 : 20))));

  // ⌥Space, Alfred's hotkey (matchesHotkey compares the physical key: on a Mac ⌥Space types a non-breaking space).
  useHotkey('alt+space', () => (phase === 'open' ? close() : show()), !power);

  const wake = useCallback(() => setPower(null), [setPower]);

  return (
    <div ref={ref} data-slot="alfred-clone" className="relative h-full w-full">
      <Wallpaper dark={dark}>
        <div className="flex h-full flex-col">
          <MenuBar dark={dark} compact={compact} onAlfred={() => (phase === 'open' ? close() : show())} />
          <div className="relative min-h-0 flex-1">
            {phase !== 'closed' ? (
              <div
                className={cn(
                  'absolute left-1/2 -translate-x-1/2 [--bl-pop-y:-12px]',
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
            ) : (
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
                    <kbd className={cn('rounded-md px-1.5 py-0.5 font-[inherit] text-[12px]', dark ? 'bg-white/15' : 'bg-black/8')}>⌥</kbd>
                    <kbd className={cn('rounded-md px-1.5 py-0.5 font-[inherit] text-[12px]', dark ? 'bg-white/15' : 'bg-black/8')}>Space</kbd>
                  </span>
                  or click to show Alfred
                </button>
              </div>
            )}
          </div>
        </div>
        {dock ? <Dock dark={dark} /> : null}
        <Toaster queue={queue} inline placement="bottom" offset={dock ? 92 : 24} aria-label="Alfred notifications" />
        <PowerOverlay state={power} onWake={wake} dark={dark} />
      </Wallpaper>
    </div>
  );
}
