// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce } from '@ui-sdk/core';
import { bindPullToRefresh, type BindPullToRefreshOptions } from '@/lib/pull-to-refresh';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

vi.mock('@ui-sdk/core', async (original) => ({
  ...(await original<typeof import('@ui-sdk/core')>()),
  announce: vi.fn(),
}));
const announced = () => vi.mocked(announce).mock.calls.map(([text]) => text);

let cleanup: (() => void) | undefined;
beforeEach(() => vi.mocked(announce).mockClear());
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// A touch event with one finger down per point, or none for a lift.
function touch(type: string, points: [number, number][], init: EventInit = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true, ...init });
  const touches = points.map(([clientX, clientY], identifier) => ({
    identifier,
    clientX,
    clientY,
  }));
  Object.defineProperty(event, 'touches', { value: touches });
  return event as TouchEvent;
}

// A scroller 600 tall, at its top, holding a row and a scroller of its own.
function setup(options: Partial<BindPullToRefreshOptions> = {}) {
  const scroller = document.createElement('div');
  Object.defineProperty(scroller, 'clientHeight', { value: 600 });
  const row = scroller.appendChild(document.createElement('p'));
  document.body.append(scroller);
  const onRefresh = vi.fn(options.onRefresh);
  const bound = bindPullToRefresh(scroller, { ...options, onRefresh });
  cleanup = bound;
  const variable = (name: string) => scroller.style.getPropertyValue(name);
  // A finger lands on `target`, moves through each point, and lifts.
  const pull = (path: [number, number][], target: Element = row) => {
    target.dispatchEvent(touch('touchstart', [[100, 100]]));
    const moves = path.map((point) => touch('touchmove', [point]));
    moves.forEach((move) => target.dispatchEvent(move));
    return {
      moves,
      lift: () => target.dispatchEvent(touch('touchend', [])),
    };
  };
  return { scroller, row, onRefresh, refresh: bound.refresh, variable, pull };
}

// How far a pull of `down` pixels shows on a scroller 600 tall.
const shown = (down: number) => (1 - 1 / ((down * 0.55) / 600 + 1)) * 600;

describe('bindPullToRefresh', () => {
  it('a pull down from the top shows its distance, with resistance, and its progress', () => {
    const { scroller, variable, pull } = setup();
    const { moves } = pull([
      [100, 110],
      [100, 200],
    ]);
    expect(scroller.hasAttribute('data-pulling')).toBe(true);
    expect(parseFloat(variable('--pull-distance'))).toBeCloseTo(shown(100));
    expect(shown(100)).toBeLessThan(100);
    expect(Number(variable('--pull-progress'))).toBeCloseTo(shown(100) / 64);
    // The pull is ours, so the browser doesn't scroll or bounce with it.
    expect(moves.every((move) => move.defaultPrevented)).toBe(true);
  });

  it("letting go past the threshold refreshes, and short of it doesn't", () => {
    const { scroller, onRefresh, variable, pull } = setup();
    pull([[100, 180]]).lift();
    expect(onRefresh).not.toHaveBeenCalled();
    expect(scroller.hasAttribute('data-pulling')).toBe(false);
    expect(variable('--pull-distance')).toBe('0px');
    pull([[100, 300]]).lift();
    expect(onRefresh).toHaveBeenCalledWith(expect.objectContaining({ event: expect.any(Event) }));
    // Nothing to wait for, so the pull closes at once.
    expect(variable('--pull-distance')).toBe('0px');
    expect(variable('--pull-progress')).toBe('0');
  });

  it('threshold sets how far a pull shows before it refreshes', () => {
    const { onRefresh, variable, pull } = setup({ threshold: 20 });
    const short = pull([[100, 130]]);
    expect(variable('--pull-progress')).toBe(String(shown(30) / 20));
    short.lift();
    expect(onRefresh).not.toHaveBeenCalled();
    const far = pull([[100, 160]]);
    expect(variable('--pull-progress')).toBe('1');
    far.lift();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('a pending refresh holds the pull open, and refuses another, until it settles', async () => {
    let settle = () => {};
    const { scroller, onRefresh, variable, pull } = setup({
      onRefresh: () => new Promise<void>((resolve) => (settle = resolve)),
    });
    pull([[100, 300]]).lift();
    expect(scroller.hasAttribute('data-pending')).toBe(true);
    expect(scroller.getAttribute('aria-busy')).toBe('true');
    expect(variable('--pull-distance')).toBe('64px');
    expect(variable('--pull-progress')).toBe('1');
    const { moves } = pull([[100, 300]]);
    expect(moves[0].defaultPrevented).toBe(false);
    expect(scroller.hasAttribute('data-pulling')).toBe(false);
    settle();
    await Promise.resolve();
    expect(scroller.hasAttribute('data-pending')).toBe(false);
    expect(scroller.hasAttribute('aria-busy')).toBe(false);
    expect(variable('--pull-distance')).toBe('0px');
    pull([[100, 300]]).lift();
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('a refresh that fails lets go of the pull too', async () => {
    const { scroller, pull } = setup({
      onRefresh: () => Promise.reject(new Error('offline')),
    });
    pull([[100, 300]]).lift();
    expect(scroller.hasAttribute('data-pending')).toBe(true);
    await Promise.resolve();
    expect(scroller.hasAttribute('data-pending')).toBe(false);
  });

  it('refresh() refreshes from code, as a button would, with the same hold', async () => {
    let settle = () => {};
    const { scroller, onRefresh, refresh } = setup({
      onRefresh: () => new Promise<void>((resolve) => (settle = resolve)),
    });
    refresh();
    refresh();
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalledWith({
      source: 'programmatic',
      event: undefined,
    });
    expect(scroller.hasAttribute('data-pending')).toBe(true);
    settle();
    await Promise.resolve();
    expect(scroller.hasAttribute('data-pending')).toBe(false);
  });

  it("a scroller that isn't at its top keeps scrolling", () => {
    const { scroller, onRefresh, pull } = setup();
    scroller.scrollTop = 40;
    const { moves, lift } = pull([[100, 300]]);
    lift();
    expect(moves[0].defaultPrevented).toBe(false);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('a finger that moves up or sideways first keeps its gesture, whatever it does next', () => {
    const { scroller, onRefresh, pull } = setup();
    for (const first of [
      [100, 60],
      [180, 120],
    ] as [number, number][]) {
      const { moves, lift } = pull([first, [100, 400]]);
      lift();
      expect(moves.some((move) => move.defaultPrevented)).toBe(false);
    }
    expect(scroller.hasAttribute('data-pulling')).toBe(false);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("a scroll the browser already started isn't taken over", () => {
    const { row, scroller } = setup();
    row.dispatchEvent(touch('touchstart', [[100, 100]]));
    row.dispatchEvent(touch('touchmove', [[100, 300]], { cancelable: false }));
    expect(scroller.hasAttribute('data-pulling')).toBe(false);
  });

  it('a second finger ends the pull without refreshing', () => {
    const { row, scroller, onRefresh, variable, pull } = setup();
    pull([[100, 300]]);
    row.dispatchEvent(
      touch('touchstart', [
        [100, 300],
        [200, 300],
      ]),
    );
    expect(scroller.hasAttribute('data-pulling')).toBe(false);
    expect(variable('--pull-distance')).toBe('0px');
    row.dispatchEvent(touch('touchend', []));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('a scroller inside keeps a gesture that starts on it', () => {
    const { scroller, onRefresh, pull } = setup();
    const inner = scroller.appendChild(document.createElement('div'));
    inner.style.overflowY = 'auto';
    Object.defineProperty(inner, 'scrollHeight', { value: 900 });
    Object.defineProperty(inner, 'clientHeight', { value: 200 });
    const item = inner.appendChild(document.createElement('p'));
    pull([[100, 300]], item).lift();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('disabled refuses a pull and a refresh from code', () => {
    let disabled = true;
    const { onRefresh, refresh, pull } = setup({ disabled: () => disabled });
    pull([[100, 300]]).lift();
    refresh();
    expect(onRefresh).not.toHaveBeenCalled();
    disabled = false;
    pull([[100, 300]]).lift();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('with reduced motion the content stays put, and the pull still fills and refreshes', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }));
    let settle = () => {};
    const { variable, pull, onRefresh } = setup({
      onRefresh: () => new Promise<void>((resolve) => (settle = resolve)),
    });
    const { lift } = pull([[100, 300]]);
    expect(variable('--pull-distance')).toBe('0px');
    expect(variable('--pull-progress')).toBe('1');
    lift();
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(variable('--pull-distance')).toBe('0px');
    settle();
  });

  it("screen readers hear a refresh that's still pending after a second", async () => {
    vi.useFakeTimers();
    const { refresh } = setup({
      onRefresh: () => new Promise(() => {}),
      pendingAnnouncement: 'Refreshing your inbox',
    });
    refresh();
    await vi.advanceTimersByTimeAsync(999);
    expect(announced()).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(announced()).toEqual(['Refreshing your inbox']);
  });

  it('a refresh that settles within a second says nothing', async () => {
    vi.useFakeTimers();
    let settle = () => {};
    const { refresh } = setup({
      onRefresh: () => new Promise<void>((resolve) => (settle = resolve)),
    });
    refresh();
    await vi.advanceTimersByTimeAsync(500);
    settle();
    await vi.advanceTimersByTimeAsync(1000);
    expect(announced()).toEqual([]);
  });

  it("keeps the browser's own pull to refresh off the scroller, and puts its styles back", () => {
    const { scroller, variable, pull } = setup();
    expect(variable('overscroll-behavior-y')).toBe('contain');
    pull([[100, 300]]);
    cleanup?.();
    cleanup = undefined;
    expect(variable('overscroll-behavior-y')).toBe('');
    expect(variable('--pull-distance')).toBe('');
    expect(variable('--pull-progress')).toBe('');
    expect(scroller.hasAttribute('data-pulling')).toBe(false);
  });

  it('a refresh that settles after the cleanup leaves the scroller alone', async () => {
    let settle = () => {};
    const { scroller, refresh, variable } = setup({
      onRefresh: () => new Promise<void>((resolve) => (settle = resolve)),
    });
    refresh();
    cleanup?.();
    cleanup = undefined;
    expect(scroller.hasAttribute('data-pending')).toBe(false);
    settle();
    await Promise.resolve();
    expect(variable('--pull-distance')).toBe('');
  });
  it('adds the non-passive touchmove only while a touch that can pull is down', () => {
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'clientHeight', { value: 600 });
    document.body.append(scroller);
    const added = vi.spyOn(scroller, 'addEventListener');
    const removed = vi.spyOn(scroller, 'removeEventListener');
    cleanup = bindPullToRefresh(scroller, { onRefresh: () => {} });
    const nonPassive = () =>
      added.mock.calls.filter(
        ([type, , options]) => type === 'touchmove' && (options as AddEventListenerOptions)?.passive === false,
      ).length;
    expect(added.mock.calls.some(([type]) => type === 'touchmove')).toBe(false);
    // Scrolled down: no pull can start, so scrolling never waits on the main thread.
    scroller.scrollTop = 40;
    scroller.dispatchEvent(touch('touchstart', [[100, 100]]));
    expect(nonPassive()).toBe(0);
    scroller.dispatchEvent(touch('touchend', []));
    scroller.scrollTop = 0;
    scroller.dispatchEvent(touch('touchstart', [[100, 100]]));
    expect(nonPassive()).toBe(1);
    scroller.dispatchEvent(touch('touchend', []));
    // And taken off again once the finger lifts.
    const lastAdd = Math.max(
      ...added.mock.calls.map(([type], i) => (type === 'touchmove' ? added.mock.invocationCallOrder[i] : 0)),
    );
    const lastRemove = Math.max(
      ...removed.mock.calls.map(([type], i) => (type === 'touchmove' ? removed.mock.invocationCallOrder[i] : 0)),
    );
    expect(lastRemove).toBeGreaterThan(lastAdd);
  });

  it('reports how it was pressed: touch from a pull', () => {
    const { onRefresh, pull } = setup();
    pull([[100, 300]]).lift();
    expect(onRefresh.mock.calls[0][0].source).toBeTypeOf('string');
  });
});
