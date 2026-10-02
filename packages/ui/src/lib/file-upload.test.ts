import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  describeAccept, describeRules, entriesFromFileList, fileKind, matchesAccept, readDropItems, rejectionMessage,
  validateFiles, xhrUpload, type UploadFile,
} from '@/lib/file-upload';
import { formatBytes } from '@/lib/format-bytes';

const f = (name: string, size = 10, type = 'text/plain', lastModified = 1) => {
  const file = new File([new Uint8Array(size)], name, { type, lastModified });
  return { file, path: name };
};

describe('formatBytes', () => {
  it('uses binary units and drops needless decimals', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(840)).toBe('840 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(12 * 1024)).toBe('12 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(2.5 * 1024 ** 3)).toBe('2.5 GB');
  });
  it('is empty for nonsense', () => {
    expect(formatBytes(-1)).toBe('');
    expect(formatBytes(NaN)).toBe('');
  });
});

describe('matchesAccept', () => {
  it('accepts anything with no list, an empty list or a wildcard', () => {
    expect(matchesAccept({ name: 'a.bin' }, undefined)).toBe(true);
    expect(matchesAccept({ name: 'a.bin' }, [])).toBe(true);
    expect(matchesAccept({ name: 'a.bin' }, ['*/*'])).toBe(true);
    expect(matchesAccept({ name: 'a.bin' }, '*')).toBe(true);
  });
  it('matches a MIME family, an exact type and an extension, case-insensitively', () => {
    const png = { name: 'Photo.PNG', type: 'image/png' };
    expect(matchesAccept(png, ['image/*'])).toBe(true);
    expect(matchesAccept(png, ['image/png'])).toBe(true);
    expect(matchesAccept(png, ['.png'])).toBe(true);
    expect(matchesAccept(png, ['image/jpeg'])).toBe(false);
    expect(matchesAccept(png, ['video/*', '.pdf'])).toBe(false);
    expect(matchesAccept({ name: 'a.pdf', type: 'application/pdf' }, ['IMAGE/*', 'Application/PDF'])).toBe(true);
  });
  it('reads a comma separated string like <input accept>', () => {
    expect(matchesAccept({ name: 'x.md', type: '' }, 'image/*, .md')).toBe(true);
    expect(matchesAccept({ name: 'x.txt', type: 'text/plain' }, 'image/*, .md')).toBe(false);
  });
  it('relies on the extension when the browser leaves the type blank, and ignores MIME parameters', () => {
    expect(matchesAccept({ name: 'notes.md', type: '' }, ['.md'])).toBe(true);
    expect(matchesAccept({ name: 'notes', type: '' }, ['image/*'])).toBe(false);
    expect(matchesAccept({ name: 'a.txt', type: 'text/plain; charset=utf-8' }, ['text/plain'])).toBe(true);
  });
});

describe('describeAccept / describeRules', () => {
  it('says it in words', () => {
    expect(describeAccept(undefined)).toBe('Any file');
    expect(describeAccept(['image/*'])).toBe('Images');
    expect(describeAccept(['image/*', 'application/pdf', '.md'])).toBe('Images, PDFs and .md files');
  });
  it('builds the hint line from the rules', () => {
    expect(describeRules({})).toBe('');
    expect(describeRules({ accept: ['image/*'], maxSize: 5 * 1024 * 1024, maxFiles: 4 })).toBe('Images · up to 5 MB each · up to 4 files');
    expect(describeRules({ maxSize: 1024, maxFiles: 1 })).toBe('up to 1 KB');
  });
});

describe('fileKind', () => {
  it('goes by type, then by extension', () => {
    expect(fileKind({ name: 'a', type: 'image/webp' })).toBe('image');
    expect(fileKind({ name: 'a.heic', type: '' })).toBe('image');
    expect(fileKind({ name: 'a.pdf', type: '' })).toBe('pdf');
    expect(fileKind({ name: 'a.zip', type: 'application/zip' })).toBe('archive');
    expect(fileKind({ name: 'a.json', type: 'application/json' })).toBe('text');
    expect(fileKind({ name: 'a.bin', type: '' })).toBe('other');
  });
});

describe('validateFiles', () => {
  const status = (list: UploadFile[]) => list.map((x) => (x.status === 'rejected' ? x.reason : 'ok'));

  it('queues files that pass, with ids, paths and zero progress', () => {
    const [a, b] = validateFiles([f('a.txt'), f('b.txt')], []);
    expect(a).toMatchObject({ status: 'queued', progress: 0, path: 'a.txt' });
    expect(a.id).not.toBe(b.id);
  });
  it('rejects by type, naming what is accepted', () => {
    const [x] = validateFiles([f('a.txt')], [], { accept: ['image/*'] });
    expect(x).toMatchObject({ status: 'rejected', reason: 'type' });
    expect(x.error).toBe('Unsupported file type. Accepted: Images.');
  });
  it('rejects by size, at the boundary', () => {
    const out = validateFiles([f('big', 101), f('edge', 100), f('tiny', 4), f('min', 5)], [], { maxSize: 100, minSize: 5 });
    expect(status(out)).toEqual(['too-large', 'ok', 'too-small', 'ok']);
    expect(out[0].error).toBe('Larger than the 100 B limit.');
    expect(out[2].error).toBe('Smaller than the 5 B minimum.');
  });
  it('limits the count, counting what is already listed but not rejected ones', () => {
    const existing = validateFiles([f('one'), f('bad', 99)], [], { maxSize: 50 });
    expect(status(existing)).toEqual(['ok', 'too-large']);
    const out = validateFiles([f('two'), f('three')], existing, { maxFiles: 2, maxSize: 50 });
    expect(status(out)).toEqual(['ok', 'too-many']);
    expect(out[1].error).toBe('Only 2 files are allowed.');
    expect(rejectionMessage('too-many', { file: f('x').file, path: 'x', maxFiles: 1 })).toBe('Only one file is allowed.');
  });
  it('detects duplicates against the list and within the batch, by path, size and modified time', () => {
    const existing = validateFiles([f('a.txt', 10, 'text/plain', 5)], []);
    const out = validateFiles([f('a.txt', 10, 'text/plain', 5), f('a.txt', 10, 'text/plain', 6), f('c.txt'), f('c.txt')], existing);
    expect(status(out)).toEqual(['duplicate', 'ok', 'ok', 'duplicate']);
    expect(validateFiles([f('a.txt', 10, 'text/plain', 5)], existing, { allowDuplicates: true })[0].status).toBe('queued');
  });
  it('runs a custom rule: a string is the reason, false a generic one', () => {
    const validate = (file: File) => (file.name.startsWith('x') ? 'No x files.' : file.name.startsWith('y') ? false : undefined);
    const out = validateFiles([f('x1'), f('y1'), f('z1')], [], { validate });
    expect(status(out)).toEqual(['invalid', 'invalid', 'ok']);
    expect(out[0].error).toBe('No x files.');
    expect(out[1].error).toBe('This file isn’t allowed.');
  });
  it('lets messages override the defaults, as text or a function', () => {
    const out = validateFiles([f('a.txt'), f('b', 99)], [], {
      accept: ['image/*'], maxSize: 50,
      messages: { type: 'Images only.', 'too-large': ({ maxSize }) => `Max ${maxSize}` },
    });
    expect(out[0].error).toBe('Images only.');
    expect(out[1].error).toBe('Images only.'); // the type rule comes first
    expect(validateFiles([f('b', 99, 'image/png')], [], { maxSize: 50, messages: { 'too-large': ({ maxSize }) => `Max ${maxSize}` } })[0].error).toBe('Max 50');
  });
  it('checks the rules in order: type, size, duplicate, custom, count', () => {
    const out = validateFiles([f('a.txt', 99)], [], { accept: ['image/*'], maxSize: 5, maxFiles: 0 });
    expect(out[0].reason).toBe('type');
  });
});

describe('entriesFromFileList', () => {
  it('keeps webkitRelativePath and drops dotfiles inside folders', () => {
    const mk = (name: string, rel: string) => {
      const file = new File(['x'], name);
      Object.defineProperty(file, 'webkitRelativePath', { value: rel });
      return file;
    };
    const entries = entriesFromFileList([mk('a.txt', 'dir/a.txt'), mk('.DS_Store', 'dir/.DS_Store'), mk('b.txt', 'dir/sub/b.txt'), mk('c.txt', '')]);
    expect(entries.map((e) => e.path)).toEqual(['dir/a.txt', 'dir/sub/b.txt', 'c.txt']);
    expect(entriesFromFileList(null)).toEqual([]);
  });
});

/* react-aria's drop items, hand-built: isFileDropItem / isDirectoryDropItem look at `kind`. */
const fileItem = (name: string) => ({ kind: 'file' as const, type: 'text/plain', name, getFile: async () => new File(['x'], name), getText: async () => 'x' });
const dirItem = (name: string, children: unknown[]) => ({
  kind: 'directory' as const,
  name,
  getEntries: async function* () {
    for (const c of children) yield c;
  },
});

describe('readDropItems', () => {
  it('flattens folders recursively, keeping relative paths, skipping dotfiles and text items', async () => {
    const items = [
      fileItem('top.txt'),
      dirItem('photos', [fileItem('a.jpg'), fileItem('.DS_Store'), dirItem('2024', [fileItem('b.jpg')]), dirItem('.git', [fileItem('HEAD')])]),
      { kind: 'text' as const, types: new Set(['text/plain']), getText: async () => 'hi' },
    ];
    const { entries, truncated, skippedFolders } = await readDropItems(items as never);
    expect(entries.map((e) => e.path)).toEqual(['top.txt', 'photos/a.jpg', 'photos/2024/b.jpg']);
    expect(truncated).toBe(false);
    expect(skippedFolders).toBe(0);
  });
  it('keeps dotfiles on request, and a dotfile dropped by itself', async () => {
    const out = await readDropItems([fileItem('.env'), dirItem('d', [fileItem('.x')])] as never, { skipHidden: true });
    expect(out.entries.map((e) => e.path)).toEqual(['.env']);
    const all = await readDropItems([dirItem('d', [fileItem('.x')])] as never, { skipHidden: false });
    expect(all.entries.map((e) => e.path)).toEqual(['d/.x']);
  });
  it('stops at the limit and says so', async () => {
    const many = dirItem('big', Array.from({ length: 10 }, (_, i) => fileItem(`f${i}`)));
    const out = await readDropItems([many] as never, { limit: 3 });
    expect(out.entries).toHaveLength(3);
    expect(out.truncated).toBe(true);
  });
  it('counts folders it was told not to read', async () => {
    const out = await readDropItems([fileItem('a'), dirItem('d', [fileItem('b')])] as never, { directories: false });
    expect(out.entries.map((e) => e.path)).toEqual(['a']);
    expect(out.skippedFolders).toBe(1);
  });
  it('survives an unreadable folder', async () => {
    const broken = { kind: 'directory' as const, name: 'bad', getEntries: () => { throw new Error('denied'); } };
    const out = await readDropItems([broken, fileItem('ok')] as never);
    expect(out.entries.map((e) => e.path)).toEqual(['ok']);
  });
});

/* A stand-in XMLHttpRequest that records what was sent and lets a test drive its events. */
class FakeXhr {
  static last: FakeXhr;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown;
  status = 0;
  statusText = '';
  responseText = '';
  withCredentials = false;
  timeout = 0;
  aborted = false;
  responseHeaders: Record<string, string> = {};
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  getResponseHeader(k: string) {
    return this.responseHeaders[k] ?? null;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.onabort?.();
  }
  respond(status: number, text = '', statusText = '') {
    this.status = status;
    this.responseText = text;
    this.statusText = statusText;
    this.onload?.();
  }
}

describe('xhrUpload', () => {
  afterEach(() => vi.unstubAllGlobals());
  const ctx = (signal = new AbortController().signal) => {
    const onProgress = vi.fn();
    return { onProgress, context: { id: '1', path: 'a.txt', signal, onProgress } };
  };

  it('posts multipart with the field name, extra fields and headers, and reports real progress', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const file = new File(['hello'], 'a.txt', { type: 'text/plain' });
    const { onProgress, context } = ctx();
    const promise = xhrUpload('/api/up', { headers: { Authorization: 'Bearer t' }, fieldName: 'upload', extraFields: { folder: 'docs' }, withCredentials: true, timeout: 5000 })(file, context);
    const xhr = FakeXhr.last;
    expect([xhr.method, xhr.url]).toEqual(['POST', '/api/up']);
    expect(xhr.headers).toEqual({ Authorization: 'Bearer t' });
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.timeout).toBe(5000);
    const form = xhr.body as FormData;
    expect(form.get('folder')).toBe('docs');
    expect((form.get('upload') as File).name).toBe('a.txt');
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    expect(onProgress.mock.calls).toEqual([[0.25], [1]]);
    xhr.respond(201, JSON.stringify({ url: 'https://cdn/x' }));
    await expect(promise).resolves.toEqual({ url: 'https://cdn/x' });
  });
  it('can send the file raw with a method and a url per file (presigned PUT)', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const file = new File(['hello'], 'a b.txt');
    const promise = xhrUpload((x) => `/put/${encodeURIComponent(x.name)}`, { method: 'PUT', body: 'raw' })(file, ctx().context);
    expect(FakeXhr.last.method).toBe('PUT');
    expect(FakeXhr.last.url).toBe('/put/a%20b.txt');
    expect(FakeXhr.last.body).toBe(file);
    FakeXhr.last.respond(200);
    await expect(promise).resolves.toBeUndefined();
  });
  it('falls back to the Location header and honors parseResponse', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const a = xhrUpload('/u')(new File([''], 'a'), ctx().context);
    FakeXhr.last.responseHeaders.Location = '/files/1';
    FakeXhr.last.respond(201, 'not json');
    await expect(a).resolves.toEqual({ url: '/files/1' });
    const b = xhrUpload('/u', { parseResponse: (x) => ({ url: x.responseText }) })(new File([''], 'a'), ctx().context);
    FakeXhr.last.respond(200, 'custom');
    await expect(b).resolves.toEqual({ url: 'custom' });
  });
  it('rejects with a readable error for a bad status, a network error and a timeout', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const a = xhrUpload('/u')(new File([''], 'a'), ctx().context);
    FakeXhr.last.respond(413, '', 'Payload Too Large');
    await expect(a).rejects.toThrow('Upload failed (413 Payload Too Large)');
    const b = xhrUpload('/u')(new File([''], 'a'), ctx().context);
    FakeXhr.last.onerror?.();
    await expect(b).rejects.toThrow('Network error');
    const c = xhrUpload('/u')(new File([''], 'a'), ctx().context);
    FakeXhr.last.ontimeout?.();
    await expect(c).rejects.toThrow('timed out');
  });
  it('aborts the request when the signal fires, rejecting with an AbortError', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const controller = new AbortController();
    const promise = xhrUpload('/u')(new File([''], 'a'), ctx(controller.signal).context);
    controller.abort();
    expect(FakeXhr.last.aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('does not even open a request when already aborted', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const before = FakeXhr.last;
    const controller = new AbortController();
    controller.abort();
    await expect(xhrUpload('/u')(new File([''], 'a'), ctx(controller.signal).context)).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeXhr.last).toBe(before);
  });
});
