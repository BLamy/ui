// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Morph, MorphGroup } from '@/components/ui/morph';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const frame = () => act(() => new Promise((r) => setTimeout(r, 32)));

function setup(onDismiss = vi.fn()) {
  const { container } = render(
    <MorphGroup>
      <Morph id="p" dragToDismiss onDismiss={onDismiss} aria-label="Player">full</Morph>
    </MorphGroup>,
  );
  return { el: container.querySelector<HTMLElement>('[data-slot=morph]')!, onDismiss };
}

describe('Morph drag to dismiss', () => {
  it('follows a downward drag and dismisses past the distance', async () => {
    const { el, onDismiss } = setup();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 60 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 210 });
    await frame();
    expect(el.hasAttribute('data-dragging')).toBe(true);
    expect(el.style.getPropertyValue('--morph-drag-y')).toBe('180px');
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 210 });
    await frame();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(el.hasAttribute('data-dragging')).toBe(false);
    expect(el.style.getPropertyValue('--morph-drag-y')).toBe('');
  });

  it('springs back from a short slow drag and ignores a sideways one', async () => {
    const { el, onDismiss } = setup();
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 60, clientY: 12 });
    await frame();
    expect(el.hasAttribute('data-dragging')).toBe(false);
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 60, clientY: 12 });
    await frame();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismisses a short downward flick by its release speed', async () => {
    const { el, onDismiss } = setup();
    // A flick is distance over time, so the test owns the clock: 10ms between samples however slowly the
    // machine runs them (an event's timeStamp is read from the clock when it is made).
    let now = performance.now();
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const at = (ms: number) => { now += ms; };
    try {
      at(10); fireEvent.pointerDown(el, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
      at(10); fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 30 });
      at(10); fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 50 });
      at(10); fireEvent.pointerMove(document, { pointerId: 1, clientX: 10, clientY: 70 });
      at(2); fireEvent.pointerUp(document, { pointerId: 1, clientX: 10, clientY: 70 });
    } finally {
      clock.mockRestore();
    }
    await frame();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Morph render', () => {
  it('renders the element it is given, with its props under Morph\'s and classes merged', () => {
    const onClick = vi.fn();
    const { container } = render(
      <MorphGroup>
        <Morph id="card" className="ours" render={<button type="button" className="theirs" aria-label="Open card" />} onClick={onClick}>
          Card
        </Morph>
      </MorphGroup>,
    );
    const el = container.querySelector<HTMLElement>('[data-slot=morph]')!;
    expect(el.tagName).toBe('BUTTON');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.getAttribute('aria-label')).toBe('Open card');
    expect(el.getAttribute('data-morph-id')).toBe('card');
    expect(el.className).toContain('theirs');
    expect(el.className).toContain('ours');
    expect(el.textContent).toBe('Card');
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is a div by default and renders a list item from render={<li />}', () => {
    const { container } = render(
      <MorphGroup>
        <Morph id="a">A</Morph>
        <ul>
          <Morph id="b" render={<li />}>B</Morph>
        </ul>
      </MorphGroup>,
    );
    const [a, b] = container.querySelectorAll('[data-slot=morph]');
    expect(a.tagName).toBe('DIV');
    expect(b.tagName).toBe('LI');
  });
});
