'use client';
import { formatBytes } from './format-bytes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isDirectoryDropItem, isFileDropItem, type DropItem } from 'react-aria-components';

/* ══ File upload — state, validation and transport ══
   `useFileUpload` keeps a list of files and works through it: every file you `add` is checked against the rules
   (type, size, count, duplicates, your own `validate`), the ones that pass are queued, and a concurrency-limited
   scheduler hands them to your `upload` function one by one. A file that fails a rule stays in the list as
   `rejected` with a reason, so the UI can say why. The list is controlled (`files` + `onFilesChange`) or not.

     const up = useFileUpload({ accept: ['image/*'], maxSize: 5 * MB, upload: xhrUpload('/api/upload') })
     up.add(files)      up.remove(id)      up.retry(id)      up.uploadAll()      up.clear()

   No server comes with it. `upload(file, { signal, onProgress })` is yours to write; `xhrUpload` is the one most
   people need (fetch can't report upload progress, XMLHttpRequest can). The pure helpers (`matchesAccept`,
   `formatBytes`, `validateFiles`, `readDropItems`) work without React. Everything here runs in the browser: the
   rules are a convenience for the person choosing files, so the server must check them again. */

/* ── Types ── */

export type FileStatus = 'queued' | 'uploading' | 'done' | 'error' | 'rejected';
export type RejectionCode = 'type' | 'too-large' | 'too-small' | 'too-many' | 'duplicate' | 'invalid';

export interface UploadFile {
  id: string;
  file: File;
  /** The name, or the path inside a picked or dropped folder ("photos/2024/a.jpg"). */
  path: string;
  status: FileStatus;
  /** 0–1. */
  progress: number;
  /** Why it failed (`error`) or was turned away (`rejected`). */
  error?: string;
  /** For `rejected` files, which rule said no. */
  reason?: RejectionCode;
  /** What `upload` resolved with. */
  url?: string;
}

/** A file together with where it came from inside a folder. */
export interface FileEntry {
  file: File;
  path: string;
}

export interface UploadContext {
  id: string;
  path: string;
  /** Aborted when the file is removed or the component unmounts. Pass it to `fetch` / honor it in your own code. */
  signal: AbortSignal;
  /** Report 0–1 as bytes go out. */
  onProgress: (progress: number) => void;
}
export interface UploadResult {
  url?: string;
}
export type UploadFn = (file: File, context: UploadContext) => Promise<UploadResult | void>;

export interface RejectionContext {
  file: File;
  path: string;
  accept?: readonly string[];
  maxSize?: number;
  minSize?: number;
  maxFiles?: number;
}
export type RejectionMessages = Partial<Record<RejectionCode, string | ((ctx: RejectionContext) => string)>>;

export interface FileRules {
  /** MIME types (`application/pdf`), wildcards (`image/*`) and extensions (`.md`), as in `<input accept>`. */
  accept?: readonly string[];
  /** Bytes. */
  maxSize?: number;
  minSize?: number;
  /** How many files the list may hold (rejected ones don't count). */
  maxFiles?: number;
  /** Let the same file (path, size, modified time) be added twice. Default false. */
  allowDuplicates?: boolean;
  /** Your own rule: return a message (or `false`) to reject, nothing to accept. */
  validate?: (file: File, context: { path: string; files: readonly UploadFile[] }) => string | false | null | undefined | void;
  /** Override the reason shown for a rule. */
  messages?: RejectionMessages;
}

/* ── Pure helpers ── */


/** Splits an `accept` string ("image/*, .pdf") into tokens; arrays pass through. */
export function parseAccept(accept: string | readonly string[] | undefined): string[] {
  if (!accept) return [];
  const list = typeof accept === 'string' ? accept.split(',') : accept;
  return list.map((t) => t.trim().toLowerCase()).filter(Boolean);
}

/**
 * Whether a file passes an accept list, the way `<input accept>` reads it: `.ext` matches the name's ending,
 * `type/*` the MIME type's family, `type/sub` the exact type. No list, or a bare `*`, accepts everything.
 * Browsers leave `type` blank for many files, so extensions are the dependable half.
 */
export function matchesAccept(file: { name: string; type?: string }, accept: string | readonly string[] | undefined): boolean {
  const tokens = parseAccept(accept);
  if (!tokens.length) return true;
  const mime = (file.type ?? '').toLowerCase().split(';')[0].trim();
  const name = file.name.toLowerCase();
  return tokens.some((t) => {
    if (t === '*' || t === '*/*') return true;
    if (t.startsWith('.')) return name.endsWith(t);
    if (t.endsWith('/*')) return mime.startsWith(t.slice(0, -1));
    return mime === t;
  });
}

/** A short description of an accept list: "Images, PDFs and .md files"; "Any file" with none. */
export function describeAccept(accept: string | readonly string[] | undefined): string {
  const tokens = parseAccept(accept);
  if (!tokens.length || tokens.includes('*') || tokens.includes('*/*')) return 'Any file';
  const words = tokens.map((t) => {
    if (t.startsWith('.')) return `${t} files`;
    if (t === 'application/pdf') return 'PDFs';
    const [major, minor] = t.split('/');
    if (minor === '*') return { image: 'Images', video: 'Videos', audio: 'Audio', text: 'Text files' }[major] ?? `${major} files`;
    return minor ? `${minor.replace(/^x-/, '').toUpperCase()} files` : t;
  });
  const unique = [...new Set(words)];
  return unique.length > 1 ? `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}` : unique[0];
}

/** The rules as a hint line: "Images and PDFs · up to 5 MB each · up to 5 files". Empty with no rules. */
export function describeRules(rules: Pick<FileRules, 'accept' | 'maxSize' | 'minSize' | 'maxFiles'>): string {
  const parts: string[] = [];
  const accepted = describeAccept(rules.accept);
  if (accepted !== 'Any file') parts.push(accepted);
  if (rules.maxSize != null) parts.push(`up to ${formatBytes(rules.maxSize)}${rules.maxFiles === 1 ? '' : ' each'}`);
  if (rules.minSize != null) parts.push(`at least ${formatBytes(rules.minSize)}`);
  if (rules.maxFiles != null && rules.maxFiles > 1) parts.push(`up to ${rules.maxFiles} files`);
  return parts.join(' · ');
}

export type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic|heif|bmp|svg|ico)$/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|flac|ogg|opus|aiff?)$/i;
const ARCHIVE_EXT = /\.(zip|tar|gz|tgz|bz2|xz|7z|rar|zst|dmg)$/i;
const TEXT_EXT = /\.(txt|md|mdx|csv|tsv|json|ya?ml|toml|xml|html?|css|[mc]?[jt]sx?|py|rb|go|rs|java|sh|sql|log)$/i;

/** What a file is, from its MIME type with the name's extension as the fallback (browsers leave many types blank). */
export function fileKind(file: { name: string; type?: string }): FileKind {
  const mime = (file.type ?? '').toLowerCase();
  if (mime.startsWith('image/') || (!mime && IMAGE_EXT.test(file.name))) return 'image';
  if (mime.startsWith('video/') || (!mime && VIDEO_EXT.test(file.name))) return 'video';
  if (mime.startsWith('audio/') || (!mime && AUDIO_EXT.test(file.name))) return 'audio';
  if (mime === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (/zip|tar|gzip|rar|7z/.test(mime) || ARCHIVE_EXT.test(file.name)) return 'archive';
  if (mime.startsWith('text/') || /json|xml|javascript|yaml/.test(mime) || TEXT_EXT.test(file.name)) return 'text';
  return 'other';
}

let seq = 0;
/** A unique id for a list entry (not cryptographic; this is a React key, not a secret). */
export function newFileId(): string {
  return `f${(++seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const fileKey = (path: string, file: File) => `${path}|${file.size}|${file.lastModified}`;

/** The message for a rule, honoring overrides. */
export function rejectionMessage(code: RejectionCode, ctx: RejectionContext, overrides?: RejectionMessages): string {
  const custom = overrides?.[code];
  if (typeof custom === 'string') return custom;
  if (custom) return custom(ctx);
  switch (code) {
    case 'type':
      return `Unsupported file type. Accepted: ${describeAccept(ctx.accept)}.`;
    case 'too-large':
      return `Larger than the ${formatBytes(ctx.maxSize ?? 0)} limit.`;
    case 'too-small':
      return `Smaller than the ${formatBytes(ctx.minSize ?? 0)} minimum.`;
    case 'too-many':
      return ctx.maxFiles === 1 ? 'Only one file is allowed.' : `Only ${ctx.maxFiles} files are allowed.`;
    case 'duplicate':
      return 'Already added.';
    default:
      return 'This file isn’t allowed.';
  }
}

/** Normalizes what `add` accepts (a FileList, Files, or entries from a folder) to entries. */
export function toEntries(input: ArrayLike<File | FileEntry>): FileEntry[] {
  return Array.from(input, (item) =>
    item instanceof File ? { file: item, path: (item as File & { webkitRelativePath?: string }).webkitRelativePath || item.name } : item,
  );
}

/**
 * Checks files against the rules, in order: type, size, duplicates, your `validate`, then the count. Returns one
 * entry per file: `queued` ones passed, `rejected` ones carry a `reason` and a message. `existing` is the
 * current list (for duplicates and the count). Pure: nothing is added anywhere.
 */
export function validateFiles(entries: readonly FileEntry[], existing: readonly UploadFile[], rules: FileRules = {}): UploadFile[] {
  const accept = rules.accept;
  const seen = new Set(existing.filter((f) => f.status !== 'rejected').map((f) => fileKey(f.path, f.file)));
  let count = existing.filter((f) => f.status !== 'rejected').length;
  return entries.map(({ file, path }) => {
    const ctx: RejectionContext = { file, path, accept, maxSize: rules.maxSize, minSize: rules.minSize, maxFiles: rules.maxFiles };
    const reject = (reason: RejectionCode, message?: string): UploadFile => ({
      id: newFileId(),
      file,
      path,
      status: 'rejected',
      progress: 0,
      reason,
      error: message ?? rejectionMessage(reason, ctx, rules.messages),
    });
    if (accept?.length && !matchesAccept(file, accept)) return reject('type');
    if (rules.maxSize != null && file.size > rules.maxSize) return reject('too-large');
    if (rules.minSize != null && file.size < rules.minSize) return reject('too-small');
    const key = fileKey(path, file);
    if (!rules.allowDuplicates && seen.has(key)) return reject('duplicate');
    if (rules.validate) {
      const verdict = rules.validate(file, { path, files: existing });
      if (typeof verdict === 'string') return reject('invalid', verdict);
      if (verdict === false) return reject('invalid');
    }
    if (rules.maxFiles != null && count >= rules.maxFiles) return reject('too-many');
    seen.add(key);
    count++;
    return { id: newFileId(), file, path, status: 'queued', progress: 0 };
  });
}

const isHiddenPath = (path: string) => path.includes('/') && path.split('/').slice(1).some((segment) => segment.startsWith('.'));

/** Entries for a native file list; a folder picked with `acceptDirectory` keeps its relative paths (minus dotfiles unless `skipHidden` is false). */
export function entriesFromFileList(list: FileList | readonly File[] | null | undefined, { skipHidden = true } = {}): FileEntry[] {
  const entries = list ? toEntries(Array.from(list)) : [];
  return skipHidden ? entries.filter((e) => !isHiddenPath(e.path)) : entries;
}

export interface ReadDropOptions {
  /** Stop after this many files (default 1000) and report `truncated`. */
  limit?: number;
  /** Skip dotfiles found inside a dropped folder (`.DS_Store`, `.git`). Files dropped by themselves are kept. Default true. */
  skipHidden?: boolean;
  /** Read dropped folders (default true). Off, folders are skipped and counted in `skippedFolders`. */
  directories?: boolean;
}

/**
 * The files in react-aria's drop items. Folders are read recursively and flattened, each file keeping its path
 * relative to the dropped folder ("photos/2024/a.jpg"); text and other non-file items are ignored. Entries come
 * from `webkitGetAsEntry`, so it works wherever react-aria's drop target does (not on every touch browser).
 */
export async function readDropItems(
  items: Iterable<DropItem>,
  { limit = 1000, skipHidden = true, directories = true }: ReadDropOptions = {},
): Promise<{ entries: FileEntry[]; truncated: boolean; skippedFolders: number }> {
  const entries: FileEntry[] = [];
  let truncated = false;
  let skippedFolders = 0;
  const walk = async (item: DropItem, prefix: string): Promise<void> => {
    if (entries.length >= limit) {
      truncated = true;
      return;
    }
    const nested = prefix !== '';
    if (isFileDropItem(item)) {
      if (nested && skipHidden && item.name.startsWith('.')) return;
      entries.push({ file: await item.getFile(), path: prefix + item.name });
    } else if (isDirectoryDropItem(item)) {
      if (!directories) {
        skippedFolders++;
        return;
      }
      if (nested && skipHidden && item.name.startsWith('.')) return;
      try {
        for await (const child of item.getEntries()) {
          if (entries.length >= limit) {
            truncated = true;
            break;
          }
          await walk(child, `${prefix}${item.name}/`);
        }
      } catch {
        // An unreadable folder contributes nothing; the rest of the drop still counts.
      }
    }
  };
  for (const item of items) await walk(item, '');
  return { entries, truncated, skippedFolders };
}

/* ── xhrUpload ── */

export interface XhrUploadOptions {
  /** Default `POST` (`PUT` for a presigned URL). */
  method?: string;
  /** Request headers. Leave `Content-Type` out for multipart: the browser adds the boundary. */
  headers?: Record<string, string>;
  /** The multipart field the file goes in. Default `file`. */
  fieldName?: string;
  /** More multipart fields, or a function of the file. */
  extraFields?: Record<string, string> | ((file: File) => Record<string, string>);
  /** `form-data` (default) sends multipart; `raw` sends the file itself as the body (S3-style presigned PUT). */
  body?: 'form-data' | 'raw';
  withCredentials?: boolean;
  /** Milliseconds before giving up (default: none). */
  timeout?: number;
  /** Read the result from the response. Default: JSON `{ url }` / `{ location }`, else the `Location` header. */
  parseResponse?: (xhr: XMLHttpRequest) => UploadResult | void;
}

function defaultParse(xhr: XMLHttpRequest): UploadResult | void {
  try {
    const json = JSON.parse(xhr.responseText) as { url?: unknown; location?: unknown };
    const url = json.url ?? json.location;
    if (typeof url === 'string') return { url };
  } catch {
    // Not JSON: fall through to the header.
  }
  const location = xhr.getResponseHeader('Location');
  return location ? { url: location } : undefined;
}

/**
 * An `upload` function that sends the file with XMLHttpRequest, reporting real progress (`fetch` cannot). Rejects
 * with a readable `Error` on a non-2xx status, a network error or a timeout, and with an `AbortError` when the
 * signal fires. `url` may be a function of the file (to ask your server for a presigned URL first, make `upload`
 * yourself and call `xhrUpload(presigned)(file, ctx)`).
 */
export function xhrUpload(url: string | ((file: File) => string), options: XhrUploadOptions = {}): UploadFn {
  const { method = 'POST', headers, fieldName = 'file', extraFields, body = 'form-data', withCredentials, timeout, parseResponse = defaultParse } = options;
  return (file, { signal, onProgress }) =>
    new Promise<UploadResult | void>((resolve, reject) => {
      const abortError = () => new DOMException('Upload aborted', 'AbortError');
      if (signal.aborted) return reject(abortError());
      const xhr = new XMLHttpRequest();
      xhr.open(method, typeof url === 'function' ? url(file) : url);
      if (withCredentials) xhr.withCredentials = true;
      if (timeout) xhr.timeout = timeout;
      for (const [name, value] of Object.entries(headers ?? {})) xhr.setRequestHeader(name, value);
      const onAbort = () => xhr.abort();
      const done = () => signal.removeEventListener('abort', onAbort);
      signal.addEventListener('abort', onAbort);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        done();
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(parseResponse(xhr));
          } catch (error) {
            reject(error instanceof Error ? error : new Error('Unreadable response'));
          }
        } else reject(new Error(`Upload failed (${xhr.status}${xhr.statusText ? ` ${xhr.statusText}` : ''})`));
      };
      xhr.onerror = () => {
        done();
        reject(new Error('Network error'));
      };
      xhr.ontimeout = () => {
        done();
        reject(new Error('The upload timed out'));
      };
      xhr.onabort = () => {
        done();
        reject(abortError());
      };
      if (body === 'raw') xhr.send(file);
      else {
        const form = new FormData();
        for (const [name, value] of Object.entries(typeof extraFields === 'function' ? extraFields(file) : (extraFields ?? {}))) form.append(name, value);
        form.append(fieldName, file, file.name);
        xhr.send(form);
      }
    });
}

/* ── The hook ── */

export interface UseFileUploadOptions extends FileRules {
  /** Sends one file. Without it, files are validated and listed but never sent (you submit them yourself). */
  upload?: UploadFn;
  /** Start sending as soon as files are added. Default true; false waits for `uploadAll()` (or `retry`). */
  autoUpload?: boolean;
  /** How many uploads run at once. Default 3. */
  concurrency?: number;
  /** Controlled list. */
  files?: UploadFile[];
  defaultFiles?: UploadFile[];
  onFilesChange?: (files: UploadFile[]) => void;
  /** After `add`: the files that were queued and the ones turned away. */
  onAdd?: (added: UploadFile[], rejected: UploadFile[]) => void;
  onRemove?: (file: UploadFile) => void;
  onUploaded?: (file: UploadFile) => void;
  onUploadError?: (file: UploadFile, error: unknown) => void;
}

export interface FileUploadState {
  files: UploadFile[];
  /** Validates and lists files (and starts sending them when `autoUpload`). Returns what happened to each. */
  add: (input: ArrayLike<File | FileEntry>) => { added: UploadFile[]; rejected: UploadFile[] };
  /** Drops a file from the list; an upload in flight is aborted. */
  remove: (id: string) => void;
  /** Queues a failed upload again (even without `autoUpload`). */
  retry: (id: string) => void;
  /** Empties the list, aborting everything in flight. */
  clear: () => void;
  /** Starts every queued file (with `autoUpload` off), respecting the concurrency limit. */
  uploadAll: () => void;
  /** Whether anything is queued or sending. */
  isBusy: boolean;
  counts: Record<FileStatus, number>;
  /** The rules in force (for hints). */
  rules: Pick<FileRules, 'accept' | 'maxSize' | 'minSize' | 'maxFiles'>;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function useFileUpload(options: UseFileUploadOptions = {}): FileUploadState {
  const [inner, setInner] = useState<UploadFile[]>(options.defaultFiles ?? []);
  const files = options.files ?? inner;
  const latest = useRef({ options, files });
  useEffect(() => {
    latest.current = { options, files };
  });
  // The synchronous source of truth for async callbacks (progress, completion): updated by every commit, then
  // re-synced from props on the next render.
  const listRef = useRef(files);
  listRef.current = files;
  const running = useRef(new Map<string, AbortController>());
  const forced = useRef(new Set<string>());
  const runAll = useRef(false);

  const commit = useCallback((fn: (prev: UploadFile[]) => UploadFile[]) => {
    const prev = listRef.current;
    const next = fn(prev);
    if (next === prev) return;
    listRef.current = next;
    const o = latest.current.options;
    if (o.files === undefined) setInner(next);
    o.onFilesChange?.(next);
  }, []);

  const patch = useCallback(
    (id: string, changes: Partial<UploadFile>) => {
      commit((prev) => {
        const i = prev.findIndex((f) => f.id === id);
        if (i < 0) return prev;
        const keys = Object.keys(changes) as (keyof UploadFile)[];
        if (keys.every((k) => prev[i][k] === changes[k])) return prev;
        const next = prev.slice();
        next[i] = { ...prev[i], ...changes };
        return next;
      });
    },
    [commit],
  );

  const start = useCallback(
    (item: UploadFile) => {
      const upload = latest.current.options.upload;
      if (!upload) return;
      const controller = new AbortController();
      running.current.set(item.id, controller);
      forced.current.delete(item.id);
      patch(item.id, { status: 'uploading', progress: 0, error: undefined, reason: undefined });
      const current = () => listRef.current.find((f) => f.id === item.id) ?? item;
      let result: Promise<UploadResult | void>;
      try {
        result = Promise.resolve(
          upload(item.file, {
            id: item.id,
            path: item.path,
            signal: controller.signal,
            onProgress: (p) => {
              if (running.current.get(item.id) === controller) patch(item.id, { progress: clamp01(p) });
            },
          }),
        );
      } catch (error) {
        result = Promise.reject(error);
      }
      result.then(
        (res) => {
          if (running.current.get(item.id) !== controller) return;
          running.current.delete(item.id);
          patch(item.id, { status: 'done', progress: 1, error: undefined, url: res?.url });
          latest.current.options.onUploaded?.(current());
        },
        (error: unknown) => {
          if (running.current.get(item.id) !== controller) return;
          running.current.delete(item.id);
          const message = error instanceof Error && error.message ? error.message : typeof error === 'string' && error ? error : 'Upload failed';
          patch(item.id, { status: 'error', error: message });
          latest.current.options.onUploadError?.(current(), error);
        },
      );
    },
    [patch],
  );

  /** Starts as many waiting files as the concurrency limit allows. */
  const pump = useCallback(() => {
    const { upload, autoUpload = true, concurrency = 3 } = latest.current.options;
    if (!upload) return;
    let slots = Math.max(1, Math.floor(concurrency)) - running.current.size;
    for (const f of listRef.current) {
      if (slots <= 0) break;
      // `uploading` without a request in flight is left over from an unmount (or restored state): send it again.
      const waiting = f.status === 'queued' || (f.status === 'uploading' && !running.current.has(f.id));
      if (!waiting || running.current.has(f.id)) continue;
      if (!(autoUpload || runAll.current || forced.current.has(f.id))) continue;
      start(f);
      slots--;
    }
    if (running.current.size === 0 && !listRef.current.some((f) => f.status === 'queued')) runAll.current = false;
  }, [start]);

  useEffect(() => {
    pump();
  }, [files, options.autoUpload, options.concurrency, options.upload, pump]);

  useEffect(
    () => () => {
      for (const c of running.current.values()) c.abort();
      running.current.clear();
    },
    [],
  );

  const add = useCallback<FileUploadState['add']>(
    (input) => {
      const o = latest.current.options;
      const created = validateFiles(toEntries(input), listRef.current, o);
      if (!created.length) return { added: [], rejected: [] };
      commit((prev) => [...prev, ...created]);
      const added = created.filter((f) => f.status !== 'rejected');
      const rejected = created.filter((f) => f.status === 'rejected');
      o.onAdd?.(added, rejected);
      return { added, rejected };
    },
    [commit],
  );

  const remove = useCallback(
    (id: string) => {
      const item = listRef.current.find((f) => f.id === id);
      if (!item) return;
      const controller = running.current.get(id);
      running.current.delete(id);
      forced.current.delete(id);
      controller?.abort();
      commit((prev) => prev.filter((f) => f.id !== id));
      latest.current.options.onRemove?.(item);
    },
    [commit],
  );

  const retry = useCallback(
    (id: string) => {
      const item = listRef.current.find((f) => f.id === id);
      if (!item || item.status !== 'error') return;
      forced.current.add(id);
      patch(id, { status: 'queued', progress: 0, error: undefined });
    },
    [patch],
  );

  const clear = useCallback(() => {
    for (const c of running.current.values()) c.abort();
    running.current.clear();
    forced.current.clear();
    runAll.current = false;
    commit((prev) => (prev.length ? [] : prev));
  }, [commit]);

  const uploadAll = useCallback(() => {
    runAll.current = true;
    pump();
  }, [pump]);

  const counts = useMemo(() => {
    const c: Record<FileStatus, number> = { queued: 0, uploading: 0, done: 0, error: 0, rejected: 0 };
    for (const f of files) c[f.status]++;
    return c;
  }, [files]);

  return {
    files,
    add,
    remove,
    retry,
    clear,
    uploadAll,
    isBusy: counts.queued + counts.uploading > 0,
    counts,
    rules: { accept: options.accept, maxSize: options.maxSize, minSize: options.minSize, maxFiles: options.maxFiles },
  };
}

/**
 * An object URL for previewing a file (an image thumbnail), made when the component mounts and revoked when the
 * file changes or the component unmounts — so removing a row frees its preview. `undefined` until it exists and
 * wherever object URLs aren't available (server render, tests without `URL.createObjectURL`).
 */
export function useFilePreview(file: Blob | undefined, enabled = true): string | undefined {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!file || !enabled || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setUrl(undefined);
      return;
    }
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => {
      URL.revokeObjectURL(made);
    };
  }, [file, enabled]);
  return url;
}
