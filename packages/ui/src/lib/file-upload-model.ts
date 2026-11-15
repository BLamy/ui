import type { FileRejectionReason } from '@ui-sdk/core/file-input';
import { formatFileSize } from '@/lib/file-size';

/* ══ File upload — the rows, the rules and the request ══
   What a file upload is made of, with no state or React: an `UploadFile` row (queued, uploading, done, error or
   rejected), the rules a FileInput checks (`FileUploadRules`) and the words for each reason it turns a file away
   (`rejectionMessage`, `describeRules`), `fileKind` for a row's icon, and `xhrUpload`, an `upload` function that
   reports real progress (fetch can't, XMLHttpRequest can). The list and its queue are the `fileUpload` primitive
   (lib/file-upload-primitive); `useFileUpload` (lib/use-file-upload) renders it in React.

   No server comes with it. `upload(file, { signal, onProgress })` is yours to write. Everything here runs in the
   browser: the rules are a convenience for the person choosing files, so the server must check them again. */

/* ── Types ── */

export type FileStatus = 'queued' | 'uploading' | 'done' | 'error' | 'rejected';
/** Why a file was turned away: one of FileInput's reasons, `duplicate`, or the string your `validate` returned. */
export type RejectionReason = FileRejectionReason | 'duplicate' | (string & {});

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
  /** For `rejected` files, the first check that said no. */
  reason?: RejectionReason;
  /** What `upload` resolved with. */
  url?: string;
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
  accept?: string | readonly string[];
  maxSize?: number;
  minSize?: number;
  maxFiles?: number;
}
type RejectionMessage = string | ((ctx: RejectionContext) => string);
/** The text for a reason: a string, or a function of the file and the rules. */
export type RejectionMessages = Partial<Record<FileRejectionReason | 'duplicate', RejectionMessage>> & Record<string, RejectionMessage | undefined>;

export interface FileUploadRules {
  /** MIME types (`application/pdf`), wildcards (`image/*`) and extensions (`.md`), as in `<input accept>`. */
  accept?: string | readonly string[];
  /** Bytes. */
  maxSize?: number;
  minSize?: number;
  /** How many files the list may hold (rejected ones don't count). With 1, a new file replaces the one it has. */
  maxFiles?: number;
  /** Let the same file (path, size, modified time) be added twice. Default false. */
  allowDuplicates?: boolean;
  /** Your own check, as FileInput's: return a reason to turn the file away (it is the row's text unless `messages` has one for it), nothing to accept. */
  validate?: (file: File) => string | null | undefined | void;
  /** The text shown for a reason, in place of the default. */
  messages?: RejectionMessages;
}

/* ── Pure helpers ── */


/** Splits an `accept` string ("image/*, .pdf") into tokens; arrays pass through. */
function parseAccept(accept: string | readonly string[] | undefined): string[] {
  if (!accept) return [];
  const list = typeof accept === 'string' ? accept.split(',') : accept;
  return list.map((t) => t.trim().toLowerCase()).filter(Boolean);
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
export function describeRules(rules: Pick<FileUploadRules, 'accept' | 'maxSize' | 'minSize' | 'maxFiles'>): string {
  const parts: string[] = [];
  const accepted = describeAccept(rules.accept);
  if (accepted !== 'Any file') parts.push(accepted);
  if (rules.maxSize != null) parts.push(`up to ${formatFileSize(rules.maxSize)}${rules.maxFiles === 1 ? '' : ' each'}`);
  if (rules.minSize != null) parts.push(`at least ${formatFileSize(rules.minSize)}`);
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

/** The text for a reason a file was turned away, honoring overrides. A reason of your own `validate` is its own text. */
export function rejectionMessage(reason: RejectionReason, ctx: RejectionContext, overrides?: RejectionMessages): string {
  const custom = overrides?.[reason];
  if (typeof custom === 'string') return custom;
  if (custom) return custom(ctx);
  switch (reason) {
    case 'file-type':
      return `Unsupported file type. Accepted: ${describeAccept(ctx.accept)}.`;
    case 'file-too-large':
      return `Larger than the ${formatFileSize(ctx.maxSize ?? 0)} limit.`;
    case 'file-too-small':
      return `Smaller than the ${formatFileSize(ctx.minSize ?? 0)} minimum.`;
    case 'too-many-files':
      return ctx.maxFiles == null || ctx.maxFiles === 1 ? 'Only one file is allowed.' : `Only ${ctx.maxFiles} files are allowed.`;
    case 'duplicate':
      return 'Already added.';
    default:
      return reason || 'This file isn’t allowed.';
  }
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
