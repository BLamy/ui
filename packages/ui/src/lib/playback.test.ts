import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayback } from '@/lib/playback';

/** Animation frames on a hand-cranked clock: `advance(ms)` moves performance.now() on and runs the frames waiting. */
function fakeFrames() {
  let now = 1000;
  let handle = 0;
  const waiting = new Map<number, FrameRequestCallback>();
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    waiting.set(++handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (h: number) => waiting.delete(h));
  return {
    /** Frames requested and not yet run or cancelled. */
    get waiting() {
      return waiting.size;
    },
    advance(ms: number) {
      now += ms;
      const due = [...waiting.values()];
      waiting.clear();
      for (const callback of due) callback(now);
    },
  };
}

let frames: ReturnType<typeof fakeFrames>;
beforeEach(() => {
  frames = fakeFrames();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createPlayback: state', () => {
  it('starts paused at 0, with what it is given on top', () => {
    expect(createPlayback().getState()).toEqual({ time: 0, playing: false, duration: 0, rate: 1, loop: false, scrubbing: false });
    expect(createPlayback({ duration: 10, rate: 2, loop: true }).getState()).toMatchObject({ time: 0, duration: 10, rate: 2, loop: true });
  });
  it('seeks within 0…duration', () => {
    const { seek, getState } = createPlayback({ duration: 10 });
    seek(4);
    expect(getState().time).toBe(4);
    seek(-1);
    expect(getState().time).toBe(0);
    seek(12);
    expect(getState().time).toBe(10);
    seek(NaN);
    expect(getState().time).toBe(0);
  });
  it('steps by a delta, clamped the same way', () => {
    const { step, getState } = createPlayback({ duration: 10, time: 5 });
    step(0.5);
    expect(getState().time).toBe(5.5);
    step(-10);
    expect(getState().time).toBe(0);
    step(20);
    expect(getState().time).toBe(10);
  });
  it('brings the time back inside a shorter duration', () => {
    const { setDuration, getState } = createPlayback({ duration: 10, time: 8 });
    setDuration(5);
    expect(getState()).toMatchObject({ duration: 5, time: 5 });
    setDuration(20);
    expect(getState()).toMatchObject({ duration: 20, time: 5 });
    setDuration(-3);
    expect(getState()).toMatchObject({ duration: 0, time: 0 });
  });
  it('tells subscribers about changes until they unsubscribe; an unchanged duration or scrubbing says nothing', () => {
    const { subscribe, setDuration, setScrubbing, setRate, setLoop } = createPlayback({ duration: 10 });
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setDuration(10); // the same: nothing to say
    setScrubbing(false); // the same
    setScrubbing(true);
    setRate(2);
    setLoop(true);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    setScrubbing(false);
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('createPlayback: playing', () => {
  it('does not play with nothing to play', () => {
    const { play, getState } = createPlayback();
    play();
    expect(getState().playing).toBe(false);
    expect(frames.waiting).toBe(0);
  });
  it('flips playing with play, pause and toggle, telling subscribers each time', () => {
    const { play, pause, toggle, getState, subscribe } = createPlayback({ duration: 10 });
    const heard: boolean[] = [];
    subscribe(() => heard.push(getState().playing));
    play();
    play(); // already playing
    pause();
    pause(); // already paused
    toggle();
    toggle();
    expect(heard).toEqual([true, false, true, false]);
    expect(frames.waiting).toBe(0);
  });
  it('advances on animation frames at its rate, telling subscribers each tick', () => {
    const { play, setRate, getState, subscribe } = createPlayback({ duration: 10 });
    const listener = vi.fn();
    subscribe(listener);
    play();
    frames.advance(100);
    expect(getState().time).toBeCloseTo(0.1);
    setRate(2);
    frames.advance(100);
    expect(getState().time).toBeCloseTo(0.3);
    expect(listener).toHaveBeenCalledTimes(4); // play, a tick, setRate, a tick
    expect(frames.waiting).toBe(1);
  });
  it('moves at most a quarter of a second a frame, so a stalled tab does not jump ahead', () => {
    const { play, getState } = createPlayback({ duration: 10 });
    play();
    frames.advance(5000);
    expect(getState().time).toBeCloseTo(0.25);
  });
  it('stops at the end, and plays again from the start', () => {
    const { play, getState } = createPlayback({ duration: 1, time: 0.9 });
    play();
    frames.advance(200);
    expect(getState()).toMatchObject({ time: 1, playing: false });
    expect(frames.waiting).toBe(0);
    play();
    expect(getState()).toMatchObject({ time: 0, playing: true });
  });
  it('wraps around the end when looping', () => {
    const { play, getState } = createPlayback({ duration: 1, time: 0.9, loop: true });
    play();
    frames.advance(200);
    expect(getState().playing).toBe(true);
    expect(getState().time).toBeCloseTo(0.1);
    expect(frames.waiting).toBe(1);
  });
  it('stops asking for frames when paused', () => {
    const { play, pause, getState } = createPlayback({ duration: 10 });
    play();
    frames.advance(100);
    pause();
    expect(frames.waiting).toBe(0);
    frames.advance(100);
    expect(getState().time).toBeCloseTo(0.1);
  });
  it('measures the next frame from a seek made while playing', () => {
    const { play, seek, getState } = createPlayback({ duration: 10 });
    play();
    frames.advance(100);
    seek(5);
    frames.advance(100);
    expect(getState().time).toBeCloseTo(5.1);
  });
});
