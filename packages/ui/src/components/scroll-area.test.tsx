// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  ScrollArea, ScrollAreaContent, ScrollAreaScrollbar, ScrollAreaScrollToEnd, ScrollAreaViewport,
  createScrollAreaController,
} from '@/components/ui/scroll-area';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

const sizes = { scrollHeight: 0, clientHeight: 0, scrollWidth: 0, clientWidth: 0 };
/** happy-dom lays nothing out, so the viewport's sizes are given: a 100px box over 500px of content. */
function overflowing() {
  for (const name of Object.keys(sizes) as (keyof typeof sizes)[]) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement) { return this.dataset.slot === 'scroll-area-viewport' ? sizes[name] : 0; },
    });
  }
  Object.assign(sizes, { scrollHeight: 500, clientHeight: 100, scrollWidth: 200, clientWidth: 200 });
}

afterEach(() => {
  cleanup();
  for (const name of Object.keys(sizes)) delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const slot = (name: string) => document.querySelector(`[data-slot=${name}]`) as HTMLElement;

describe('ScrollArea', () => {
  it('is a root around a native scroller in the kit look, scrolling one axis by default', async () => {
    render(
      <ScrollArea className="h-64">
        <ScrollAreaViewport role="region" aria-label="Releases">
          <ScrollAreaContent>v1.0</ScrollAreaContent>
        </ScrollAreaViewport>
      </ScrollArea>,
    );
    await settle();
    const root = slot('scroll-area');
    expect(root.className).toContain('h-64');
    expect(root.getAttribute('data-orientation')).toBe('vertical');
    const viewport = screen.getByRole('region', { name: 'Releases' });
    expect(viewport).toBe(slot('scroll-area-viewport'));
    expect(viewport.className).toContain('bl-scroll');
    expect(viewport.className).toContain('overflow-x-hidden!');
    expect(slot('scroll-area-content').textContent).toBe('v1.0');
    // Nothing overflows, so it adds no tab stop.
    expect(viewport.hasAttribute('tabindex')).toBe(false);
  });

  it('orientation picks the axes', async () => {
    const { rerender } = render(
      <ScrollArea orientation="horizontal"><ScrollAreaViewport aria-label="Tags" /></ScrollArea>,
    );
    await settle();
    expect(slot('scroll-area-viewport').className).toContain('overflow-y-hidden!');
    expect(slot('scroll-area').getAttribute('data-orientation')).toBe('horizontal');
    rerender(<ScrollArea orientation="both"><ScrollAreaViewport aria-label="Tags" /></ScrollArea>);
    expect(slot('scroll-area-viewport').className).not.toContain('hidden!');
  });

  it('a viewport that scrolls is a tab stop, unless something inside it takes focus', async () => {
    overflowing();
    const { rerender } = render(
      <ScrollArea className="h-24">
        <ScrollAreaViewport aria-label="Notes"><ScrollAreaContent>Long text</ScrollAreaContent></ScrollAreaViewport>
      </ScrollArea>,
    );
    await settle();
    expect(slot('scroll-area').hasAttribute('data-overflow-y')).toBe(true);
    expect(slot('scroll-area').hasAttribute('data-at-start')).toBe(true);
    expect(slot('scroll-area-viewport').getAttribute('tabindex')).toBe('0');
    rerender(
      <ScrollArea className="h-24">
        <ScrollAreaViewport aria-label="Notes"><ScrollAreaContent><a href="#more">More</a></ScrollAreaContent></ScrollAreaViewport>
      </ScrollArea>,
    );
    await settle();
    expect(slot('scroll-area-viewport').getAttribute('tabindex')).not.toBe('0');
  });

  it('a scrollbar part brings its thumb and stays out of the accessibility tree', async () => {
    overflowing();
    render(
      <ScrollArea className="h-24">
        <ScrollAreaViewport aria-label="Notes"><ScrollAreaContent>Long text</ScrollAreaContent></ScrollAreaViewport>
        <ScrollAreaScrollbar />
      </ScrollArea>,
    );
    await settle();
    const bar = slot('scroll-area-scrollbar');
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(bar.getAttribute('data-orientation')).toBe('vertical');
    expect(bar.querySelector('[data-slot=scroll-area-thumb]')).toBeTruthy();
  });

  it('stickToEnd follows the end, with a named button back to it and a controller to ask', async () => {
    overflowing();
    const controller = createScrollAreaController();
    render(
      <ScrollArea className="h-24" stickToEnd controller={controller}>
        <ScrollAreaViewport role="log" aria-label="Build output"><ScrollAreaContent>line</ScrollAreaContent></ScrollAreaViewport>
        <ScrollAreaScrollToEnd>Jump to latest</ScrollAreaScrollToEnd>
      </ScrollArea>,
    );
    await settle();
    expect(slot('scroll-area').hasAttribute('data-sticking')).toBe(true);
    expect(controller.isSticking()).toBe(true);
    const jump = slot('scroll-area-scroll-to-end');
    expect(jump.tagName).toBe('BUTTON');
    expect(jump.textContent).toBe('Jump to latest');
    // It wears the kit's secondary button, and steps aside while the view is at the end.
    expect(jump.className).toContain('bg-secondary');
    expect(jump.hasAttribute('data-visible')).toBe(false);
    expect(jump.hasAttribute('inert')).toBe(true);
  });
});
