// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindEdgeSwipe, type BindEdgeSwipeOptions } from '@/lib/edge-swipe';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  document.body.replaceChildren();
});

/* Pointer events a set time apart, so a swipe's speed is known. */
let time = 0;
function pointer(type: string, x: number, y: number, ms = 50) {
  time += ms;
  const event = new PointerEvent(type, {
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    bubbles: true, cancelable: true, clientX: x, clientY: y,
  });
  Object.defineProperty(event, 'timeStamp', { value: time });
  return event;
}
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** A page 300 wide and 600 tall at the top left of the screen. */
function setup(options: BindEdgeSwipeOptions = {}, dir = 'ltr', parent: HTMLElement = document.body) {
  const el = document.createElement('div');
  el.style.direction = dir;
  el.getBoundingClientRect = () => new DOMRect(0, 0, 300, 600);
  parent.append(el);
  const onStart = vi.fn(options.onStart);
  const onMove = vi.fn();
  const onEnd = vi.fn();
  cleanups.push(bindEdgeSwipe(el, { ...options, onStart, onMove, onEnd }));
  /** A press at `from`, a move a frame through each point, then a release at the last. */
  const swipe = async (from: [number, number], path: [number, number][], ms = 50, target: HTMLElement = el) => {
    target.dispatchEvent(pointer('pointerdown', ...from, 0));
    for (const point of path) {
      document.dispatchEvent(pointer('pointermove', ...point, ms));
      await frame();
    }
    document.dispatchEvent(pointer('pointerup', ...path[path.length - 1], ms));
  };
  return { el, onStart, onMove, onEnd, swipe };
}

describe('bindEdgeSwipe: commit and cancel', () => {
  it('a slow swipe past a third of the element finishes', async () => {
    const { onEnd, swipe } = setup();
    await swipe([10, 300], [[40, 300], [80, 300], [110, 300], [115, 300], [115, 300]]);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith(true, expect.objectContaining({ event: expect.any(PointerEvent) }));
  });

  it("a slow swipe short of a third doesn't finish", async () => {
    const { onEnd, swipe } = setup();
    await swipe([10, 300], [[40, 300], [70, 300], [85, 300], [90, 300], [90, 300]]);
    expect(onEnd).toHaveBeenCalledWith(false, expect.anything());
  });

  it("a short drag still moving slowly when it's let go springs back: below a flick's speed, nothing is projected", async () => {
    const { onEnd, swipe } = setup();
    // 3px every 17ms (about 0.18 px/ms) to 60px of 300: projected at UIScrollView's rate it would carry past a third.
    await swipe([10, 300], Array.from({ length: 17 }, (_, i): [number, number] => [10 + 3 * (i + 1), 300]), 17);
    const [committed, details] = onEnd.mock.calls[0];
    expect(details.velocity).toBeGreaterThan(0.1);
    expect(details.velocity).toBeLessThan(0.5);
    expect(committed).toBe(false);
  });

  it('a flick finishes from a short distance', async () => {
    const { onEnd, swipe } = setup();
    await swipe([10, 300], [[25, 300], [40, 300], [55, 300], [70, 300]], 10);
    const [committed, details] = onEnd.mock.calls[0];
    expect(committed).toBe(true);
    expect(details.velocity).toBeGreaterThan(1);
  });

  it("a swipe heading back when it's let go doesn't finish", async () => {
    const { onEnd, swipe } = setup();
    await swipe([10, 300], [[100, 300], [160, 300], [150, 300], [140, 300], [130, 300]], 10);
    const [committed, details] = onEnd.mock.calls[0];
    expect(committed).toBe(false);
    expect(details.velocity).toBeLessThan(0);
  });

  it('threshold sets how far a slow swipe has to go', async () => {
    const { onEnd, swipe } = setup({ threshold: 0.2 });
    await swipe([10, 300], [[40, 300], [70, 300], [75, 300], [75, 300]]);
    expect(onEnd).toHaveBeenCalledWith(true, expect.anything());
  });

  it('reports how far across the element the pointer is, from 0 to 1', async () => {
    const { el, onMove } = setup();
    el.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    document.dispatchEvent(pointer('pointermove', 40, 300));
    expect(onMove).toHaveBeenLastCalledWith(0.1, expect.anything());
    document.dispatchEvent(pointer('pointermove', 160, 300));
    await frame();
    expect(onMove).toHaveBeenLastCalledWith(0.5, expect.anything());
    document.dispatchEvent(pointer('pointermove', 900, 300));
    await frame();
    expect(onMove).toHaveBeenLastCalledWith(1, expect.anything());
    document.dispatchEvent(pointer('pointerup', 900, 300));
  });

  it('a swipe the browser takes over ends unfinished', () => {
    const { el, onEnd } = setup();
    el.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    document.dispatchEvent(pointer('pointermove', 200, 300));
    document.dispatchEvent(pointer('pointercancel', 200, 300));
    expect(onEnd).toHaveBeenCalledWith(false, expect.objectContaining({ velocity: 0 }));
  });

  it('the cleanup ends a swipe under way as unfinished, and stops listening', () => {
    const { el, onStart, onEnd } = setup();
    el.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    document.dispatchEvent(pointer('pointermove', 200, 300));
    cleanups.splice(0).forEach((cleanup) => cleanup());
    expect(onEnd).toHaveBeenCalledWith(false, expect.anything());
    el.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    document.dispatchEvent(pointer('pointermove', 200, 300));
    expect(onStart).toHaveBeenCalledOnce();
  });
});

describe('bindEdgeSwipe: where a swipe can start, and axis lock', () => {
  it('a press outside the strip along the edge never starts a swipe', async () => {
    const { onStart, onEnd, swipe } = setup();
    await swipe([40, 300], [[120, 300], [200, 300]]);
    expect(onStart).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('size widens the strip a swipe starts in', async () => {
    const { onStart, swipe } = setup({ size: Infinity });
    await swipe([200, 300], [[240, 300], [280, 300]]);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('a press that moves along the edge first stays a scroll, for the whole gesture', async () => {
    const { onStart, onMove, onEnd, swipe } = setup();
    await swipe([10, 300], [[12, 330], [60, 400], [200, 420]]);
    expect(onStart).not.toHaveBeenCalled();
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('a move toward the edge goes nowhere', async () => {
    const { el, onStart } = setup({ side: 'end' });
    // From the right edge, a move further right.
    el.dispatchEvent(pointer('pointerdown', 290, 300, 0));
    document.dispatchEvent(pointer('pointermove', 300, 300));
    document.dispatchEvent(pointer('pointerup', 300, 300));
    expect(onStart).not.toHaveBeenCalled();
  });

  it('a press that lifts without moving stays a click', () => {
    const { el, onStart } = setup();
    const clicked = vi.fn();
    el.addEventListener('click', clicked);
    el.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    document.dispatchEvent(pointer('pointerup', 10, 300));
    el.click();
    expect(onStart).not.toHaveBeenCalled();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it("a finished swipe doesn't click what it ends on", async () => {
    const { el, swipe } = setup();
    const clicked = vi.fn();
    el.addEventListener('click', clicked);
    await swipe([10, 300], [[60, 300], [120, 300], [130, 300]]);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicked).not.toHaveBeenCalled();
  });

  it('onStart refuses a swipe by returning false', async () => {
    const { onMove, onEnd, swipe } = setup({ onStart: () => false });
    await swipe([10, 300], [[60, 300], [200, 300]]);
    expect(onMove).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('the start edge is the right one in right-to-left text, and the swipe moves left', async () => {
    const { onStart, onEnd, swipe } = setup({}, 'rtl');
    await swipe([10, 300], [[60, 300], [200, 300]]);
    expect(onStart).not.toHaveBeenCalled();
    await swipe([290, 300], [[250, 300], [200, 300], [170, 300], [165, 300], [165, 300]]);
    expect(onEnd).toHaveBeenCalledWith(true, expect.anything());
  });

  it('side picks another edge, like the top, where a swipe moves down', async () => {
    const { onStart, onEnd, swipe } = setup({ side: 'top' });
    await swipe([150, 10], [[200, 12], [280, 14]]);
    expect(onStart).not.toHaveBeenCalled();
    await swipe([150, 10], [[150, 100], [150, 200], [150, 240], [150, 245], [150, 245]]);
    expect(onEnd).toHaveBeenCalledWith(true, expect.anything());
  });
});

describe('bindEdgeSwipe: nested', () => {
  it('the innermost binding that accepts takes the press, and the one around it never starts', async () => {
    const outer = setup();
    const inner = setup({}, 'ltr', outer.el);
    await inner.swipe([10, 300], [[60, 300], [120, 300], [130, 300], [130, 300]]);
    expect(inner.onEnd).toHaveBeenCalledWith(true, expect.anything());
    expect(outer.onStart).not.toHaveBeenCalled();
    expect(outer.onEnd).not.toHaveBeenCalled();
  });

  it('when the inner one refuses, the one around it takes the press', async () => {
    const outer = setup();
    const inner = setup({ onStart: () => false }, 'ltr', outer.el);
    await inner.swipe([10, 300], [[60, 300], [120, 300], [130, 300], [130, 300]]);
    expect(inner.onEnd).not.toHaveBeenCalled();
    expect(outer.onEnd).toHaveBeenCalledWith(true, expect.anything());
  });
});

describe('bindEdgeSwipe: two copies of the library', () => {
  it('nest like one: a press the inner copy takes is left alone by the outer one', async () => {
    vi.resetModules();
    const other = await import('@/lib/edge-swipe');
    expect(other.bindEdgeSwipe).not.toBe(bindEdgeSwipe);
    const outer = setup();
    const inner = document.createElement('div');
    inner.getBoundingClientRect = () => new DOMRect(0, 0, 300, 600);
    outer.el.append(inner);
    const onEnd = vi.fn();
    cleanups.push(other.bindEdgeSwipe(inner, { onEnd }));
    inner.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    for (const x of [60, 120, 130, 130]) {
      document.dispatchEvent(pointer('pointermove', x, 300));
      await frame();
    }
    document.dispatchEvent(pointer('pointerup', 130, 300));
    expect(onEnd).toHaveBeenCalledWith(true, expect.anything());
    expect(outer.onStart).not.toHaveBeenCalled();
  });
});

describe('bindEdgeSwipe: a finger over a scroller inside', () => {
  const touchmove = (target: HTMLElement) => {
    const event = new Event('touchmove', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it('holds off the browser pan once the swipe is under way, and only for that touch', async () => {
    const { el } = setup();
    const content = document.createElement('div');
    el.append(content);
    content.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    document.dispatchEvent(pointer('pointermove', 12, 300));
    expect(touchmove(content).defaultPrevented).toBe(false); // inside the slop: still the browser's
    document.dispatchEvent(pointer('pointermove', 60, 300));
    expect(touchmove(content).defaultPrevented).toBe(true);
    document.dispatchEvent(pointer('pointerup', 60, 300));
    el.dispatchEvent(new Event('touchend', { bubbles: true }));
    expect(touchmove(content).defaultPrevented).toBe(false);
  });

  it('leaves a vertical drag in the edge strip to the browser', async () => {
    const { el } = setup();
    el.dispatchEvent(pointer('pointerdown', 10, 300, 0));
    document.dispatchEvent(pointer('pointermove', 12, 340));
    expect(touchmove(el).defaultPrevented).toBe(false);
  });
});
