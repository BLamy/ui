/* ══ The machine behind the window ══
   Everything the page and its parts need from whatever runs behind them, and nothing about how: the block's own
   `almostnode/` runs Node in a Worker on a virtual disk, and another implementation could be a real folder and real
   shells, over IPC. Only this file's types cross that line, and `page.tsx` takes one as its `runtime` prop.

   Paths are absolute, with `/` between segments on every platform. Nothing here assumes they are under `/`: what's in
   them, and where `root` is, is up to the implementation. ══ */

import type { OpenCodeHostBridge } from '@/lib/open-code-host';

export type Unsubscribe = () => void;

/* ── Files ── */

/** Text when it's valid UTF-8, else the bytes. An editor shows the first and not the second. */
export type FileContent = string | Uint8Array;

export type RuntimeEntryKind = 'file' | 'directory';

export interface RuntimeEntry {
  path: string;
  kind: RuntimeEntryKind;
}

export type RuntimeFileEvent =
  /** A file or folder was created, or a file's content changed. */
  | { type: 'change'; path: string; kind: RuntimeEntryKind }
  /** A file or folder is gone, and with it anything that was inside. */
  | { type: 'delete'; path: string }
  /** Something moved, and with it anything inside. Optional: a `delete` and a `change` work too, except that a tab
   *  open on the file closes rather than following it. */
  | { type: 'rename'; from: string; to: string };

export interface RuntimeFiles {
  /** The folder the Explorer shows. */
  readonly root: string;
  /** Every file and folder to show, under `root`. Leaving things out is fine: what's in a huge `node_modules`, say. */
  list: () => Promise<RuntimeEntry[]>;
  read: (path: string) => Promise<FileContent>;
  /** Creates the file and the folders above it if need be. */
  write: (path: string, content: FileContent) => Promise<void>;
  /** Creates the folder and the folders above it if need be. */
  mkdir: (path: string) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  /** Removes a file, or a folder and all that's in it. */
  delete: (path: string) => Promise<void>;
  /** Reports what changes on disk, in batches, from any cause. It may also report what was done through the methods
   *  above, or not, as a real file watcher would: the window copes with both. */
  watch: (listener: (events: readonly RuntimeFileEvent[]) => void) => Unsubscribe;
}

/* ── Terminals ── */

export interface RuntimeTerminalSize {
  cols: number;
  rows: number;
}

export interface RuntimeTerminalOptions extends RuntimeTerminalSize {
  /** Runs this command line and exits with its status, instead of an interactive shell. */
  command?: string;
  /** Browser runtimes use this to run OpenCode in the terminal pane until it exits. */
  onOpenCode?: (host: OpenCodeHostBridge, signal: AbortSignal) => Promise<void>;
}

/** A raw byte stream, as a PTY is one: `write` gets exactly what the Terminal panel's keyboard sends, Ctrl-C included, and
 *  `onOutput` passes what comes back straight to it, escape sequences and all. If there's no PTY to do line editing, the
 *  implementation does it (`createTerminalShell` from `@/lib/terminal-line`), and echoes what's typed like one. */
export interface RuntimeTerminal {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  /** Ends it, whatever it's doing. `onExit` follows. */
  kill: () => void;
  /** Output from before the first listener is held for it, so nothing is lost between opening and listening. */
  onOutput: (listener: (data: string | Uint8Array) => void) => Unsubscribe;
  /** Once, with the exit status, or null if it has none (it was killed). Also held for a listener that comes late. */
  onExit: (listener: (code: number | null) => void) => Unsubscribe;
}

export interface RuntimeTerminals {
  open: (options: RuntimeTerminalOptions) => Promise<RuntimeTerminal>;
}

/* ── The Run panel ── */

export interface RuntimeScript {
  /** How the panel names it, and what `run` takes. */
  name: string;
  /** What it does, for the panel to show. */
  command: string;
}

export interface RuntimeScriptList {
  scripts: readonly RuntimeScript[];
  /** Why there are none, for the panel to say. */
  note?: string;
}

export interface RuntimeScripts {
  list: () => Promise<RuntimeScriptList>;
  /** The list may be different now. */
  onChange: (listener: () => void) => Unsubscribe;
  /** Starts a script in a terminal of its own, which exits with the script. */
  run: (name: string, size: RuntimeTerminalSize) => Promise<RuntimeTerminal>;
}

/* ── Status ── */

export type RuntimeState = 'starting' | 'ready' | 'failed';

/** Picks the status bar's icon: `safe` and `warning` say how far what runs here can reach. */
export type RuntimeTone = 'neutral' | 'safe' | 'warning';

export interface RuntimeAction {
  label: string;
  run: () => void;
}

export interface RuntimeStatus {
  state: RuntimeState;
  /** What the status bar says, in a few words. */
  text: string;
  tone?: RuntimeTone;
  /** What a press on it opens: a heading, paragraphs, and buttons. */
  title?: string;
  details?: readonly string[];
  actions?: readonly RuntimeAction[];
}

export interface RuntimeStatusSource {
  get: () => RuntimeStatus;
  subscribe: (listener: () => void) => Unsubscribe;
}

/* ── All of it ── */

export interface VSCodeRuntime {
  files: RuntimeFiles;
  terminals: RuntimeTerminals;
  scripts: RuntimeScripts;
  status: RuntimeStatusSource;
  /** The window is up. Can be called more than once. For a runtime that waits to be needed before it starts anything. */
  start?: () => void;
  /** The window that made this runtime has gone. It's never called on one passed in as a prop: that's the owner's. */
  dispose?: () => void;
}
