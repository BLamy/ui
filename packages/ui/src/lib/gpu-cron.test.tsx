// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeCronError, gpuCronAvailable, hasWebGPU, parseCronText, peekGpuCronAvailable, resetGpuCron, useCronParse, type GpuCronMatch } from '@/lib/gpu-cron';

/* gpu-cron is WebGPU-only, so the hook is tested against a mocked package: availability, the debounce, out-of-order
   answers and unmount are all driven by hand. `navigator.gpu` is stubbed in and out. */

const mocks = vi.hoisted(() => ({ isAvailable: vi.fn(), parse: vi.fn(), loads: 0 }));

vi.mock('gpu-cron', () => {
  mocks.loads += 1;
  return { isAvailable: mocks.isAvailable, parse: mocks.parse };
});

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

const match = (expression: string): GpuCronMatch => ({ expression, next: ['2026-10-05T09:00:00.000Z'] });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const setWebGPU = (on: boolean) => {
  if (on) Object.defineProperty(navigator, 'gpu', { value: {}, configurable: true });
  else delete (navigator as unknown as Record<string, unknown>).gpu;
};

let errors: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  resetGpuCron();
  setWebGPU(true);
  mocks.isAvailable.mockReset();
  mocks.parse.mockReset();
  mocks.isAvailable.mockResolvedValue(true);
  mocks.parse.mockImplementation(async (text: string) => match(`parsed:${text}`));
  errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
  vi.useRealTimers();
  setWebGPU(false);
});

describe('gpuCronAvailable', () => {
  it('is false without navigator.gpu, and never loads the package', async () => {
    setWebGPU(false);
    expect(hasWebGPU()).toBe(false);
    const loadsBefore = mocks.loads;
    await expect(gpuCronAvailable()).resolves.toBe(false);
    expect(mocks.isAvailable).not.toHaveBeenCalled();
    expect(mocks.loads).toBe(loadsBefore);
    expect(peekGpuCronAvailable()).toBe(false);
  });

  it('asks the package once and caches the answer', async () => {
    expect(hasWebGPU()).toBe(true);
    expect(peekGpuCronAvailable()).toBeNull();
    const first = gpuCronAvailable();
    expect(gpuCronAvailable()).toBe(first);
    await expect(first).resolves.toBe(true);
    await gpuCronAvailable();
    expect(mocks.isAvailable).toHaveBeenCalledTimes(1);
    expect(peekGpuCronAvailable()).toBe(true);
  });

  it('is false when the package says so, and when asking throws', async () => {
    mocks.isAvailable.mockResolvedValueOnce(false);
    await expect(gpuCronAvailable()).resolves.toBe(false);
    resetGpuCron();
    mocks.isAvailable.mockRejectedValueOnce(new Error('boom'));
    await expect(gpuCronAvailable()).resolves.toBe(false);
  });
});

describe('parseCronText', () => {
  it('trims the text and passes the count', async () => {
    const r = await parseCronText('  every day at noon  ', { count: 3 });
    expect(mocks.parse).toHaveBeenCalledWith('every day at noon', { count: 3 });
    expect(r.expression).toBe('parsed:every day at noon');
  });
  it('defaults to five fire times', async () => {
    await parseCronText('x');
    expect(mocks.parse).toHaveBeenCalledWith('x', { count: 5 });
  });
});

describe('describeCronError', () => {
  it('maps the model errors to short messages', () => {
    expect(describeCronError(new Error('This browser has no WebGPU (navigator.gpu is undefined)'))).toMatch(/needs WebGPU/);
    expect(describeCronError(new Error('prompt is 900 characters; the model fits 200 alongside its answer'))).toMatch(/too long/);
    expect(describeCronError(new Error('gpu-cron invariant violated'))).toMatch(/could not read/);
    expect(describeCronError('weird')).toMatch(/could not read/);
  });
});

describe('useCronParse', () => {
  it('starts with supported null, then true, and parses after the debounce', async () => {
    const { result } = renderHook(() => useCronParse('every weekday at 9am'));
    expect(result.current).toMatchObject({ supported: null, result: null, pending: false });
    await advance(0);
    expect(result.current.supported).toBe(true);
    expect(result.current.pending).toBe(true);
    await advance(149);
    expect(mocks.parse).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.parse).toHaveBeenCalledWith('every weekday at 9am', { count: 5 });
    expect(result.current).toMatchObject({ supported: true, pending: false, error: null, parsedText: 'every weekday at 9am' });
    expect(result.current.result?.expression).toBe('parsed:every weekday at 9am');
  });

  it('is unsupported (and never parses) when there is no navigator.gpu', async () => {
    setWebGPU(false);
    const { result } = renderHook(() => useCronParse('every day'));
    await advance(1000);
    expect(result.current).toEqual({ result: null, error: null, pending: false, supported: false, parsedText: null });
    expect(mocks.isAvailable).not.toHaveBeenCalled();
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it('is unsupported when the adapter is missing or the check throws', async () => {
    mocks.isAvailable.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useCronParse('every day'));
    await advance(1000);
    expect(result.current.supported).toBe(false);
    expect(mocks.parse).not.toHaveBeenCalled();

    resetGpuCron();
    mocks.isAvailable.mockRejectedValueOnce(new Error('no adapter'));
    const second = renderHook(() => useCronParse('every day'));
    await advance(1000);
    expect(second.result.current.supported).toBe(false);
    expect(mocks.parse).not.toHaveBeenCalled();
  });

  it('knows the answer at once for a second mount', async () => {
    const first = renderHook(() => useCronParse(''));
    await advance(0);
    expect(first.result.current.supported).toBe(true);
    const second = renderHook(() => useCronParse(''));
    expect(second.result.current.supported).toBe(true); // from the first render, no flash of null
    expect(mocks.isAvailable).toHaveBeenCalledTimes(1);
  });

  it('parses only the last of several quick changes', async () => {
    const { result, rerender } = renderHook(({ text }) => useCronParse(text), { initialProps: { text: 'e' } });
    await advance(0);
    await advance(100);
    rerender({ text: 'ev' });
    await advance(100);
    rerender({ text: 'eve' });
    await advance(150);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(mocks.parse.mock.calls[0][0]).toBe('eve');
    expect(result.current.parsedText).toBe('eve');
  });

  it('ignores a slow answer to old text that arrives after a newer one', async () => {
    const first = deferred<GpuCronMatch>();
    const second = deferred<GpuCronMatch>();
    mocks.parse.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(({ text }) => useCronParse(text), { initialProps: { text: 'monday' } });
    await advance(0);
    await advance(150);
    rerender({ text: 'tuesday' });
    await advance(150);
    expect(mocks.parse.mock.calls.map((c) => c[0])).toEqual(['monday', 'tuesday']);
    await act(async () => second.resolve(match('tuesday-cron')));
    expect(result.current).toMatchObject({ pending: false, parsedText: 'tuesday' });
    await act(async () => first.resolve(match('monday-cron')));
    expect(result.current.result?.expression).toBe('tuesday-cron');
    expect(result.current.parsedText).toBe('tuesday');
  });

  it('ignores a stale rejection', async () => {
    const first = deferred<GpuCronMatch>();
    mocks.parse.mockReturnValueOnce(first.promise);
    const { result, rerender } = renderHook(({ text }) => useCronParse(text), { initialProps: { text: 'monday' } });
    await advance(0);
    await advance(150);
    rerender({ text: 'tuesday' });
    await advance(150);
    await act(async () => first.reject(new Error('stale')));
    expect(result.current.error).toBeNull();
    expect(result.current.result?.expression).toBe('parsed:tuesday');
  });

  it('keeps the previous answer readable (as `parsedText`) while a new one is pending', async () => {
    const { result, rerender } = renderHook(({ text }) => useCronParse(text), { initialProps: { text: 'a' } });
    await advance(0);
    await advance(150);
    rerender({ text: 'ab' });
    expect(result.current).toMatchObject({ pending: true, parsedText: 'a' });
    expect(result.current.result?.expression).toBe('parsed:a');
  });

  it('does nothing for empty text, and clears when it is emptied', async () => {
    const { result, rerender } = renderHook(({ text }) => useCronParse(text), { initialProps: { text: '  ' } });
    await advance(500);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ result: null, pending: false, supported: true });
    rerender({ text: 'daily' });
    await advance(150);
    expect(result.current.result).not.toBeNull();
    rerender({ text: '' });
    expect(result.current).toEqual({ result: null, error: null, pending: false, supported: true, parsedText: null });
  });

  it('surfaces a rejection as `error`', async () => {
    mocks.parse.mockRejectedValueOnce(new Error('prompt is 900 characters'));
    const { result } = renderHook(() => useCronParse('very long'));
    await advance(0);
    await advance(150);
    expect(result.current).toMatchObject({ result: null, pending: false, parsedText: 'very long' });
    expect(result.current.error?.message).toMatch(/900 characters/);
  });

  it('passes `count`, and honours debounceMs', async () => {
    renderHook(() => useCronParse('daily', { count: 2, debounceMs: 400 }));
    await advance(0);
    await advance(399);
    expect(mocks.parse).not.toHaveBeenCalled();
    await advance(1);
    expect(mocks.parse).toHaveBeenCalledWith('daily', { count: 2 });
  });

  it('is inert while disabled: no availability check, no parse', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useCronParse('daily', { enabled }), { initialProps: { enabled: false } });
    await advance(1000);
    expect(mocks.isAvailable).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ supported: null, pending: false, result: null });
    rerender({ enabled: true });
    await advance(0);
    await advance(150);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    expect(result.current.supported).toBe(true);
  });

  it('cancels a waiting parse on unmount', async () => {
    const { unmount } = renderHook(() => useCronParse('daily'));
    await advance(0);
    await advance(50);
    unmount();
    await advance(1000);
    expect(mocks.parse).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('survives an answer that arrives after unmount', async () => {
    const slow = deferred<GpuCronMatch>();
    mocks.parse.mockReturnValueOnce(slow.promise);
    const { unmount } = renderHook(() => useCronParse('daily'));
    await advance(0);
    await advance(150);
    expect(mocks.parse).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => slow.resolve(match('late')));
  });

  it('does not set state if unmounted before the availability check settles', async () => {
    const gate = deferred<boolean>();
    mocks.isAvailable.mockReturnValueOnce(gate.promise);
    const { unmount } = renderHook(() => useCronParse('daily'));
    unmount();
    await act(async () => gate.resolve(true));
  });
});
