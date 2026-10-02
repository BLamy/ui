// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { usePullToRefresh } from '@/lib/pull-to-refresh';

const ev = (y: number) => ({ button: 0, clientX: 0, clientY: y, pointerId: 1 }) as unknown as ReactPointerEvent;

function setup(onRefresh: () => void | Promise<unknown>) {
  const scroller = { current: document.createElement('div') };
  const content = { current: document.createElement('div') };
  const spinner = { current: document.createElement('div') };
  const hook = renderHook(() => usePullToRefresh({ onRefresh, scroller, content, spinner }));
  /** A full pull, past the arming threshold, then release. */
  const pull = () => act(() => {
    hook.result.current.bind.onPointerDown(ev(0));
    hook.result.current.bind.onPointerMove(ev(200));
    hook.result.current.bind.onPointerUp();
  });
  return { ...hook, pull, content: content.current };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('usePullToRefresh', () => {
  it('runs onRefresh as soon as the pull is released and holds the spinner for the minimum time', async () => {
    const onRefresh = vi.fn();
    const { result, pull } = setup(onRefresh);
    pull();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.refreshing).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.refreshing).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(result.current.refreshing).toBe(false);
  });
  it('keeps the spinner until a returned promise settles', async () => {
    let finish!: () => void;
    const { result, pull } = setup(() => new Promise<void>((r) => { finish = r; }));
    pull();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(result.current.refreshing).toBe(true);
    await act(async () => { finish(); });
    expect(result.current.refreshing).toBe(false);
  });
  it('settles and reports the error when onRefresh rejects', async () => {
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    const boom = new Error('boom');
    const { result, pull } = setup(() => Promise.reject(boom));
    pull();
    await act(() => vi.advanceTimersByTimeAsync(1200));
    expect(result.current.refreshing).toBe(false);
    expect(reportError).toHaveBeenCalledWith(boom);
    vi.unstubAllGlobals();
  });
  it('does not refresh on a short pull', () => {
    const onRefresh = vi.fn();
    const { result } = setup(onRefresh);
    act(() => {
      result.current.bind.onPointerDown(ev(0));
      result.current.bind.onPointerMove(ev(30));
      result.current.bind.onPointerUp();
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });
  it('leaves no timers behind when unmounted mid-refresh', () => {
    const { pull, unmount } = setup(() => undefined);
    pull();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
