'use client';
import { useEffect, useImperativeHandle, useRef, useState, type FocusEvent, type HTMLAttributes, type Ref } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Terminal as WTerminal, type TerminalHandle as WTerminalHandle, type TerminalProps as WTerminalProps } from '@wterm/react';
import type { TerminalCore, WTerm } from '@wterm/dom';
import {
  createTerminalShell,
  type TerminalCommandHandler, type TerminalCompleter, type TerminalShell,
} from '@/lib/terminal-line';
import { useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';

/* ══ Terminal — a real terminal emulator (wterm) that fills its container and wears the theme.
   <Terminal onData={(keys) => socket.send(keys)} ref={term} />             bytes both ways, for something with a PTY
   <Terminal prompt="$ " onCommand={async (line, io) => { io.write(…) }} /> whole lines, for something without one
   <Terminal shell={shell} />                                               a shell you keep outside, across remounts

   wterm's stylesheet comes in through the library's stylesheet, under every utility (styles.css), so the recipe below
   themes it with its own custom properties: an unlayered copy would outrank these classes. ══ */

/* The sixteen ANSI colors, from the theme's status colors. A palette has no magenta or cyan, so those mix red with blue
   and blue with green. On a light surface the status colors are too pale to read as text, so each is darkened there.
   "white" is a mid gray in light, as in VS Code's light theme: it's the color programs use for quiet text. All of them are
   opaque, mixed rather than `--muted-foreground`, because the terminal core takes them as plain RGB and drops any alpha. */
export const terminalVariants = cva(
  [
    'bl-scroll size-full min-h-0 min-w-0 rounded-none p-2 font-mono shadow-none',
    '[--term-bg:var(--background)] [--term-fg:var(--foreground)] [--term-cursor:var(--primary)]',
    '[--term-selection-bg:color-mix(in_oklab,var(--primary)_30%,transparent)] selection:bg-primary/30',
    '[--term-search-match:color-mix(in_oklab,var(--term-yellow)_30%,transparent)] [--term-search-active:color-mix(in_oklab,var(--term-yellow)_55%,transparent)] [--term-search-border:var(--term-yellow)]',
    '[--term-red:var(--destructive)] [--term-green:var(--success,oklch(0.723_0.191_149.6))] [--term-yellow:var(--warning,oklch(0.769_0.165_70.1))] [--term-blue:var(--link,var(--primary))]',
    '[--term-magenta:color-mix(in_oklch,var(--term-red),var(--term-blue))] [--term-cyan:color-mix(in_oklch,var(--term-blue),var(--term-green))]',
    '[--term-color-0:var(--foreground)] [--term-color-7:color-mix(in_oklab,var(--foreground)_55%,var(--background))] [--term-color-8:color-mix(in_oklab,var(--foreground)_55%,var(--background))] [--term-color-15:color-mix(in_oklab,var(--foreground)_70%,var(--background))]',
    '[--term-color-1:color-mix(in_oklab,var(--term-red)_85%,black)] [--term-color-2:color-mix(in_oklab,var(--term-green)_65%,black)] [--term-color-3:color-mix(in_oklab,var(--term-yellow)_55%,black)]',
    '[--term-color-4:color-mix(in_oklab,var(--term-blue)_85%,black)] [--term-color-5:color-mix(in_oklab,var(--term-magenta)_80%,black)] [--term-color-6:color-mix(in_oklab,var(--term-cyan)_65%,black)]',
    '[--term-color-9:var(--term-red)] [--term-color-10:color-mix(in_oklab,var(--term-green)_80%,black)] [--term-color-11:color-mix(in_oklab,var(--term-yellow)_70%,black)]',
    '[--term-color-12:var(--term-blue)] [--term-color-13:var(--term-magenta)] [--term-color-14:color-mix(in_oklab,var(--term-cyan)_80%,black)]',
    'dark:[--term-color-0:color-mix(in_oklab,var(--foreground)_18%,var(--background))] dark:[--term-color-7:color-mix(in_oklab,var(--foreground)_80%,var(--background))] dark:[--term-color-15:var(--foreground)]',
    'dark:[--term-color-1:var(--term-red)] dark:[--term-color-2:var(--term-green)] dark:[--term-color-3:var(--term-yellow)] dark:[--term-color-4:var(--term-blue)] dark:[--term-color-5:var(--term-magenta)] dark:[--term-color-6:var(--term-cyan)]',
    'dark:[--term-color-9:color-mix(in_oklab,var(--term-red)_75%,white)] dark:[--term-color-10:color-mix(in_oklab,var(--term-green)_75%,white)] dark:[--term-color-11:color-mix(in_oklab,var(--term-yellow)_75%,white)]',
    'dark:[--term-color-12:color-mix(in_oklab,var(--term-blue)_75%,white)] dark:[--term-color-13:color-mix(in_oklab,var(--term-magenta)_75%,white)] dark:[--term-color-14:color-mix(in_oklab,var(--term-cyan)_75%,white)]',
  ],
  {
    variants: {
      size: {
        sm: '[--term-font-size:12px] [--term-row-height:16px]',
        md: '[--term-font-size:13px] [--term-row-height:18px]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface TerminalHandle {
  /** Prints to the terminal. With a `prompt`, above it, without disturbing the line being typed. */
  write: (data: string | Uint8Array) => void;
  /** Clears the screen and the scrollback. */
  clear: () => void;
  focus: () => void;
  /** Sets the grid size. A Terminal fills its container, so its next change of size refits it. */
  resize: (cols: number, rows: number) => void;
  /** Fits the grid to the container now. */
  fit: () => void;
  readonly cols: number;
  readonly rows: number;
  /** The wterm instance: search, selection, `readText()`… */
  readonly instance: WTerm | null;
  /** The shell behind `prompt` / `onCommand` or the `shell` prop. */
  readonly shell: TerminalShell | null;
}

type WTermEvents = Pick<WTerminalProps, 'onBinary' | 'onBell' | 'onClipboardWrite' | 'onShellIntegration' | 'onTitle' | 'onWorkingDirectory' | 'onError' | 'onResize'>;
type WTermOptions = Pick<WTerminalProps, 'cursorBlink' | 'announceOutput' | 'renderingPaused' | 'webmcp'>;

/** The terminal's memory of what scrolled away, in bytes: `ghostty` counts it that way, and its default is 10 KB. */
const SCROLLBACK_BYTES = 8 * 1024 * 1024;

/* Ghostty's core is the one that keeps text when a terminal narrows: it re-wraps lines, where wterm's small built-in core
   cuts them off for good. It also has the fuller VT emulation. It's a 600 KB WebAssembly file, fetched from your own site the
   first time a terminal shows, and if it can't be had the built-in one, embedded in the JavaScript, takes over. */
const loadGhostty = (): Promise<TerminalCore | null> =>
  import('@wterm/ghostty').then(({ GhosttyCore }) => GhosttyCore.load({ scrollbackLimit: SCROLLBACK_BYTES })).catch(() => null);

/** The core to use: yours, or Ghostty once it's loaded (`null` once it's decided on the built-in one, `undefined` until then). */
function useTerminalCore(core: TerminalProps['core']): TerminalCore | null | undefined {
  const [ghostty, setGhostty] = useState<TerminalCore | null | undefined>(undefined);
  const wantsGhostty = core === undefined || core === 'ghostty';
  useEffect(() => {
    if (!wantsGhostty) return undefined;
    let alive = true;
    let loaded: TerminalCore | null = null;
    // wterm leaves a core it was handed for its owner to dispose of.
    const dispose = (it: TerminalCore | null) => (it as { dispose?: () => void } | null)?.dispose?.();
    void loadGhostty().then((next) => {
      loaded = next;
      if (alive) setGhostty(next);
      else dispose(next);
    });
    return () => {
      alive = false;
      setGhostty(undefined);
      dispose(loaded);
    };
  }, [wantsGhostty]);
  if (wantsGhostty) return ghostty;
  return core === 'builtin' ? null : core;
}

export interface TerminalProps
  extends Omit<HTMLAttributes<HTMLDivElement>, keyof WTermEvents | 'children' | 'onInput'>, WTermEvents, WTermOptions, VariantProps<typeof terminalVariants> {
  ref?: Ref<TerminalHandle>;
  /** The terminal core. `ghostty` (default) loads a 600 KB WebAssembly file from your site on first use and re-wraps text
   *  when the terminal resizes, falling back to `builtin` if it can't be loaded. `builtin` needs no file, but narrowing a
   *  terminal cuts off what's on screen for good. Or pass a core of your own, which stays yours to dispose of. */
  core?: 'ghostty' | 'builtin' | TerminalCore;
  /** Everything the terminal sends: keys, and replies to programs' queries. With neither this nor a shell, input is
   *  echoed back, which is wterm's default. */
  onData?: (data: string) => void;
  /** Runs each line typed at the prompt. Turns on line editing, history and Ctrl-C (see `lib/terminal-line`); read once
   *  when the terminal mounts, like the rest of the shell props, except that the latest callback always runs. */
  onCommand?: TerminalCommandHandler;
  /** The prompt, one row. May carry colors. Default `$ `. */
  prompt?: string | (() => string);
  /** Tab: candidates for the word at the cursor. */
  complete?: TerminalCompleter;
  /** Ctrl-D on an empty line. */
  onEof?: () => void;
  /** Lines the up arrow starts with, oldest first. */
  history?: readonly string[];
  /** Printed before the first prompt. */
  greeting?: string;
  /** A shell you keep yourself (`createTerminalShell`). Output, the typed line and a running command outlive this
   *  component: a new Terminal given the same shell picks up where it left off. */
  shell?: TerminalShell;
  /** Output only: what's typed goes nowhere. */
  readOnly?: boolean;
  /** Take the keyboard when ready. wterm always does; without this, focus goes back where it was. */
  autoFocus?: boolean;
  /** The terminal is up: `instance.write(…)` works, and the grid fits the container. */
  onReady?: (instance: WTerm) => void;
}

const ignore = () => {};

export function Terminal({
  ref, className, style, size, core: coreProp, onData, onCommand, prompt, complete, onEof, history, greeting, shell: shellProp, readOnly, autoFocus,
  onReady, onResize, onFocusCapture, ...props
}: TerminalProps) {
  const term = useRef<WTerminalHandle>(null);
  const core = useTerminalCore(coreProp);
  const detach = useRef<(() => void) | null>(null);
  // The latest props, for a shell made once.
  const latest = useRef({ onCommand, prompt, complete, onEof });
  latest.current = { onCommand, prompt, complete, onEof };

  const own = useRef<TerminalShell | null>(null);
  if (!shellProp && onCommand && !own.current) {
    own.current = createTerminalShell({
      prompt: () => {
        const { prompt: current = '$ ' } = latest.current;
        return typeof current === 'function' ? current() : current;
      },
      onCommand: (line, io) => latest.current.onCommand?.(line, io),
      complete: (context) => latest.current.complete?.(context) ?? [],
      onEof: () => latest.current.onEof?.(),
      history,
      greeting,
    });
  }
  const shell = shellProp ?? own.current;

  // The core holds the sixteen colors as RGB, read from the CSS when it starts, so a change of appearance has to reach it.
  // Without a provider to say so, the host's `.dark` on <html> is all there is to watch.
  const appearance = useAppearance();
  useEffect(() => {
    const reread = () => term.current?.instance?.setThemeColors(null);
    if (appearance) {
      reread();
      return undefined;
    }
    const watcher = new MutationObserver(reread);
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => watcher.disconnect();
  }, [appearance]);

  // A shell made here dies with this component. Strict Mode's rehearsal unmount must not kill it, hence the timeout.
  const disposing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(disposing.current);
    return () => {
      disposing.current = setTimeout(() => {
        own.current?.dispose();
        own.current = null;
      });
    };
  }, []);

  useEffect(() => { shell?.refreshPrompt(); }, [shell, prompt]);

  const attach = (instance: WTerm) => {
    detach.current?.();
    detach.current = shell ? shell.attach({ write: (data) => instance.write(data) }, { cols: instance.cols, rows: instance.rows }) : null;
  };
  // A different shell given to a terminal that's already up.
  useEffect(() => {
    const instance = term.current?.instance;
    if (instance?.bridge && shell) {
      instance.write('\x1b[3J\x1b[2J\x1b[H');
      attach(instance);
    }
    return () => {
      detach.current?.();
      detach.current = null;
    };
    // A new shell is the only trigger.
  }, [shell]);

  /* wterm focuses its input as it starts, wherever the page's focus is. */
  const focusWas = useRef<Element | null | undefined>(undefined);
  const ready = useRef(false);

  const fit = () => term.current?.instance?.fit();

  /* The core takes a moment to load, and output doesn't wait for it. */
  const early = useRef<Array<string | Uint8Array>>([]);

  useImperativeHandle(ref, () => ({
    write: (data) => {
      if (shell) shell.write(typeof data === 'string' ? data : new TextDecoder().decode(data));
      else if (ready.current) term.current?.write(data);
      else early.current.push(data);
    },
    clear: () => {
      if (shell) shell.clear();
      else term.current?.write('\x1b[3J\x1b[2J\x1b[H');
    },
    focus: () => term.current?.focus(),
    resize: (cols, rows) => term.current?.resize(cols, rows),
    fit,
    get cols() { return term.current?.instance?.cols ?? 0; },
    get rows() { return term.current?.instance?.rows ?? 0; },
    get instance() { return term.current?.instance ?? null; },
    get shell() { return shell; },
  }), [shell]);

  // Without any of these wterm echoes what's typed, which is what a bare <Terminal /> should do.
  const handleData = readOnly ? ignore : shell ? (data: string) => { shell.input(data); onData?.(data); } : onData;

  // Starting wterm on one core and then changing it would throw away what's been written.
  if (core === undefined) {
    return <div {...props} data-slot="terminal" data-read-only={readOnly || undefined} className={cn('wterm', terminalVariants({ size }), className)} style={style} />;
  }

  return (
    <WTerminal
      {...props}
      ref={term}
      core={core ?? undefined}
      data-slot="terminal"
      data-read-only={readOnly || undefined}
      className={cn(terminalVariants({ size }), className)}
      style={style}
      autoResize
      onData={handleData}
      onResize={(cols, rows) => {
        shell?.resize(cols, rows);
        onResize?.(cols, rows);
      }}
      onFocusCapture={(event: FocusEvent<HTMLDivElement>) => {
        if (!ready.current && focusWas.current === undefined) focusWas.current = event.relatedTarget;
        onFocusCapture?.(event);
      }}
      onReady={(instance) => {
        // wterm starts at 80×24 and first fits a frame later; anything written before that would wrap at 80.
        instance.fit();
        ready.current = true;
        if (!autoFocus) {
          const input = instance.element.querySelector('textarea');
          if (input && document.activeElement === input) {
            const was = focusWas.current;
            if (was instanceof HTMLElement && was.isConnected) was.focus({ preventScroll: true });
            else input.blur();
          }
        }
        focusWas.current = undefined;
        if (readOnly) instance.write('\x1b[?25l');
        for (const data of early.current.splice(0)) instance.write(data);
        attach(instance);
        onReady?.(instance);
      }}
    />
  );
}
