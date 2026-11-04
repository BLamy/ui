/* What the page and the runtime's Worker say to each other. Everything from the Worker is untrusted: packages run there
   and can post anything, so the page checks what arrives (runtime.ts) and treats paths and output as plain data. */

/** A file's content: text when it is valid UTF-8, else its bytes. */
export type FileData = string | Uint8Array;

export interface FileEntry {
  path: string;
  data: FileData;
}

/** What changed on the virtual disk. */
export interface FsBatch {
  changed: FileEntry[];
  removed: string[];
  dirs: string[];
  removedDirs: string[];
}

export interface SessionState {
  cwd: string;
  env?: Record<string, string>;
  cols: number;
  rows: number;
}

export type HostMessage =
  | { type: 'init'; root: string; files: FileEntry[]; dirs: string[]; sessions: Array<SessionState & { session: string }> }
  | { type: 'open-session'; session: string; state: SessionState }
  | { type: 'close-session'; session: string }
  | { type: 'run'; id: number; session: string; line: string }
  | { type: 'input'; session: string; data: string }
  | { type: 'abort'; id: number }
  | { type: 'resize'; session: string; cols: number; rows: number }
  /** Output the page has dealt with, in characters. */
  | { type: 'ack'; chars: number }
  | { type: 'write'; seq: number; path: string; data: FileData }
  | { type: 'mkdir'; seq: number; path: string }
  | { type: 'rename'; seq: number; from: string; to: string }
  | { type: 'remove'; seq: number; path: string };

export type RuntimeMessage =
  /** The module has loaded and is listening. */
  | { type: 'hello' }
  /** The module, started in an opaque-origin Worker, couldn't load (the host doesn't allow it). */
  | { type: 'load-failed'; message: string }
  | { type: 'ready'; origin: string }
  | { type: 'failed'; message: string }
  | { type: 'output'; id: number; stream: 'stdout' | 'stderr'; data: string }
  /** What a terminal's keys are for: a script that's reading them, or (false) nothing yet. */
  | { type: 'reading'; id: number; reading: boolean }
  | { type: 'done'; id: number; exitCode: number; cwd: string; env: Record<string, string> }
  | { type: 'fs'; batch: FsBatch }
  /** A `write`, `mkdir`, `rename` or `remove` from the page has been applied. */
  | { type: 'applied'; seq: number; error?: string };
