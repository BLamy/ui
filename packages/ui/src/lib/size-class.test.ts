// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindSizeClass, sizeClassOf } from '@/lib/size-class';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

/* happy-dom has no layout: each element gets the width a test gives it, and a resize tells whoever watches it. */
const watchers = new Map<Element, () => void>();
function resize(el: HTMLElement, width: number) {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  watchers.get(el)?.();
}
const original = window.ResizeObserver;
beforeEach(() => {
  window.ResizeObserver = class {
    #watched: Element[] = [];
    #changed: () => void;
    constructor(changed: () => void) {
      this.#changed = changed;
    }
    observe(el: Element) {
      this.#watched.push(el);
      watchers.set(el, this.#changed);
    }
    disconnect() {
      this.#watched.forEach((el) => watchers.delete(el));
    }
  } as unknown as typeof ResizeObserver;
});
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  window.ResizeObserver = original;
  watchers.clear();
  document.body.replaceChildren();
});

function frame(width: number) {
  const el = document.body.appendChild(document.createElement('div'));
  resize(el, width);
  return el;
}

describe('sizeClassOf', () => {
  it('is compact below 640, medium from there and regular from 1024', () => {
    expect([0, 639, 640, 1023, 1024, 2560].map((width) => sizeClassOf(width))).toEqual([
      'compact', 'compact', 'medium', 'medium', 'regular', 'regular',
    ]);
  });
  it('starts each class where its breakpoint says, and keeps the other default', () => {
    expect(sizeClassOf(500, { medium: 480 })).toBe('medium');
    expect(sizeClassOf(900, { medium: 480 })).toBe('medium');
    expect(sizeClassOf(900, { regular: 900 })).toBe('regular');
    expect(sizeClassOf(600, { regular: 900 })).toBe('compact');
  });
});

describe('bindSizeClass', () => {
  it("writes the element's size class, and reports it at the start", () => {
    const el = frame(390);
    const onChange = vi.fn();
    cleanups.push(bindSizeClass(el, { onChange }));
    expect(el.getAttribute('data-size-class')).toBe('compact');
    expect(onChange.mock.calls).toEqual([['compact']]);
  });

  it("follows the element's width, and reports only a new class", () => {
    const el = frame(390);
    const onChange = vi.fn();
    cleanups.push(bindSizeClass(el, { onChange }));
    resize(el, 500);
    expect(onChange).toHaveBeenCalledTimes(1);
    resize(el, 800);
    expect(el.getAttribute('data-size-class')).toBe('medium');
    resize(el, 1280);
    expect(el.getAttribute('data-size-class')).toBe('regular');
    expect(onChange.mock.calls).toEqual([['compact'], ['medium'], ['regular']]);
  });

  it('measures against its own breakpoints', () => {
    const el = frame(500);
    cleanups.push(bindSizeClass(el, { breakpoints: { medium: 480, regular: 900 } }));
    expect(el.getAttribute('data-size-class')).toBe('medium');
    resize(el, 900);
    expect(el.getAttribute('data-size-class')).toBe('regular');
  });

  it('its cleanup stops following and removes the attribute it wrote', () => {
    const el = frame(390);
    const onChange = vi.fn();
    const stop = bindSizeClass(el, { onChange });
    stop();
    expect(el.hasAttribute('data-size-class')).toBe(false);
    expect(watchers.has(el)).toBe(false);
    resize(el, 1280);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("doesn't name a box with no width (not rendered), and names it once it has one", () => {
    const el = frame(0);
    const onChange = vi.fn();
    cleanups.push(bindSizeClass(el, { onChange }));
    expect(el.hasAttribute('data-size-class')).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
    resize(el, 1280);
    expect(onChange.mock.calls).toEqual([['regular']]);
    // Hidden again: it keeps the class it had.
    resize(el, 0);
    expect(el.getAttribute('data-size-class')).toBe('regular');
  });

  it('puts back a value rendered in the markup, which the markup owns', () => {
    const el = frame(390);
    el.setAttribute('data-size-class', 'regular');
    const stop = bindSizeClass(el);
    expect(el.getAttribute('data-size-class')).toBe('compact');
    stop();
    expect(el.getAttribute('data-size-class')).toBe('regular');
  });
});
