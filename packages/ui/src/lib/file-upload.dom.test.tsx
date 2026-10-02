// @vitest-environment happy-dom
import { StrictMode, useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilePreview, useFileUpload, type UploadContext, type UploadFile, type UseFileUploadOptions } from '@/lib/file-upload';

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
    const { result } = renderHook(() => useFileUpload({ upload }));
    await act(async () => { result.current.add([file('a'), file('b')]); });
    expect(status(result.current.files)).toEqual({ a: 'uploading', b: 'uploading' });
    expect(calls.map((c) => c.file.name)).toEqual(['a', 'b']);
    expect(result.current.isBusy).toBe(true);
    await act(async () => calls[0].resolve({ url: '/a' }));
    expect(result.current.files[0]).toMatchObject({ status: 'done', progress: 1, url: '/a' });
    expect(result.current.counts).toMatchObject({ done: 1, uploading: 1 });
  });

  it('never runs more uploads than the concurrency limit, and starts the next as one finishes', async () => {
    const { upload, calls } = manual();
    const { result } = renderHook(() => useFileUpload({ upload, concurrency: 2 }));
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
    const { result } = renderHook(() => useFileUpload({ upload }));
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
    const { result } = renderHook(() => useFileUpload({ upload, autoUpload: false, onUploadError }));
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
    const { result } = renderHook(() => useFileUpload({ upload }));
    await act(async () => { result.current.add([file('a')]); });
    await act(async () => calls[0].reject(undefined));
    expect(result.current.files[0].error).toBe('Upload failed');
  });

  it('aborts an upload when its file is removed, and ignores whatever it reports after', async () => {
    const { upload, calls } = manual();
    const onRemove = vi.fn();
    const { result } = renderHook(() => useFileUpload({ upload, onRemove }));
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
    const { result, unmount } = renderHook(() => useFileUpload({ upload }));
    await act(async () => { result.current.add([file('a'), file('b')]); });
    act(() => result.current.clear());
    expect(result.current.files).toEqual([]);
    expect(calls.every((c) => c.ctx.signal.aborted)).toBe(true);
    await act(async () => { result.current.add([file('c')]); });
    const last = calls[calls.length - 1];
    unmount();
    expect(last.ctx.signal.aborted).toBe(true);
  });

  it('keeps rejected files in the list, never uploads them, and does not count them against maxFiles', async () => {
    const { upload, calls } = manual();
    const onAdd = vi.fn();
    const { result } = renderHook(() => useFileUpload({ upload, accept: ['image/*'], maxFiles: 1, onAdd }));
    let outcome!: ReturnType<typeof result.current.add>;
    await act(async () => { outcome = result.current.add([file('a.txt'), file('b.png', 5, 'image/png'), file('c.png', 5, 'image/png')]); });
    expect(outcome.added.map((f) => f.file.name)).toEqual(['b.png']);
    expect(outcome.rejected.map((f) => f.reason)).toEqual(['type', 'too-many']);
    expect(calls.map((c) => c.file.name)).toEqual(['b.png']);
    expect(onAdd).toHaveBeenCalledWith(outcome.added, outcome.rejected);
    expect(result.current.counts).toMatchObject({ rejected: 2, uploading: 1 });
    act(() => result.current.remove(result.current.files[0].id));
    expect(result.current.files.map((f) => f.file.name)).toEqual(['b.png', 'c.png']);
  });

  it('adds without uploading when there is no upload function', async () => {
    const { result } = renderHook(() => useFileUpload({ maxSize: 5 }));
    await act(async () => { result.current.add([file('a', 3), file('b', 9)]); });
    expect(status(result.current.files)).toEqual({ a: 'queued', b: 'rejected' });
  });

  it('works controlled: the list comes from props and every change goes to onFilesChange', async () => {
    const { upload, calls } = manual();
    const seen: UploadFile[][] = [];
    const { result } = renderHook(() => {
      const [files, setFiles] = useState<UploadFile[]>([]);
      const opts: UseFileUploadOptions = { files, onFilesChange: (next) => { seen.push(next); setFiles(next); }, upload };
      return useFileUpload(opts);
    });
    await act(async () => { result.current.add([file('a')]); });
    expect(status(result.current.files)).toEqual({ a: 'uploading' });
    await act(async () => calls[0].ctx.onProgress(0.5));
    expect(result.current.files[0].progress).toBe(0.5);
    await act(async () => calls[0].resolve());
    expect(seen[seen.length - 1][0].status).toBe('done');
    expect(result.current.files[0].status).toBe('done');
  });

  it('a controlled list the parent never updates stays as it is', async () => {
    const onFilesChange = vi.fn();
    const frozen: UploadFile[] = [];
    const { result } = renderHook(() => useFileUpload({ files: frozen, onFilesChange }));
    await act(async () => { result.current.add([file('a')]); });
    expect(onFilesChange).toHaveBeenCalledOnce();
    expect(result.current.files).toBe(frozen);
  });

  it('picks up files that arrive already queued (defaultFiles) and sends them', async () => {
    const { upload, calls } = manual();
    const seed: UploadFile = { id: 'seed', file: file('seed'), path: 'seed', status: 'queued', progress: 0 };
    const { result } = renderHook(() => useFileUpload({ upload, defaultFiles: [seed] }));
    await flush();
    expect(calls).toHaveLength(1);
    expect(result.current.files[0].status).toBe('uploading');
  });

  it('survives StrictMode double effects: one upload settles to done', async () => {
    const { upload, calls } = manual();
    const { result } = renderHook(() => useFileUpload({ upload }), { wrapper: StrictMode });
    await act(async () => { result.current.add([file('a')]); });
    const live = calls.filter((c) => !c.ctx.signal.aborted);
    expect(live.length).toBeGreaterThanOrEqual(1);
    await act(async () => live[live.length - 1].resolve());
    expect(result.current.files[0].status).toBe('done');
  });

  it('restarts a file left "uploading" by a remount (state restored without a request in flight)', async () => {
    const { upload, calls } = manual();
    const orphan: UploadFile = { id: 'o', file: file('o'), path: 'o', status: 'uploading', progress: 0.3 };
    renderHook(() => useFileUpload({ upload, defaultFiles: [orphan] }));
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
