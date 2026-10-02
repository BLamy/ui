// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGpuTime, parseTime, resetGpuTime, useTimeParse, type TimeParseResult } from '@/lib/gpu-time';

/* useTimeParse against a mocked gpu-time: every parse is a promise the test settles by hand, so debouncing,
   out-of-order answers and cleanup are exercised exactly. */

const mocks = vi.hoisted(() => ({ parse: vi.fn(), defineParser: vi.fn(), dispose: vi.fn() }));

vi.mock('gpu-time', () => ({
  defineParser: mocks.defineParser,
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const fakeResult = (label: string, backend: 'cpu' | 'webgpu' = 'cpu'): TimeParseResult => ({
  occurrences: [{ start: '2026-09-10T09:00:00Z', allDay: false }],
  rrules: [label],
  spans: [],
  truncated: false,
  diagnostics: [],
  backend,
  timings: { tokenizeMs: 0, inferMs: 0, resolveMs: 0 },
});

/** Lets timers and promise callbacks run inside act. */
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  resetGpuTime();
  mocks.parse.mockReset();
  mocks.dispose.mockReset();
  mocks.defineParser.mockReset();
  mocks.defineParser.mockImplementation(async () => ({ parse: mocks.parse, parseMany: vi.fn(), dispose: mocks.dispose }));
  mocks.parse.mockImplementation(async (text: string) => fakeResult(text));
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  // React warns ("not wrapped in act", or an update after unmount) through console.error: none may have happened.
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
  vi.useRealTimers();
});

describe('useTimeParse', () => {
  it('debounces, then parses once and settles', async () => {
    const { result } = renderHook(() => useTimeParse('tomorrow at 3pm', { timeZone: 'UTC', reference: '2026-09-09T12:00:00Z' }));
    expect(result.current).toMatchObject({ result: null, pending: true, backend: null, parsedText: null });
    await advance(119);
    expect(mocks.parse).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(mocks.parse).toHaveBeenCalledWith('tomorrow at 3pm', { reference: '2026-09-09T12:00:00Z', timeZone: 'UTC' });
    expect(result.current).toMatchObject({ pending: false, error: null, backend: 'cpu', parsedText: 'tomorrow at 3pm' });
    expect(result.current.result?.rrules).toEqual(['tomorrow at 3pm']);
  });

  it('parses only the last of several quick changes', async () => {
    const { result, rerender } = renderHook(({ text }) => useTimeParse(text, { timeZone: 'UTC' }), { initialProps: { text: 'e' } });
    await advance(60);
    rerender({ text: 'ev' });
    await advance(60);
    rerender({ text: 'eve' });
    await advance(119);
    expect(mocks.parse).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(mocks.parse.mock.calls[0][0]).toBe('eve');
    expect(result.current.parsedText).toBe('eve');
  });

  it('honours debounceMs', async () => {
    renderHook(() => useTimeParse('noon', { timeZone: 'UTC', debounceMs: 500 }));
    await advance(499);
    expect(mocks.parse).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
  });

  it('ignores a slow answer to old text that arrives after a newer one', async () => {
    const first = deferred<TimeParseResult>();
    const second = deferred<TimeParseResult>();
    mocks.parse.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ text }) => useTimeParse(text, { timeZone: 'UTC' }), { initialProps: { text: 'monday' } });
    await advance(120);
    rerender({ text: 'tuesday' });
    await advance(120);
    expect(mocks.parse.mock.calls.map((c) => c[0])).toEqual(['monday', 'tuesday']);

    // The newer answer comes first, then the stale one.
    await act(async () => second.resolve(fakeResult('tuesday')));
    expect(result.current).toMatchObject({ pending: false, parsedText: 'tuesday' });
    await act(async () => first.resolve(fakeResult('monday')));
    expect(result.current.parsedText).toBe('tuesday');
    expect(result.current.result?.rrules).toEqual(['tuesday']);
    expect(result.current.pending).toBe(false);
  });

  it('ignores a stale rejection too', async () => {
    const first = deferred<TimeParseResult>();
    mocks.parse.mockReturnValueOnce(first.promise);
    const { result, rerender } = renderHook(({ text }) => useTimeParse(text, { timeZone: 'UTC' }), { initialProps: { text: 'monday' } });
    await advance(120);
    rerender({ text: 'tuesday' });
    await advance(120);
    expect(result.current).toMatchObject({ parsedText: 'tuesday', error: null });
    await act(async () => first.reject(new Error('stale failure')));
    expect(result.current.error).toBeNull();
    expect(result.current.parsedText).toBe('tuesday');
  });

  it('reports pending while a newer text waits, keeping the previous result readable', async () => {
    const { result, rerender } = renderHook(({ text }) => useTimeParse(text, { timeZone: 'UTC' }), { initialProps: { text: 'monday' } });
    await advance(120);
    expect(result.current.pending).toBe(false);
    rerender({ text: 'tuesday' });
    expect(result.current).toMatchObject({ pending: true, parsedText: 'monday' });
    expect(result.current.result?.rrules).toEqual(['monday']);
    await advance(120);
    expect(result.current).toMatchObject({ pending: false, parsedText: 'tuesday' });
  });

  it('does nothing for empty or blank text, and clears when the text is emptied', async () => {
    const { result, rerender } = renderHook(({ text }) => useTimeParse(text, { timeZone: 'UTC' }), { initialProps: { text: '   ' } });
    await advance(500);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(mocks.defineParser).not.toHaveBeenCalled();
    expect(result.current).toEqual({ result: null, error: null, pending: false, backend: null, parsedText: null });

    rerender({ text: 'noon' });
    await advance(120);
    expect(result.current.result).not.toBeNull();
    rerender({ text: '' });
    expect(result.current).toEqual({ result: null, error: null, pending: false, backend: null, parsedText: null });
    // typing the same text again parses afresh rather than reviving the old answer
    rerender({ text: 'noon' });
    expect(result.current.pending).toBe(true);
    await advance(120);
    expect(mocks.parse).toHaveBeenCalledTimes(2);
  });

  it('surfaces a rejection as `error` with no result', async () => {
    mocks.parse.mockRejectedValueOnce(new Error('Invalid time zone specified: Nope'));
    const { result } = renderHook(() => useTimeParse('noon', { timeZone: 'Nope' }));
    await advance(120);
    expect(result.current).toMatchObject({ result: null, pending: false, parsedText: 'noon' });
    expect(result.current.error?.message).toMatch(/time zone/);
  });

  it('wraps a non-Error rejection', async () => {
    mocks.parse.mockRejectedValueOnce('plain string');
    const { result } = renderHook(() => useTimeParse('noon'));
    await advance(120);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('plain string');
  });

  it('reparses when an option that changes the answer changes, and not for an equal object', async () => {
    const { rerender } = renderHook(({ tz, parts }) => useTimeParse('noon', { timeZone: tz, dayParts: parts }), {
      initialProps: { tz: 'UTC', parts: { morning: ['06:00', '11:00'] } as Record<string, [string, string]> },
    });
    await advance(120);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    // a fresh but equal `dayParts` object is the same options
    rerender({ tz: 'UTC', parts: { morning: ['06:00', '11:00'] } });
    await advance(300);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    rerender({ tz: 'Asia/Dhaka', parts: { morning: ['06:00', '11:00'] } });
    await advance(120);
    expect(mocks.parse).toHaveBeenCalledTimes(2);
    expect(mocks.parse.mock.calls[1][1]).toMatchObject({ timeZone: 'Asia/Dhaka', dayParts: { morning: ['06:00', '11:00'] } });
  });

  it('reads "now" at each parse when no reference is given', async () => {
    vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
    const { rerender } = renderHook(({ text }) => useTimeParse(text, { timeZone: 'UTC' }), { initialProps: { text: 'a' } });
    await advance(120);
    vi.setSystemTime(new Date('2026-09-09T13:00:00Z'));
    rerender({ text: 'ab' });
    await advance(120);
    expect(mocks.parse.mock.calls.map((c) => c[1].reference)).toEqual(['2026-09-09T12:00:00.120Z', '2026-09-09T13:00:00.120Z']);
  });

  it('passes the parser options through and keeps one parser per backend and date order', async () => {
    const { rerender } = renderHook(({ text, order }) => useTimeParse(text, { timeZone: 'UTC', dateOrder: order }), {
      initialProps: { text: 'a', order: 'DMY' as 'DMY' | 'MDY' },
    });
    await advance(120);
    rerender({ text: 'b', order: 'DMY' });
    await advance(120);
    expect(mocks.defineParser).toHaveBeenCalledTimes(1);
    expect(mocks.defineParser).toHaveBeenLastCalledWith({ backend: 'auto', dateOrder: 'DMY' });
    rerender({ text: 'b', order: 'MDY' });
    await advance(120);
    expect(mocks.defineParser).toHaveBeenCalledTimes(2);
    expect(mocks.defineParser).toHaveBeenLastCalledWith({ backend: 'auto', dateOrder: 'MDY' });
  });

  it('reports the backend of the result', async () => {
    mocks.parse.mockResolvedValueOnce(fakeResult('x', 'webgpu'));
    const { result } = renderHook(() => useTimeParse('x', { timeZone: 'UTC' }));
    await advance(120);
    expect(result.current.backend).toBe('webgpu');
  });

  it('is inert while `enabled` is false', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useTimeParse('noon', { timeZone: 'UTC', enabled }), { initialProps: { enabled: false } });
    await advance(500);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(result.current.pending).toBe(false);
    rerender({ enabled: true });
    await advance(120);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
  });

  it('cancels a waiting parse on unmount', async () => {
    const { unmount } = renderHook(() => useTimeParse('noon', { timeZone: 'UTC' }));
    await advance(60);
    unmount();
    await advance(500);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('drops an answer that arrives after unmount without updating state', async () => {
    const slow = deferred<TimeParseResult>();
    mocks.parse.mockReturnValueOnce(slow.promise);
    const { unmount } = renderHook(() => useTimeParse('noon', { timeZone: 'UTC' }));
    await advance(120);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => slow.resolve(fakeResult('late')));
    // (the afterEach asserts that React logged nothing)
  });
});

describe('loadGpuTime / parseTime', () => {
  it('loads the package once and shares the promise', async () => {
    const a = loadGpuTime();
    const b = loadGpuTime();
    expect(a).toBe(b);
    await a;
  });

  it('shares one parser between callers and disposes it on reset', async () => {
    await Promise.all([parseTime('a', { timeZone: 'UTC', reference: '2026-01-01T00:00:00Z' }), parseTime('b', { timeZone: 'UTC', reference: '2026-01-01T00:00:00Z' })]);
    expect(mocks.defineParser).toHaveBeenCalledTimes(1);
    resetGpuTime();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.dispose).toHaveBeenCalledTimes(1);
  });

  it('retries creating a parser after it failed', async () => {
    mocks.defineParser.mockRejectedValueOnce(new Error('WebGPU is unavailable.'));
    await expect(parseTime('a', { timeZone: 'UTC', backend: 'webgpu', reference: '2026-01-01T00:00:00Z' })).rejects.toThrow(/WebGPU/);
    await expect(parseTime('a', { timeZone: 'UTC', backend: 'webgpu', reference: '2026-01-01T00:00:00Z' })).resolves.toBeDefined();
    expect(mocks.defineParser).toHaveBeenCalledTimes(2);
  });
});
