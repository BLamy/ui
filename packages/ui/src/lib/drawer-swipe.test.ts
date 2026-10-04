// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDrawerSwipe } from '@/lib/drawer-swipe';

const ev = (x: number, y = 0, target: Element = document.createElement('div')) =>
  ({ button: 0, clientX: x, clientY: y, pointerId: 1, target, currentTarget: { setPointerCapture: () => undefined } }) as unknown as ReactPointerEvent;

function setup(side: 'left' | 'right', open: boolean, onOpen?: () => void) {
  const panel = document.createElement('div');
  panel.getBoundingClientRect = () => ({ width: 200 }) as DOMRect;
  const scrim = document.createElement('div');
  const onClose = vi.fn();
  const { result } = renderHook(() => useDrawerSwipe({
    side, open, panel: () => panel, scrim: () => scrim, commit: 0.3, flick: 0.5, onOpen, onClose,
  }));
  return { ...result.current, panel, scrim, onClose };
}

describe('useDrawerSwipe', () => {
  it('follows a drag toward the edge, fading the scrim, and closes past the commit distance', () => {
    const s = setup('left', true);
    s.panelProps.onPointerDownCapture(ev(150));
    s.panelProps.onPointerMove(ev(90));
    expect(s.panel.style.translate).toBe('-60px 0');
    expect(s.scrim.style.opacity).toBe('0.7');
    s.panelProps.onPointerUp();
    expect(s.onClose).toHaveBeenCalled();
    // handed back to the classes
    expect(s.panel.style.translate).toBe('');
    expect(s.scrim.style.opacity).toBe('');
  });
  it('springs back when released short of the commit distance, slowly', () => {
    const s = setup('left', true);
    s.panelProps.onPointerDownCapture(ev(150));
    // 20px over a second is no flick
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 1000);
    s.panelProps.onPointerMove(ev(130));
    s.panelProps.onPointerUp();
    vi.restoreAllMocks();
    expect(s.onClose).not.toHaveBeenCalled();
  });
  it('mirrors for a drawer on the right', () => {
    const s = setup('right', true);
    s.panelProps.onPointerDownCapture(ev(50));
    s.panelProps.onPointerMove(ev(120));
    expect(s.panel.style.translate).toBe('70px 0');
    s.panelProps.onPointerUp();
    expect(s.onClose).toHaveBeenCalled();
  });
  it('ignores a drag that starts vertical (a scroll)', () => {
    const s = setup('left', true);
    s.panelProps.onPointerDownCapture(ev(150, 0));
    s.panelProps.onPointerMove(ev(148, 40));
    s.panelProps.onPointerMove(ev(60, 40));
    s.panelProps.onPointerUp();
    expect(s.onClose).not.toHaveBeenCalled();
    expect(s.panel.style.translate).toBe('');
  });
  it('leaves a press on a marked control (the resizer) alone', () => {
    const s = setup('left', true);
    const handle = document.createElement('div');
    handle.dataset.drawerSwipe = 'off';
    s.panelProps.onPointerDownCapture(ev(150, 0, handle));
    s.panelProps.onPointerMove(ev(40));
    s.panelProps.onPointerUp();
    expect(s.onClose).not.toHaveBeenCalled();
  });
  it('opens from the edge strip: the parked panel follows the finger in', () => {
    const onOpen = vi.fn();
    const s = setup('left', false, onOpen);
    s.edgeProps.onPointerDown(ev(4));
    s.edgeProps.onPointerMove(ev(104));
    // half the width travelled: halfway between parked (-103%) and home
    expect(s.panel.style.translate).toBe('-103px 0');
    expect(s.scrim.style.opacity).toBe('0.5');
    s.edgeProps.onPointerUp();
    expect(onOpen).toHaveBeenCalled();
  });
  it('does not start an open gesture without onOpen, or a close gesture while closed', () => {
    const closed = setup('left', false);
    closed.edgeProps.onPointerDown(ev(4));
    closed.edgeProps.onPointerMove(ev(150));
    closed.edgeProps.onPointerUp();
    closed.panelProps.onPointerDownCapture(ev(150));
    closed.panelProps.onPointerMove(ev(40));
    closed.panelProps.onPointerUp();
    expect(closed.onClose).not.toHaveBeenCalled();
    expect(closed.panel.style.translate).toBe('');
  });
});
