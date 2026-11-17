// @vitest-environment happy-dom
import { StrictMode, useState } from 'react';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileInput } from '@ui-sdk/react/file-input';
import type { UploadContext, UploadFile } from '@/lib/file-upload-model';
import type { FileUploadOptions } from '@/lib/file-upload-primitive';
import { useFilePreview, useFileUpload, type FileUploadState } from '@/lib/use-file-upload';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

/** The hook feeding a FileInput (which runs the checks), as a FileUpload uses it. `result.current` is the latest state. */
function setup(useOptions: () => FileUploadOptions, { strict = false } = {}) {
  const result = { current: null as unknown as FileUploadState };
  function Host() {
    const api = useFileUpload(useOptions());
    result.current = api;
    return <FileInput {...api.inputProps} />;
  }
  const utils = render(strict ? <StrictMode><Host /></StrictMode> : <Host />);
  return { result, ...utils };
}

const file = (name: string, size = 10, type = 'text/plain') => new File([new Uint8Array(size)], name, { type, lastModified: 1 });

/** An upload the test settles by hand. */
function manual() {
  const calls: { file: File; ctx: UploadContext; resolve: (r?: { url?: string }) => void; reject: (e: unknown) => void }[] = [];
  const upload = vi.fn((f: File, ctx: UploadContext) => new Promise<{ url?: string } | void>((resolve, reject) => calls.push({ file: f, ctx, resolve, reject })));
  return { calls, upload };
}

const status = (files: UploadFile[]) => Object.fromEntries(files.map((f) => [f.file.name, f.status]));
const flush = () => act(async () => { await Promise.resolve(); });

const originalUrl = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  Object.assign(URL, originalUrl);
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useFileUpload', () => {
  it('lists added files and starts them automatically', async () => {
    const { upload, calls } = manual();
    const { result } = setup(() => ({ upload }));
    await act(async () => { result.current.add([file('a'), file('b')]); });
    expect(status(result.current.files)).toEqual({ a: 'uploading', b: 'uploading' });
    expect(calls.map((c) => c.file.name)).toEqual(['a', 'b']);
    expect(result.current.pending).toBe(true);
    await act(async () => calls[0].resolve({ url: '/a' }));
    expect(result.current.files[0]).toMatchObject({ status: 'done', progress: 1, url: '/a' });
    expect(result.current.counts).toMatchObject({ done: 1, uploading: 1 });
  });

  it('never runs more uploads than the concurrency limit, and starts the next as one finishes', async () => {
    const { upload, calls } = manual();
    const { result } = setup(() => ({ upload, concurrency: 2 }));
    await act(async () => { result.current.add(['a', 'b', 'c', 'd'].map((n) => file(n))); });
    expect(status(result.current.files)).toEqual({ a: 'uploading', b: 'uploading', c: 'queued', d: 'queued' });
    await act(async () => calls[1].resolve());
    expect(status(result.current.files)).toEqual({ a: 'uploading', b: 'done', c: 'uploading', d: 'queued' });
    await act(async () => calls[0].reject(new Error('boom')));
    expect(status(result.current.files)).toEqual({ a: 'error', b: 'done', c: 'uploading', d: 'uploading' });
    expect(calls).toHaveLength(4);
  });

  it('reports progress, clamped, and keeps it out of the way once done', async () => {
    vi.useFakeTimers();
    const upload = (_f: File, { onProgress }: UploadContext) =>
      new Promise<void>((resolve) => {
        let n = 0;
        const t = setInterval(() => {
          onProgress(++n * 0.4);
          if (n === 3) { clearInterval(t); resolve(); }
        }, 100);
      });
    const { result } = setup(() => ({ upload }));
    await act(async () => { result.current.add([file('a')]); });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current.files[0].progress).toBeCloseTo(0.4);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current.files[0].progress).toBeCloseTo(0.8);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current.files[0]).toMatchObject({ status: 'done', progress: 1 });
  });

  it('turns a failure into an error row with its message, and retry sends it again (even with autoUpload off)', async () => {
    const { upload, calls } = manual();
    const onUploadError = vi.fn();
    const { result } = setup(() => ({ upload, autoUpload: false, onUploadError }));
    await act(async () => { result.current.add([file('a')]); });
    expect(status(result.current.files)).toEqual({ a: 'queued' });
    act(() => result.current.uploadAll());
    await flush();
    await act(async () => calls[0].reject(new Error('Connection lost')));
    expect(result.current.files[0]).toMatchObject({ status: 'error', error: 'Connection lost' });
    expect(onUploadError).toHaveBeenCalledOnce();
    const id = result.current.files[0].id;
    act(() => result.current.retry(id));
    await flush();
    expect(calls).toHaveLength(2);
    expect(result.current.files[0]).toMatchObject({ status: 'uploading', error: undefined });
    await act(async () => calls[1].resolve());
    expect(result.current.files[0].status).toBe('done');
    // Only failed uploads can be retried.
    act(() => result.current.retry(id));
    await flush();
    expect(calls).toHaveLength(2);
  });

  it('uses a generic message for a rejection that is not an Error', async () => {
    const { upload, calls } = manual();
    const { result } = setup(() => ({ upload }));
    await act(async () => { result.current.add([file('a')]); });
    await act(async () => calls[0].reject(undefined));
    expect(result.current.files[0].error).toBe('Upload failed');
  });

  it('aborts an upload when its file is removed, and ignores whatever it reports after', async () => {
    const { upload, calls } = manual();
    const onRemove = vi.fn();
    const { result } = setup(() => ({ upload, onRemove }));
    await act(async () => { result.current.add([file('a'), file('b')]); });
    const id = result.current.files[0].id;
    expect(calls[0].ctx.signal.aborted).toBe(false);
    act(() => result.current.remove(id));
    expect(calls[0].ctx.signal.aborted).toBe(true);
    expect(onRemove).toHaveBeenCalledOnce();
    await act(async () => { calls[0].ctx.onProgress(0.9); calls[0].resolve({ url: '/late' }); });
    expect(result.current.files.map((f) => f.file.name)).toEqual(['b']);
    expect(calls[1].ctx.signal.aborted).toBe(false);
  });

  it('aborts everything in flight when it unmounts, and on clear()', async () => {
    const { upload, calls } = manual();
    const { result, unmount } = setup(() => ({ upload }));
    await act(async () => { result.current.add([file('a'), file('b')]); });
    act(() => result.current.clear());
    expect(result.current.files).toEqual([]);
    expect(calls.every((c) => c.ctx.signal.aborted)).toBe(true);
    await act(async () => { result.current.add([file('c')]); });
    const last = calls[calls.length - 1];
    unmount();
    // The instance is destroyed a microtask after its component leaves (so StrictMode's remount doesn't count).
    await Promise.resolve();
    expect(last.ctx.signal.aborted).toBe(true);
  });

  it('keeps rejected files in the list, never uploads them, and does not count them against maxFiles', async () => {
    const { upload, calls } = manual();
    const onAdd = vi.fn();
    const { result } = setup(() => ({ upload, accept: ['image/*'], maxFiles: 1, onAdd }));
    let outcome!: ReturnType<FileUploadState['add']>;
    await act(async () => { outcome = result.current.add([file('a.txt'), file('b.png', 5, 'image/png'), file('c.png', 5, 'image/png')]); });
    expect(outcome.added.map((f) => f.file.name)).toEqual(['b.png']);
    expect(outcome.rejected.map((f) => f.reason)).toEqual(['file-type', 'too-many-files']);
    expect(calls.map((c) => c.file.name)).toEqual(['b.png']);
    expect(onAdd).toHaveBeenCalledWith(outcome.added, outcome.rejected, expect.objectContaining({ reason: 'imperative' }));
    expect(result.current.counts).toMatchObject({ rejected: 2, uploading: 1 });
    // A batch lists what it queued, then what it turned away.
    expect(result.current.files.map((f) => f.file.name)).toEqual(['b.png', 'a.txt', 'c.png']);
    const rejectedRow = result.current.files.find((f) => f.file.name === 'a.txt');
    act(() => result.current.remove(rejectedRow?.id ?? ''));
    expect(result.current.files.map((f) => f.file.name)).toEqual(['b.png', 'c.png']);
    // Removing a listed file takes it out of the FileInput too.
    act(() => result.current.remove(result.current.files[0].id));
    expect(result.current.inputProps.value).toEqual([]);
  });

  it('turns away duplicates (path, size, modified time) against the list and within a batch, unless allowed', async () => {
    const { result } = setup(() => ({}));
    await act(async () => { result.current.add([file('a')]); });
    let outcome!: ReturnType<FileUploadState['add']>;
    await act(async () => { outcome = result.current.add([file('a'), file('b'), file('b')]); });
    expect(outcome.added.map((f) => f.file.name)).toEqual(['b']);
    expect(outcome.rejected.map((f) => [f.file.name, f.reason, f.error])).toEqual([['a', 'duplicate', 'Already added.'], ['b', 'duplicate', 'Already added.']]);
    const open = setup(() => ({ allowDuplicates: true }));
    await act(async () => { open.result.current.add([file('a'), file('a')]); });
    expect(open.result.current.counts.queued).toBe(2);
  });

  it('runs your validate first: its reason is the row\'s text unless messages has one for it', async () => {
    const validate = (f: File) => (f.name.startsWith('x') ? 'No x files.' : f.name.startsWith('y') ? 'y' : undefined);
    const { result } = setup(() => ({ validate, messages: { y: 'No y files either.' } }));
    let outcome!: ReturnType<FileUploadState['add']>;
    await act(async () => { outcome = result.current.add([file('x1'), file('y1'), file('z1')]); });
    expect(outcome.added.map((f) => f.file.name)).toEqual(['z1']);
    expect(outcome.rejected.map((f) => f.error)).toEqual(['No x files.', 'No y files either.']);
  });

  it('adds without uploading when there is no upload function', async () => {
    const { result } = setup(() => ({ maxSize: 5 }));
    await act(async () => { result.current.add([file('a', 3), file('b', 9)]); });
    expect(status(result.current.files)).toEqual({ a: 'queued', b: 'rejected' });
  });

  it('works controlled: the list comes from props and every change goes to onValueChange', async () => {
    const { upload, calls } = manual();
    const seen: UploadFile[][] = [];
    const { result } = setup(() => {
      const [files, setFiles] = useState<UploadFile[]>([]);
      return { value: files, onValueChange: (next) => { seen.push(next); setFiles(next); }, upload };
    });
    await act(async () => { result.current.add([file('a')]); });
    expect(status(result.current.files)).toEqual({ a: 'uploading' });
    await act(async () => calls[0].ctx.onProgress(0.5));
    expect(result.current.files[0].progress).toBe(0.5);
    await act(async () => calls[0].resolve());
    expect(seen[seen.length - 1][0].status).toBe('done');
    expect(result.current.files[0].status).toBe('done');
  });

  it('controlled: a row the owner drops from its list stops sending', async () => {
    const { upload, calls } = manual();
    let drop!: () => void;
    const { result } = setup(() => {
      const [files, setFiles] = useState<UploadFile[]>([]);
      drop = () => setFiles((prev) => prev.slice(1));
      return { value: files, onValueChange: setFiles, upload };
    });
    await act(async () => { result.current.add([file('a'), file('b')]); });
    expect(calls.map((c) => c.ctx.signal.aborted)).toEqual([false, false]);
    await act(async () => drop());
    expect(calls.map((c) => c.ctx.signal.aborted)).toEqual([true, false]);
    expect(result.current.files.map((f) => f.file.name)).toEqual(['b']);
  });

  it('remove, retry and clear say whether they did anything', async () => {
    const { upload, calls } = manual();
    const { result } = setup(() => ({ upload }));
    await act(async () => { result.current.add([file('a')]); });
    const id = result.current.files[0].id;
    // Only a failed upload can be retried; an unknown row can't be removed.
    expect(result.current.retry(id)).toBe(false);
    expect(result.current.remove('nope')).toBe(false);
    await act(async () => calls[0].reject(new Error('x')));
    let ok = false;
    act(() => { ok = result.current.retry(id); });
    expect(ok).toBe(true);
    act(() => { ok = result.current.remove(id); });
    expect(ok).toBe(true);
    act(() => { ok = result.current.clear(); });
    expect(ok).toBe(false);
  });

  it('gives every change a reason, a source, the row it is about and the rows that came and went', async () => {
    const { upload, calls } = manual();
    const onValueChange = vi.fn();
    const { result } = setup(() => ({ upload, maxSize: 20, onValueChange }));
    const reasons = () => onValueChange.mock.calls.map(([, d]) => d.reason);
    await act(async () => { result.current.add([file('a'), file('big', 30)]); });
    const [added, rejected] = onValueChange.mock.calls.map(([, d]) => d);
    expect(added).toMatchObject({ reason: 'imperative', source: 'programmatic', canceled: false });
    expect(added.added.map((f: UploadFile) => f.file.name)).toEqual(['a']);
    expect(added.id).toBe(added.added[0].id);
    expect(rejected).toMatchObject({ reason: 'reject', removed: [] });
    expect(rejected.added.map((f: UploadFile) => f.status)).toEqual(['rejected']);
    expect(reasons()).toContain('upload-start');
    await act(async () => calls[0].ctx.onProgress(0.5));
    await act(async () => calls[0].reject(new Error('nope')));
    expect(reasons().slice(-2)).toEqual(['progress', 'settle']);
    const id = result.current.files[0].id;
    act(() => result.current.retry(id));
    // The retry queues it, then the queue starts it again.
    expect(reasons().slice(-2)).toEqual(['retry', 'upload-start']);
    expect(onValueChange.mock.calls.at(-2)?.[1]).toMatchObject({ reason: 'retry', id });
    const click = new MouseEvent('click', { detail: 1 });
    act(() => result.current.remove(id, { reason: 'remove-press', event: click }));
    // A click a script made reads as programmatic, as UI SDK reads it.
    expect(onValueChange.mock.lastCall?.[1]).toMatchObject({ reason: 'remove-press', event: click, source: 'programmatic', id });
    expect(onValueChange.mock.lastCall?.[1].removed.map((f: UploadFile) => f.id)).toEqual([id]);
    act(() => result.current.clear());
    expect(onValueChange.mock.lastCall?.[1]).toMatchObject({ reason: 'clear', added: [] });
    expect(result.current.files).toEqual([]);
  });

  it('cancel() refuses a change: nothing is listed, removed, aborted or sent', async () => {
    const { upload, calls } = manual();
    let refuse: (d: { reason: string }) => boolean = () => false;
    const onRemove = vi.fn();
    const { result } = setup(() => ({
      upload,
      onRemove,
      onValueChange: (_next, details) => {
        if (refuse(details)) details.cancel();
      },
    }));
    refuse = (d) => d.reason === 'imperative';
    await act(async () => { result.current.add([file('a')]); });
    expect(result.current.files).toEqual([]);
    expect(calls).toHaveLength(0);

    refuse = () => false;
    await act(async () => { result.current.add([file('b')]); });
    expect(calls).toHaveLength(1);
    const id = result.current.files[0].id;

    refuse = (d) => d.reason === 'progress';
    await act(async () => calls[0].ctx.onProgress(0.5));
    expect(result.current.files[0].progress).toBe(0);

    refuse = (d) => d.reason === 'remove-press' || d.reason === 'clear';
    act(() => result.current.remove(id, { reason: 'remove-press' }));
    act(() => result.current.clear());
    expect(status(result.current.files)).toEqual({ b: 'uploading' });
    expect(calls[0].ctx.signal.aborted).toBe(false);
    expect(onRemove).not.toHaveBeenCalled();

    refuse = () => false;
    act(() => result.current.remove(id));
    expect(calls[0].ctx.signal.aborted).toBe(true);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('a refused upload-start leaves the row queued and sends nothing', async () => {
    const { upload, calls } = manual();
    const { result } = setup(() => ({
      upload,
      onValueChange: (_next, details) => {
        if (details.reason === 'upload-start') details.cancel();
      },
    }));
    await act(async () => { result.current.add([file('a')]); });
    expect(status(result.current.files)).toEqual({ a: 'queued' });
    expect(calls).toHaveLength(0);
  });

  it('a controlled list the parent never updates stays as it is', async () => {
    const onValueChange = vi.fn();
    const frozen: UploadFile[] = [];
    const { result } = setup(() => ({ value: frozen, onValueChange }));
    await act(async () => { result.current.add([file('a')]); });
    expect(onValueChange).toHaveBeenCalledOnce();
    expect(result.current.files).toBe(frozen);
  });

  it('picks up files that arrive already queued (defaultValue) and sends them', async () => {
    const { upload, calls } = manual();
    const seed: UploadFile = { id: 'seed', file: file('seed'), path: 'seed', status: 'queued', progress: 0 };
    const { result } = setup(() => ({ upload, defaultValue: [seed] }));
    await flush();
    expect(calls).toHaveLength(1);
    expect(result.current.files[0].status).toBe('uploading');
  });

  it('survives StrictMode double effects: one upload settles to done', async () => {
    const { upload, calls } = manual();
    const { result } = setup(() => ({ upload }), { strict: true });
    await act(async () => { result.current.add([file('a')]); });
    const live = calls.filter((c) => !c.ctx.signal.aborted);
    expect(live.length).toBeGreaterThanOrEqual(1);
    await act(async () => live[live.length - 1].resolve());
    expect(result.current.files[0].status).toBe('done');
  });

  it('restarts a file left "uploading" by a remount (state restored without a request in flight)', async () => {
    const { upload, calls } = manual();
    const orphan: UploadFile = { id: 'o', file: file('o'), path: 'o', status: 'uploading', progress: 0.3 };
    setup(() => ({ upload, defaultValue: [orphan] }));
    await flush();
    expect(calls).toHaveLength(1);
  });
});

describe('useFilePreview', () => {
  it('makes an object URL once the component is mounted and revokes it on unmount', () => {
    const create = vi.fn(() => 'blob:one');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const blob = new Blob(['x']);
    const { result, unmount } = renderHook(() => useFilePreview(blob));
    expect(result.current).toBe('blob:one');
    expect(revoke).not.toHaveBeenCalled();
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:one');
  });

  it('revokes the old URL when the file changes, and makes none while disabled', () => {
    let n = 0;
    const create = vi.fn(() => `blob:${++n}`);
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const a = new Blob(['a']);
    const b = new Blob(['b']);
    const { result, rerender } = renderHook(({ f, on }) => useFilePreview(f, on), { initialProps: { f: a, on: true } });
    expect(result.current).toBe('blob:1');
    rerender({ f: b, on: true });
    expect(revoke).toHaveBeenCalledWith('blob:1');
    expect(result.current).toBe('blob:2');
    rerender({ f: b, on: false });
    expect(revoke).toHaveBeenCalledWith('blob:2');
    expect(result.current).toBeUndefined();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('leaves it undefined where object URLs do not exist', () => {
    Object.assign(URL, { createObjectURL: undefined });
    const { result } = renderHook(() => useFilePreview(new Blob(['x'])));
    expect(result.current).toBeUndefined();
  });
});
