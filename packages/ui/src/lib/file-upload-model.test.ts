import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeAccept, describeRules, fileKind, rejectionMessage, xhrUpload } from '@/lib/file-upload-model';

const f = (name: string, size = 10, type = 'text/plain') => new File([new Uint8Array(size)], name, { type, lastModified: 1 });

describe('describeAccept / describeRules', () => {
  it('says it in words', () => {
    expect(describeAccept(undefined)).toBe('Any file');
    expect(describeAccept(['image/*'])).toBe('Images');
    expect(describeAccept(['image/*', 'application/pdf', '.md'])).toBe('Images, PDFs and .md files');
  });
  it('builds the hint line from the rules', () => {
    expect(describeRules({})).toBe('');
    expect(describeRules({ accept: ['image/*'], maxSize: 5_000_000, maxFiles: 4 })).toBe('Images · up to 5 MB each · up to 4 files');
    expect(describeRules({ maxSize: 1000, maxFiles: 1 })).toBe('up to 1 kB');
  });
});

describe('rejectionMessage', () => {
  const ctx = (file = f('x')) => ({ file, path: file.name, accept: ['image/*'], maxSize: 100, minSize: 5, maxFiles: 2 });
  it('says why for each of FileInput\'s reasons, and for duplicates', () => {
    expect(rejectionMessage('file-type', ctx())).toBe('Unsupported file type. Accepted: Images.');
    expect(rejectionMessage('file-too-large', ctx())).toBe('Larger than the 100 B limit.');
    expect(rejectionMessage('file-too-small', ctx())).toBe('Smaller than the 5 B minimum.');
    expect(rejectionMessage('too-many-files', ctx())).toBe('Only 2 files are allowed.');
    expect(rejectionMessage('too-many-files', { ...ctx(), maxFiles: 1 })).toBe('Only one file is allowed.');
    expect(rejectionMessage('duplicate', ctx())).toBe('Already added.');
  });
  it('uses a reason from your validate as its own text', () => {
    expect(rejectionMessage('No x files.', ctx())).toBe('No x files.');
  });
  it('lets messages override the defaults, as text or a function', () => {
    expect(rejectionMessage('file-type', ctx(), { 'file-type': 'Images only.' })).toBe('Images only.');
    expect(rejectionMessage('file-too-large', ctx(), { 'file-too-large': ({ maxSize }) => `Max ${maxSize}` })).toBe('Max 100');
    expect(rejectionMessage('too-big', ctx(), { 'too-big': 'Way too big.' })).toBe('Way too big.');
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
