// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { Waveform } from '@/components/ui/waveform';
import { AppearanceProvider } from '@/lib/theme';

/* happy-dom draws nothing: a fake 2D context records the colour each draw used, and the canvas's computed colour
   follows the appearance (`dark` on the nearest scope, or on <html>). */
const fills: string[] = [];
const getContext = HTMLCanvasElement.prototype.getContext;
const computed = globalThis.getComputedStyle;
beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  HTMLCanvasElement.prototype.getContext = function () {
    const ctx = { fillStyle: '', clearRect: () => {}, fillRect: () => { fills.push(ctx.fillStyle); } };
    return ctx as never;
  } as never;
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation((el: Element) => {
    if (el.tagName !== 'CANVAS') return computed(el);
    const dark = !!el.closest('.dark') || document.documentElement.classList.contains('dark');
    return { color: dark ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)' } as CSSStyleDeclaration;
  });
});
afterAll(() => {
  HTMLCanvasElement.prototype.getContext = getContext;
  vi.restoreAllMocks();
});
afterEach(() => {
  cleanup();
  fills.length = 0;
  document.documentElement.classList.remove('dark');
});

const peaks = [0.2, 0.8, 0.5, 1];
const last = () => fills[fills.length - 1];

describe('Waveform', () => {
  it('is decorative', () => {
    const { container } = render(<Waveform peaks={peaks} rate={4} />);
    expect(container.querySelector('[data-slot="waveform"]')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws again in the new colour when the appearance changes', () => {
    const { rerender } = render(<AppearanceProvider value="light"><div><Waveform peaks={peaks} rate={4} /></div></AppearanceProvider>);
    expect(last()).toBe('rgb(0, 0, 0)');
    rerender(<AppearanceProvider value="dark"><div className="dark"><Waveform peaks={peaks} rate={4} /></div></AppearanceProvider>);
    expect(last()).toBe('rgb(255, 255, 255)');
  });

  it('without a provider, follows the theme on <html>', async () => {
    render(<Waveform peaks={peaks} rate={4} />);
    expect(last()).toBe('rgb(0, 0, 0)');
    fills.length = 0;
    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'sepia');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(fills.length).toBeGreaterThan(0);
    document.documentElement.removeAttribute('data-theme');
    await act(async () => {
      document.documentElement.classList.add('dark');
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(last()).toBe('rgb(255, 255, 255)');
  });
});
