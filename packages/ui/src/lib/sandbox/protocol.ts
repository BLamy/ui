/* @internal What the page and the sandbox's Worker say to each other. Everything from the Worker is untrusted: packages
   run there and can post anything, so the page checks what arrives (host.ts) and treats paths and output as plain data. */
import type { SandboxFetchRequest, SandboxFetchResponse, SandboxFileData } from './model';

export interface FileEntry {
  path: string;
  data: SandboxFileData;
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
  | { type: 'fetch-result'; id: number; response?: SandboxFetchResponse; error?: string }
  | { type: 'init'; root: string; files: FileEntry[]; dirs: string[]; sessions: Array<SessionState & { session: string }> }
  | { type: 'open-session'; session: string; state: SessionState }
  | { type: 'close-session'; session: string }
  | { type: 'run'; id: number; session: string; line: string }
  | { type: 'input'; session: string; data: string }
  | { type: 'abort'; id: number }
  | { type: 'resize'; session: string; cols: number; rows: number }
  /** Output the page has dealt with, in characters. */
  | { type: 'ack'; chars: number }
  | { type: 'write'; seq: number; path: string; data: SandboxFileData }
  | { type: 'mkdir'; seq: number; path: string }
  | { type: 'rename'; seq: number; from: string; to: string }
  | { type: 'remove'; seq: number; path: string };

export type RuntimeMessage =
  | { type: 'fetch'; id: number; request: SandboxFetchRequest }
  | { type: 'cancel-fetch'; id: number }
  /** The Worker's module has loaded and is listening. `href` is where the Worker was started from, and `origin` the
   *  origin it has: `null` for one of its own. `hostFetch`: its file hands some requests to the page. */
  | { type: 'hello'; href: string; origin: string; hostFetch?: boolean }
  /** The module, imported into a Worker with an origin of its own, could not load: the host refused it. */
  | { type: 'load-failed'; message: string }
  | { type: 'ready'; origin: string }
  | { type: 'failed'; message: string }
  | { type: 'output'; id: number; stream: 'stdout' | 'stderr'; data: string }
  /** What a terminal's keys are for: a script that is reading them, or (false) nothing yet. */
  | { type: 'reading'; id: number; reading: boolean }
  | { type: 'done'; id: number; exitCode: number; cwd: string; env: Record<string, string> }
  | { type: 'fs'; batch: FsBatch }
  /** A `write`, `mkdir`, `rename` or `remove` from the page has been applied. */
  | { type: 'applied'; seq: number; error?: string };
