// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollHidden } from '@/lib/scroll-hidden';
import { chromeStore } from '@/lib/theme';

/** A scroller whose scrollTop the test sets, then fires `scroll`. */
function scroller() {
  const el = document.createElement('div');
  let top = 0;
  Object.defineProperty(el, 'scrollTop', { get: () => top, set: (v) => { top = v; }, configurable: true });
  const scrollTo = (v: number) => act(() => { top = v; el.dispatchEvent(new Event('scroll')); });
  return { ref: { current: el }, scrollTo };
}

describe('useScrollHidden', () => {
  it('hides on scroll down and returns on scroll up', () => {
    const s = scroller();
    const { result } = renderHook(() => useScrollHidden(true, s.ref));
    expect(result.current).toBe(false);
    s.scrollTo(80);
    expect(result.current).toBe(true);
    s.scrollTo(60);
    expect(result.current).toBe(false);
  });
  it('comes back at the top', () => {
    const s = scroller();
    const { result } = renderHook(() => useScrollHidden(true, s.ref));
    s.scrollTo(80);
    s.scrollTo(2);
    expect(result.current).toBe(false);
  });
  it('is always false when hideOnScroll is off', () => {
    const s = scroller();
    const { result } = renderHook(() => useScrollHidden(false, s.ref));
    s.scrollTo(80);
    expect(result.current).toBe(false);
  });
  it('follows the shared chrome state', () => {
    const { result } = renderHook(() => useScrollHidden(true));
    expect(result.current).toBe(false);
    act(() => chromeStore.set(true));
    expect(result.current).toBe(true);
    act(() => chromeStore.set(false));
    expect(result.current).toBe(false);
  });
});
