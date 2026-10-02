// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEdgeSwipe } from '@/lib/edge-swipe';

const ev = (x: number, y = 0) => ({ button: 0, clientX: x, clientY: y, pointerId: 1 }) as unknown as ReactPointerEvent;
afterEach(() => vi.unstubAllGlobals());

function setup(move: () => void) {
  const target = document.createElement('div');
  target.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
  const release = vi.fn();
  const { result } = renderHook(() => useEdgeSwipe({
    target: () => target, edge: 24, commit: 0.4, flick: 0.5,
    begin: () => ({}), move, release,
  }));
  return { bind: result.current.bind, release };
}

describe('useEdgeSwipe', () => {
  it('engages on a rightward drag from the edge and releases with the distance', () => {
    const { bind, release } = setup(() => undefined);
    bind.onPointerDownCapture(ev(5));
    bind.onPointerMove(ev(200));
    bind.onPointerUp();
    expect(release).toHaveBeenCalledWith({}, expect.objectContaining({ dx: 195, commit: true }));
  });
  it('ignores a press outside the edge zone', () => {
    const { bind, release } = setup(() => undefined);
    bind.onPointerDownCapture(ev(100));
    bind.onPointerMove(ev(250));
    bind.onPointerUp();
    expect(release).not.toHaveBeenCalled();
  });
  it('drops the gesture and reports the error when move throws', () => {
    const reportError = vi.fn();
    vi.stubGlobal('reportError', reportError);
    const boom = new Error('boom');
    const { bind, release } = setup(() => { throw boom; });
    bind.onPointerDownCapture(ev(5));
    bind.onPointerMove(ev(200));
    bind.onPointerUp();
    expect(reportError).toHaveBeenCalledWith(boom);
    expect(release).not.toHaveBeenCalled();
  });
});
