'use client';
/* ══ Playback clock — the time a preview, a timeline and transport controls share ══
   A small external store: time, playing, duration, rate, loop. While playing it advances on animation frames at `rate`
   times real time and stops at the end (or loops). Subscribers hear every tick: a playhead or a <video> follows it
   without re-rendering anything, and `usePlaybackState(clock, select)` re-renders only when what it selects changes.
   `scrubbing` is set while a pointer drags the time, so a preview can seek coarsely until it lets go. ══ */
import { useState, useSyncExternalStore } from 'react';

export interface PlaybackState {
  /** Seconds. */
  time: number;
  playing: boolean;
  /** Seconds; the clock stops (or loops) here. */
  duration: number;
  /** Times real time. */
  rate: number;
  loop: boolean;
  /** A pointer is dragging the time. */
  scrubbing: boolean;
}

export interface Playback {
  getState(): PlaybackState;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  toggle(): void;
  /** Moves the time (clamped to 0…duration). */
  seek(time: number): void;
  /** Moves the time by `delta` seconds. */
  step(delta: number): void;
  setDuration(duration: number): void;
  setRate(rate: number): void;
  setLoop(loop: boolean): void;
  setScrubbing(scrubbing: boolean): void;
}

/** A clock (paused, at `initial.time`); `playing` and `scrubbing` in `initial` are ignored: call `play()`. */
export function createPlayback(initial: Partial<PlaybackState> = {}): Playback {
  let state: PlaybackState = { time: 0, duration: 0, rate: 1, loop: false, ...initial, playing: false, scrubbing: false };
  const listeners = new Set<() => void>();
  let raf = 0;
  let last = 0;
  const set = (patch: Partial<PlaybackState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const frame = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    let t = state.time + dt * state.rate;
    if (t >= state.duration) {
      if (state.loop && state.duration > 0) t %= state.duration;
      else { raf = 0; set({ time: state.duration, playing: false }); return; }
    }
    raf = requestAnimationFrame(frame);
    set({ time: t });
  };
  const clamp = (t: number) => (Number.isNaN(t) ? 0 : Math.max(0, Math.min(state.duration, t)));
  const play = () => {
    if (state.playing || state.duration <= 0) return;
    last = performance.now();
    set({ playing: true, time: state.time >= state.duration ? 0 : state.time });
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    if (!state.playing) return;
    stop();
    set({ playing: false });
  };
  const seek = (time: number) => {
    last = performance.now();
    set({ time: clamp(time) });
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    play,
    pause,
    toggle: () => (state.playing ? pause() : play()),
    seek,
    step: (delta) => seek(state.time + delta),
    setDuration(duration) {
      const d = Math.max(0, duration);
      if (d === state.duration) return;
      set({ duration: d, time: Math.min(state.time, d) });
    },
    setRate: (rate) => set({ rate }),
    setLoop: (loop) => set({ loop }),
    setScrubbing: (scrubbing) => { if (scrubbing !== state.scrubbing) set({ scrubbing }); },
  };
}

/** A clock that lives as long as the component. */
export function usePlaybackClock(initial?: Partial<PlaybackState>): Playback {
  const [clock] = useState(() => createPlayback(initial));
  return clock;
}

/** Re-renders when the selected part of the clock's state changes: `usePlaybackState(clock, (s) => s.playing)`. */
export function usePlaybackState<T = PlaybackState>(clock: Playback, select: (s: PlaybackState) => T = (s) => s as T): T {
  return useSyncExternalStore(clock.subscribe, () => select(clock.getState()), () => select(clock.getState()));
}
