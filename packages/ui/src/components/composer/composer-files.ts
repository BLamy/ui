/* ══ Composer files — kinds, accept filters, and cheap previews for attachments ══
   Pure helpers for the Composer: which kind a file is (for its tile and icon), whether it passes an
   `acceptedFileTypes` filter, and the small previews a tile shows (a video's first frame, a text file's first
   lines). No dependencies; previews give up quietly (the tile falls back to its icon). */

/** What an attachment is, for its tile: an image thumbnail, a video poster, a text excerpt, or an icon. */
export type ComposerAttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other';

const TEXT_EXT = new Set(
  (
    'txt md mdx markdown rst log csv tsv json jsonc json5 yaml yml toml ini cfg conf env xml html htm css scss sass less ' +
    'js mjs cjs jsx ts mts cts tsx vue svelte astro py rb go rs java kt kts swift m mm c h cc cpp hpp cs fs php pl lua r ' +
    'dart scala clj ex exs erl hs elm sql graphql gql sh bash zsh fish ps1 bat dockerfile makefile gradle lock diff patch'
  ).split(' '),
);
const ARCHIVE_EXT = new Set('zip tar gz tgz bz2 xz 7z rar zst dmg iso jar'.split(' '));
const TEXT_MIME = /^(text\/|application\/(json|ld\+json|xml|javascript|x-javascript|typescript|x-typescript|x-sh|x-shellscript|yaml|x-yaml|toml|sql|graphql|x-httpd-php))/;
const ARCHIVE_MIME = /^application\/(zip|x-zip-compressed|gzip|x-gzip|x-tar|x-bzip2?|x-xz|x-7z-compressed|vnd\.rar|x-rar-compressed|zstd|java-archive|x-apple-diskimage)$/;

/** The lower-case extension of a file name, without the dot ("" when there is none). */
export function fileExtension(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return /^(dockerfile|makefile)$/i.test(base) ? base.toLowerCase() : '';
  return base.slice(dot + 1).toLowerCase();
}

/** The kind of a file from its MIME type, falling back to its extension (browsers leave many types blank). */
export function attachmentKind(type: string | undefined, name?: string): ComposerAttachmentKind {
  const mime = (type ?? '').toLowerCase();
  const ext = fileExtension(name);
  // TypeScript sources arrive as MPEG transport streams (video/mp2t) on most systems.
  if (/^(ts|mts|cts)$/.test(ext) && (!mime || mime === 'video/mp2t')) return 'text';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ARCHIVE_MIME.test(mime) || ARCHIVE_EXT.has(ext)) return 'archive';
  if (TEXT_MIME.test(mime) || TEXT_EXT.has(ext)) return 'text';
  if (!mime) {
    if (/^(png|jpe?g|gif|webp|avif|heic|bmp|svg|ico)$/.test(ext)) return 'image';
    if (/^(mp4|mov|m4v|webm|mkv|avi)$/.test(ext)) return 'video';
    if (/^(mp3|m4a|aac|wav|flac|ogg|opus|aiff?)$/.test(ext)) return 'audio';
  }
  return 'other';
}

/**
 * Whether a file passes an `acceptedFileTypes` list: MIME types (`application/pdf`), wildcards (`image/*`) and
 * extensions (`.md`), as in an `<input accept>`. No list (or an empty one) accepts everything.
 */
export function acceptsFile(file: { name?: string; type?: string }, accepted: readonly string[] | undefined): boolean {
  if (!accepted?.length) return true;
  const mime = (file.type ?? '').toLowerCase();
  const name = (file.name ?? '').toLowerCase();
  return accepted.some((raw) => {
    const t = raw.trim().toLowerCase();
    if (!t || t === '*' || t === '*/*') return true;
    if (t.startsWith('.')) return name.endsWith(t);
    if (t.endsWith('/*')) return mime.startsWith(t.slice(0, -1));
    return mime === t;
  });
}

/** A short, human description of an accept list: "Images, PDFs and .md files". */
export function describeAccepted(accepted: readonly string[] | undefined): string {
  if (!accepted?.length) return 'Any file';
  const words = accepted.map((raw) => {
    const t = raw.trim().toLowerCase();
    if (t.startsWith('.')) return `${t} files`;
    if (t === 'application/pdf') return 'PDFs';
    const [major, minor] = t.split('/');
    if (minor === '*') return { image: 'Images', video: 'Videos', audio: 'Audio', text: 'Text files' }[major] ?? `${major} files`;
    return minor ? `${minor.toUpperCase()} files` : t;
  });
  const unique = [...new Set(words)];
  return unique.length > 1 ? `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}` : unique[0];
}

/** "84 KB", "1.3 MB". */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** A name that is safe in `![name](attachment:id)` and `alt="…"`. */
export function attachmentFileName(file: File, fallback = 'file'): string {
  const name = (file.name || fallback).replace(/[[\]"<>\r\n]/g, '_').trim();
  return name || fallback;
}

export function readFileAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** The first lines of a text file (tabs expanded, long lines clipped); `undefined` for binary-looking data. */
export async function textExcerpt(file: Blob, { lines = 8, columns = 72, bytes = 4096 } = {}): Promise<string | undefined> {
  try {
    const head = await file.slice(0, bytes).text();
    if (head.includes('\u0000')) return undefined;
    const out = head
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .slice(0, lines)
      .map((l) => l.replace(/\t/g, '  ').slice(0, columns).trimEnd());
    while (out.length && !out[out.length - 1]) out.pop();
    return out.length ? out.join('\n') : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A poster for a video: its first frame (a little in, to skip a black lead-in), drawn to a small canvas.
 * Resolves `undefined` when the browser can't decode it in time.
 */
export function videoPoster(url: string, { width = 240, timeout = 4000 } = {}): Promise<string | undefined> {
  if (typeof document === 'undefined') return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const done = (result: string | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };
    const timer = setTimeout(() => done(undefined), timeout);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = Math.min(0.15, d / 2);
    };
    video.onseeked = () => {
      try {
        const w = video.videoWidth,
          h = video.videoHeight;
        if (!w || !h) return done(undefined);
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(width, w);
        canvas.height = Math.round((canvas.width / w) * h);
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
        done(canvas.toDataURL('image/jpeg', 0.82));
      } catch {
        done(undefined);
      }
    };
    video.onerror = () => done(undefined);
    video.src = url;
  });
}
