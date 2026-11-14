// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { Celebrate } from '@/components/ui/celebrate';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const bursts = (container: HTMLElement) => container.querySelector('[data-slot=celebrate]')!.children.length;

describe('Celebrate', () => {
  it('is decorative, and does not fire on its first render, even in Strict Mode', () => {
    const { container } = render(<StrictMode><Celebrate fire={1} /></StrictMode>);
    expect(container.querySelector('[data-slot=celebrate]')!.getAttribute('aria-hidden')).toBe('true');
    expect(bursts(container)).toBe(0);
  });

  it('fires a burst each time `fire` changes and removes it afterwards', () => {
    const { container, rerender } = render(<Celebrate fire={0} />);
    rerender(<Celebrate fire={1} />);
    expect(bursts(container)).toBe(1);
    act(() => vi.advanceTimersByTime(1400));
    expect(bursts(container)).toBe(0);
  });

  it('removes every burst when two fire within one animation', () => {
    const { container, rerender } = render(<Celebrate fire={0} />);
    rerender(<Celebrate fire={1} />);
    act(() => vi.advanceTimersByTime(500));
    rerender(<Celebrate fire={2} />);
    expect(bursts(container)).toBe(2);
    act(() => vi.advanceTimersByTime(900));
    expect(bursts(container)).toBe(1);
    act(() => vi.advanceTimersByTime(500));
    expect(bursts(container)).toBe(0);
  });

  it('never fires for a falsy value', () => {
    const { container, rerender } = render(<Celebrate fire={1} />);
    rerender(<Celebrate fire={false} />);
    expect(bursts(container)).toBe(0);
  });
});
