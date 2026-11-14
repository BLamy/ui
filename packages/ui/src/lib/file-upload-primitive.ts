import { announce, createChange, createController, definePrimitive, type ChangeDetails, type ChangeOptions, type ChangeSource } from '@ui-sdk/core';
import {
  createFileInputController, relativePath,
  type FileInputChange, type FileInputValueChangeDetails, type FileInputValueChangeReason, type FileRejection,
  type FileRejectionReason,
} from '@ui-sdk/core/file-input';
import {
  newFileId, rejectionMessage,
  type FileStatus, type FileUploadRules, type RejectionContext, type UploadFile, type UploadFn, type UploadResult,
} from '@/lib/file-upload-model';

/* ══ fileUpload — the rows behind a FileUpload, and the queue that sends them ══
   UI SDK's FileInput does the choosing, dropping, pasting and checking; this primitive keeps what it takes as rows
   (queued, uploading, done, error, and rejected with the reason in words) and hands the queued ones to your `upload`
   function, a few at a time. `value` is the controlled key: every write, from a drop to an upload's progress tick,
   goes through `createChange` with a reason, so `onValueChange` sees it first and can refuse it with
   `details.cancel()`. The api feeds a FileInput (its `input` controller and the `receive`, `reject`, `check` and
   `announcement` handlers `useFileUpload` hands it as props), and `add`, `remove`, `retry`, `clear` and `uploadAll`
   are what a controller and an agent call. Requests in flight are aborted when their row goes, and all of them when
   the instance is destroyed. No React: `useFileUpload` (lib/file-upload-model) renders it. ══ */

/**
 * Why the list changed. A pick, a drop, a paste, a Remove press, a form reset or a controller call on the FileInput
 * keep FileInput's own reason; the rest are the list's: `reject` (files the checks turned away were listed),
 * `retry`, `clear`, and an upload's own steps, `upload-start`, `progress` and `settle` (it finished or failed).
 */
export type FileUploadValueChangeReason =
  | FileInputValueChangeReason
  | 'reject'
  | 'retry'
  | 'clear'
  | 'upload-start'
  | 'progress'
  | 'settle';

/** What `onValueChange` receives after the list: why, how, which rows came and went, and `cancel()`. */
export type FileUploadValueChangeDetails = ChangeDetails<FileUploadValueChangeReason> & {
  /** The row a one-row change is about: a removal, a retry, an upload's start, progress or end. */
  id?: string;
  /** The rows the change listed. */
  added: UploadFile[];
  /** The rows the change took out (their uploads are aborted once it goes through). */
  removed: UploadFile[];
};

/** The options `remove`, `retry` and `clear` take, like a controller's write methods. */
export type FileUploadChangeOptions = ChangeOptions<FileUploadValueChangeReason>;

/** What `add` did with the files it was given. */
export interface FileUploadAddResult {
  added: UploadFile[];
  rejected: UploadFile[];
}

/** Drives a FileUpload's list from outside it. Pass it as `controller`. */
export function createFileUploadController() {
  return createController<{
    /** Runs files through the checks, like a drop, and lists them. Works while the FileInput the list feeds is mounted. */
    add: (files: ArrayLike<File>) => FileUploadAddResult;
    /** Drops a row (by id or path); an upload in flight is aborted. Reason `imperative` unless you pass one. */
    remove: (id: string, options?: FileUploadChangeOptions) => boolean;
    /** Queues a failed upload again (by id or path), even without `autoUpload`. Reason `retry`. */
    retry: (id: string, options?: FileUploadChangeOptions) => boolean;
    /** Empties the list, aborting everything in flight. Reason `clear`. */
    clear: (options?: FileUploadChangeOptions) => boolean;
    /** Starts every queued file (with `autoUpload` off), within the concurrency limit. */
    uploadAll: () => void;
    /** The rows now. */
    files: () => UploadFile[];
  }>();
}

export type FileUploadController = ReturnType<typeof createFileUploadController>;

export interface FileUploadOptions extends FileUploadRules {
  /** Sends one file. Without it, files are validated and listed but never sent (you submit them yourself). */
  upload?: UploadFn;
  /** Start sending as soon as files are added. Default true; false waits for `uploadAll()` (or `retry`). */
  autoUpload?: boolean;
  /** How many uploads run at once. Default 3. */
  concurrency?: number;
  /** The list, controlled. */
  value?: UploadFile[];
  /** The list to start with, uncontrolled. */
  defaultValue?: UploadFile[];
  /**
   * The list wants to change. `details.reason` says why (FileInput's own reason for a pick, drop, paste or Remove;
   * `progress`, `settle`… for an upload's steps), `details.source` how (`'agent'` for an agent's call), `added` /
   * `removed` which rows. `details.cancel()` refuses it: the list stays as it was and nothing is aborted.
   */
  onValueChange?: (value: UploadFile[], details: FileUploadValueChangeDetails) => void;
  /** After a batch arrives: the files that were queued, the ones turned away, and FileInput's change details when any
   *  file was queued. */
  onAdd?: (added: UploadFile[], rejected: UploadFile[], details?: FileInputValueChangeDetails) => void;
  onRemove?: (file: UploadFile) => void;
  onUploaded?: (file: UploadFile) => void;
  onUploadError?: (file: UploadFile, error: unknown) => void;
  /** A handle from `createFileUploadController()`, to add, remove, retry, clear and start uploads from anywhere. */
  controller?: FileUploadController;
}

interface FileUploadState {
  value: UploadFile[];
}

/** What the root shows: whether anything is queued or sending, and how many rows are in each status. */
export interface FileUploadRootState {
  busy: boolean;
  counts: Record<FileStatus, number>;
}

/** How many rows are in each status. */
export function countFiles(files: readonly UploadFile[]): Record<FileStatus, number> {
  const counts: Record<FileStatus, number> = { queued: 0, uploading: 0, done: 0, error: 0, rejected: 0 };
  for (const f of files) counts[f.status]++;
  return counts;
}

/** Whether anything is queued or sending. */
export const busyOf = (counts: Record<FileStatus, number>) => counts.queued + counts.uploading > 0;

/** The rows one FileInput change produced, and the change itself. */
interface Batch {
  added: UploadFile[];
  rejected: UploadFile[];
  keys: Set<string>;
  details?: FileInputValueChangeDetails;
}

interface Write {
  reason: FileUploadValueChangeReason;
  event?: Event;
  source?: ChangeSource;
  id?: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const fileKey = (path: string, file: File) => `${path}|${file.size}|${file.lastModified}`;
const rowFor = (file: File): UploadFile => ({ id: newFileId(), file, path: relativePath(file), status: 'queued', progress: 0 });
const errorText = (error: unknown) =>
  error instanceof Error && error.message ? error.message : typeof error === 'string' && error ? error : 'Upload failed';

export const fileUpload = definePrimitive({
  name: 'file-upload',
  options: {
    upload: 'action',
    autoUpload: 'boolean',
    concurrency: 'number',
    value: 'value',
    defaultValue: 'value',
    onValueChange: 'callback',
    onAdd: 'callback',
    onRemove: 'callback',
    onUploaded: 'callback',
    onUploadError: 'callback',
    accept: 'list',
    maxSize: 'number',
    minSize: 'number',
    maxFiles: 'number',
    allowDuplicates: 'boolean',
    validate: 'action',
    messages: 'value',
    controller: 'value',
  },
  controlled: ['value'],
  state: (options: FileUploadOptions): FileUploadState => ({ value: options.defaultValue ?? [] }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const { store } = context;
    const change = createChange(context);
    const input = createFileInputController();
    const controlled = () => context.options().value !== undefined;
    // A controlled list is the owner's: what it hasn't passed back is not on the list. Two things bridge the gap until
    // it renders. `asked` is the list a write just asked for, kept only for the writes chained in the same synchronous
    // burst (a FileInput batch's receive and the reject after it), so a change the owner refuses is never resent.
    // `steps` holds the fields an upload's own steps (start, progress, settle) set on a row the owner has, so an
    // upload that moves on before the owner renders doesn't take a row back to an older status.
    let asked: UploadFile[] | null = null;
    let burstQueued = false;
    const steps = new Map<string, Partial<UploadFile>>();
    let stepped: { base: UploadFile[]; rows: UploadFile[] } | null = null;
    const owned = (): UploadFile[] => {
      const base = store.get().value;
      if (!steps.size) return base;
      if (stepped?.base !== base) {
        stepped = { base, rows: base.map((f) => (steps.has(f.id) ? { ...f, ...steps.get(f.id) } : f)) };
      }
      return stepped.rows;
    };
    const list = () => asked ?? owned();
    const endBurst = () => {
      if (burstQueued) return;
      burstQueued = true;
      queueMicrotask(() => {
        burstQueued = false;
        asked = null;
      });
    };
    const uploadStep = (reason: FileUploadValueChangeReason) => reason === 'upload-start' || reason === 'progress' || reason === 'settle';
    const running = new Map<string, AbortController>();
    const forced = new Set<string>();
    let runAll = false;
    let destroyed = false;
    // The rows a batch produced, gathered across FileInput's onValueChange and onReject (and read back by `add`).
    let batch: Batch | null = null;
    // Upload outcomes waiting to be announced as one sentence.
    let outcomes: { done: string[]; failed: string[] } = { done: [], failed: [] };
    let outcomeTimer: ReturnType<typeof setTimeout> | undefined;

    /** Every write to the list: asks `onValueChange` first, and reports whether it went through. */
    function write(next: UploadFile[], { id, ...given }: Write): boolean {
      const prev = list();
      if (next === prev) return false;
      const before = new Set(prev.map((f) => f.id));
      const after = new Set(next.map((f) => f.id));
      const accepted = change('value', next, {
        ...given,
        id,
        added: next.filter((f) => !before.has(f.id)),
        removed: prev.filter((f) => !after.has(f.id)),
      });
      if (accepted && controlled()) {
        asked = next;
        endBurst();
      }
      return accepted;
    }

    /** Changes one row's fields. False when the row is gone, unchanged, or the change was refused. */
    function patch(id: string, changes: Partial<UploadFile>, given: Write): boolean {
      const prev = list();
      const i = prev.findIndex((f) => f.id === id);
      if (i < 0) return false;
      const keys = Object.keys(changes) as (keyof UploadFile)[];
      if (keys.every((k) => prev[i][k] === changes[k])) return false;
      const next = prev.slice();
      next[i] = { ...prev[i], ...changes };
      if (!write(next, { ...given, id })) return false;
      if (controlled() && uploadStep(given.reason)) {
        steps.set(id, { ...steps.get(id), ...changes });
        stepped = null;
      }
      return true;
    }

    function announceOutcome(kind: 'done' | 'failed', name: string) {
      outcomes[kind].push(name);
      clearTimeout(outcomeTimer);
      outcomeTimer = setTimeout(() => {
        const { done, failed } = outcomes;
        outcomes = { done: [], failed: [] };
        const parts: string[] = [];
        if (done.length) parts.push(done.length === 1 ? `${done[0]} uploaded` : `${done.length} files uploaded`);
        if (failed.length) parts.push(failed.length === 1 ? `${failed[0]} failed to upload` : `${failed.length} uploads failed`);
        if (parts.length) announce(`${parts.join('. ')}.`);
      }, 300);
    }

    function start(item: UploadFile) {
      const upload = context.options().upload;
      if (!upload) return;
      if (!patch(item.id, { status: 'uploading', progress: 0, error: undefined, reason: undefined }, { reason: 'upload-start' })) {
        // Refused: leave the row as it was. One that is already `uploading` (restored state) is sent anyway.
        if (list().find((f) => f.id === item.id)?.status !== 'uploading') return;
      }
      const request = new AbortController();
      running.set(item.id, request);
      forced.delete(item.id);
      const current = () => list().find((f) => f.id === item.id) ?? item;
      const live = () => running.get(item.id) === request;
      let result: Promise<UploadResult | void>;
      try {
        result = Promise.resolve(
          upload(item.file, {
            id: item.id,
            path: item.path,
            signal: request.signal,
            onProgress: (p) => {
              if (live()) patch(item.id, { progress: clamp01(p) }, { reason: 'progress' });
            },
          }),
        );
      } catch (error) {
        result = Promise.reject(error);
      }
      result.then(
        (res) => {
          if (!live()) return;
          running.delete(item.id);
          patch(item.id, { status: 'done', progress: 1, error: undefined, url: res?.url }, { reason: 'settle' });
          announceOutcome('done', item.file.name);
          context.options().onUploaded?.(current());
          wrote();
        },
        (error: unknown) => {
          if (!live()) return;
          running.delete(item.id);
          patch(item.id, { status: 'error', error: errorText(error) }, { reason: 'settle' });
          announceOutcome('failed', item.file.name);
          context.options().onUploadError?.(current(), error);
          wrote();
        },
      );
    }

    /** Starts as many waiting files as the concurrency limit allows. */
    function pump() {
      const { upload, autoUpload = true, concurrency = 3 } = context.options();
      if (destroyed || !upload) return;
      let slots = Math.max(1, Math.floor(concurrency)) - running.size;
      for (const f of list()) {
        if (slots <= 0) break;
        // `uploading` without a request in flight is left over from an unmount (or restored state): send it again.
        const waiting = f.status === 'queued' || (f.status === 'uploading' && !running.has(f.id));
        if (!waiting || running.has(f.id)) continue;
        if (!(autoUpload || runAll || forced.has(f.id))) continue;
        start(f);
        slots--;
      }
      if (running.size === 0 && !list().some((f) => f.status === 'queued')) runAll = false;
    }

    /** After a write went through: an uncontrolled list moves the queue on now, a controlled one once the owner
     *  passes the list back. */
    function wrote() {
      if (!controlled()) pump();
    }

    let pumpQueued = false;
    function pumpSoon() {
      if (pumpQueued) return;
      pumpQueued = true;
      queueMicrotask(() => {
        pumpQueued = false;
        pump();
      });
    }

    /** After a change took rows out: aborts their uploads and tells `onRemove`. */
    function settleRemoved(gone: readonly UploadFile[]) {
      for (const { id } of gone) {
        const request = running.get(id);
        running.delete(id);
        forced.delete(id);
        request?.abort();
      }
      for (const item of gone) context.options().onRemove?.(item);
    }

    /** The batch the current FileInput change belongs to; FileInput reports a batch synchronously, so it ends in a microtask. */
    function currentBatch(): Batch {
      if (batch) return batch;
      const b: Batch = { added: [], rejected: [], keys: new Set<string>() };
      batch = b;
      queueMicrotask(() => {
        if (batch === b) batch = null;
        if (b.added.length || b.rejected.length) context.options().onAdd?.(b.added, b.rejected, b.details);
      });
      return b;
    }

    const contextFor = (file: File): RejectionContext => {
      const { accept, maxSize, minSize, maxFiles } = context.options();
      return { file, path: relativePath(file), accept, maxSize, minSize, maxFiles };
    };

    /** A row by its id, or by its path when no id matches (what an agent reads off the page). */
    const find = (ref: string) => list().find((f) => f.id === ref) ?? list().find((f) => f.path === ref);

    // The owner's list, as it arrives: it replaces the one asked for, rows it dropped stop sending, and the queue moves.
    context.onOptions((_options, synced) => {
      if (synced && 'value' in synced) {
        asked = null;
        steps.clear();
        stepped = null;
        const kept = new Set((synced.value ?? []).map((f) => f.id));
        for (const [id, request] of running) {
          if (kept.has(id)) continue;
          running.delete(id);
          request.abort();
        }
      }
      pumpSoon();
    });

    context.onDestroy(() => {
      destroyed = true;
      for (const request of running.values()) request.abort();
      running.clear();
      clearTimeout(outcomeTimer);
    });

    return {
      /** The FileInput this list feeds: `open()` the picker from any button, `focus()` the trigger. */
      input,

      /** The rows now: a controlled list's are the owner's, with the steps of uploads still running. */
      files: list,

      /** FileInput's `onValueChange`: one FileInput change is one list change, so a file that replaces another
       *  (`maxFiles: 1`) is a single write. */
      receive(_value: File[], details: FileInputValueChangeDetails) {
        const removed = new Set(details.removed);
        const gone = list().filter((f) => f.status !== 'rejected' && removed.has(f.file));
        const goneIds = new Set(gone.map((f) => f.id));
        const rows = details.added.map(rowFor);
        if (!gone.length && !rows.length) return;
        const single = gone.length + rows.length === 1 ? (gone[0] ?? rows[0]).id : undefined;
        const next = [...list().filter((f) => !goneIds.has(f.id)), ...rows];
        if (!write(next, { reason: details.reason, event: details.event, source: details.source, id: single })) {
          details.cancel();
          return;
        }
        settleRemoved(gone);
        if (rows.length) {
          const b = currentBatch();
          b.added.push(...rows);
          b.details = details;
        }
        // Once the batch is in: FileInput reports the files it turned away right after this.
        if (!controlled()) pumpSoon();
      },

      /** FileInput's `onReject`: the files its checks turned away become `rejected` rows with the reason in words. */
      reject(rejected: FileRejection[], details?: { event?: Event; source?: ChangeSource }) {
        const { messages } = context.options();
        const rows = rejected.map(({ file, reasons }): UploadFile => {
          const reason = reasons[0] ?? 'invalid';
          return { ...rowFor(file), status: 'rejected', reason, error: rejectionMessage(reason, contextFor(file), messages) };
        });
        const b = currentBatch();
        if (write([...list(), ...rows], { reason: 'reject', source: details?.source ?? b.details?.source })) b.rejected.push(...rows);
      },

      /** FileInput's `validate`: your own check first, then duplicates (path, size and modified time) against the list
       *  and the batch so far. */
      check(file: File): string | null {
        const { validate, allowDuplicates } = context.options();
        const own = validate?.(file);
        if (own) return own;
        if (allowDuplicates) return null;
        const key = fileKey(relativePath(file), file);
        const b = currentBatch();
        if (b.keys.has(key) || list().some((f) => f.status !== 'rejected' && fileKey(f.path, f.file) === key)) return 'duplicate';
        b.keys.add(key);
        return null;
      },

      /** FileInput's `announcement`: what a screen reader hears after a batch. */
      announcement(change: FileInputChange): string | null {
        const parts: string[] = [];
        if (change.added.length) parts.push(change.added.length === 1 ? '1 file added' : `${change.added.length} files added`);
        if (change.rejected.length === 1) {
          const [{ file, reasons }] = change.rejected;
          const reason: FileRejectionReason | string = reasons[0] ?? 'invalid';
          parts.push(`${file.name} rejected. ${rejectionMessage(reason, contextFor(file), context.options().messages)}`.replace(/\.$/, ''));
        } else if (change.rejected.length) parts.push(`${change.rejected.length} files rejected`);
        if (change.removed.length && !change.added.length) {
          parts.push(change.removed.length === 1 ? `${change.removed[0].name} removed` : `${change.removed.length} files removed`);
        }
        return parts.length ? `${parts.join('. ')}.` : null;
      },

      add(files: ArrayLike<File>): FileUploadAddResult {
        const b = currentBatch();
        const from = { added: b.added.length, rejected: b.rejected.length };
        input.addFiles(Array.from(files), { reason: 'imperative' });
        return { added: b.added.slice(from.added), rejected: b.rejected.slice(from.rejected) };
      },

      remove(ref: string, { reason = 'imperative', event }: FileUploadChangeOptions = {}): boolean {
        const item = find(ref);
        if (!item || !write(list().filter((f) => f.id !== item.id), { reason, event, id: item.id })) return false;
        settleRemoved([item]);
        wrote();
        return true;
      },

      retry(ref: string, { reason = 'retry', event }: FileUploadChangeOptions = {}): boolean {
        const item = find(ref);
        if (item?.status !== 'error') return false;
        if (!patch(item.id, { status: 'queued', progress: 0, error: undefined }, { reason, event })) return false;
        forced.add(item.id);
        wrote();
        return true;
      },

      clear({ reason = 'clear', event }: FileUploadChangeOptions = {}): boolean {
        if (!list().length || !write([], { reason, event })) return false;
        for (const request of running.values()) request.abort();
        running.clear();
        forced.clear();
        runAll = false;
        return true;
      },

      uploadAll() {
        runAll = true;
        pump();
      },
    };
  },
  slots: (slot) => ({
    // The element around the FileInput: `data-busy` while anything is queued or sending.
    root: slot<object, FileUploadRootState>({
      state: (state) => {
        const counts = countFiles(state.value);
        return { busy: busyOf(counts), counts };
      },
      attrs: (state) => ({ 'data-busy': busyOf(countFiles(state.value)) ? '' : undefined }),
    }),
  }),
  // The rows are its items, named by path: `remove`, `retry` take a row's id or path.
  agent: {
    actions: ['remove', 'retry', 'clear', 'uploadAll'],
    items: (api) => api.files().map((f) => ({ value: f.id, label: f.path })),
  },
});
