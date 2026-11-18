/* ══ What a sandbox is, as types ══
   A machine that runs code somewhere the page is safe from, with a disk, commands and a place it reports. Everything is
   asynchronous or a callback, because the machine is behind a message boundary. `lib/sandbox` is the first
   implementation (a Node-compatible runtime in a Worker with an origin of its own). Nothing here names how it runs, so
   another runtime can give the same files and commands. Types only: importing this loads nothing. ══ */

/** `idle`: created, nothing loaded. `loading`: starting. `restarting`: its Worker is being replaced; files are kept. */
export type SandboxStatus = 'idle' | 'loading' | 'ready' | 'restarting' | 'failed' | 'disposed';

/** Where the code runs. `opaque-origin`: in a Worker with an origin of its own, which the browser keeps out of the page's
 *  storage, cookies and DOM. `same-origin`: in an ordinary Worker of the page's origin: no DOM, cookies or localStorage,
 *  but the site's IndexedDB, caches and credentialed requests are within reach. */
export type SandboxIsolation = 'opaque-origin' | 'same-origin';

/** A file's content: text when it is valid UTF-8, else its bytes. */
export type SandboxFileData = string | Uint8Array;

export type SandboxEntryKind = 'file' | 'directory';

export interface SandboxFileEntry {
  name: string;
  kind: SandboxEntryKind;
}

export type SandboxFileEvent =
  /** A file or folder was created, or a file's content changed. */
  | { type: 'change'; path: string; kind: SandboxEntryKind }
  /** A file or folder is gone, and with it anything that was inside. */
  | { type: 'delete'; path: string }
  /** Something moved, and with it anything inside. */
  | { type: 'rename'; from: string; to: string };

/** The sandbox's disk. Paths are absolute, or relative to the sandbox's `cwd`, with `/` between segments. */
export interface SandboxFiles {
  /** Rejects when there is no such file. */
  read: (path: string) => Promise<Uint8Array>;
  readText: (path: string) => Promise<string>;
  /** Creates the file and the folders above it if need be. */
  write: (path: string, data: SandboxFileData) => Promise<void>;
  /** Creates the folder and the folders above it if need be. */
  mkdir: (path: string) => Promise<void>;
  /** What is directly in a folder, by name. Rejects when there is no such folder. */
  list: (path: string) => Promise<SandboxFileEntry[]>;
  /** Removes a file, or with `recursive` a folder and all that is in it. */
  remove: (path: string, options?: { recursive?: boolean }) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  /** Reports what changes at `path` or under it, in batches, whoever changed it: a command, or a call above. */
  watch: (path: string, listener: (events: SandboxFileEvent[]) => void) => () => void;
}

export interface SandboxOutputDetails {
  stream: 'stdout' | 'stderr';
}

export interface SandboxRunOptions {
  /** Where the command starts. Default: the sandbox's `cwd`. */
  cwd?: string;
  /** Added to the sandbox's `env` for this command. */
  env?: Record<string, string>;
  /** The terminal's size, for programs that ask. Default 80 by 24. */
  cols?: number;
  rows?: number;
  /** Aborting it is `kill()`. */
  signal?: AbortSignal;
  /** Output as it arrives, in order. */
  onOutput?: (chunk: string, details: SandboxOutputDetails) => void;
  /** A script started (`true`) or stopped (`false`) reading its input. What is written before it reads is kept for it;
   *  a terminal uses this to know whose the keys are. */
  onReadingChange?: (reading: boolean) => void;
}

export interface SandboxExit {
  exitCode: number;
  /** Set when the command did not end by itself. `unresponsive`: it ignored `kill()`, so its Worker was replaced.
   *  `restarted`: the Worker was replaced under it, for another command or by `restart()`. `unavailable`: the sandbox
   *  could not start, or was disposed. */
  interrupted?: 'unresponsive' | 'restarted' | 'unavailable';
}

export interface SandboxProcess {
  /** Sends input. It is held until the script reads its input, and dropped when the command ends. */
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  /** Asks the command to stop, as Ctrl-C does. One that does not stop is ended with its Worker; files are kept. */
  kill: () => void;
  /** Never rejects: a command that could not run exits with a code and says why in `interrupted`. */
  readonly exit: Promise<SandboxExit>;
}

export interface SandboxShellOptions {
  /** Where the shell starts. Default: the sandbox's `cwd`. */
  cwd?: string;
  /** Added to the sandbox's `env`. */
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

/** A shell that remembers: `cd` and `export` in one command hold for the next, as they do in a terminal. */
export interface SandboxShell {
  /** Where the next command starts. */
  readonly cwd: string;
  /** One command at a time: a terminal waits for a command's `exit` before it runs the next. */
  run: (command: string, options?: Omit<SandboxRunOptions, 'cwd' | 'env' | 'cols' | 'rows'>) => SandboxProcess;
  resize: (cols: number, rows: number) => void;
  dispose: () => void;
}

/** A request the sandboxed code made that the page is asked to answer (see `onHostFetch`). */
export interface SandboxFetchRequest {
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body: Uint8Array | null;
  redirect: RequestRedirect;
}

export interface SandboxFetchResponse {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: Uint8Array | null;
}
