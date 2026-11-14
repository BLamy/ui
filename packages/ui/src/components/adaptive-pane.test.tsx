// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdaptivePane } from '@/components/ui/adaptive-pane';

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
});
afterEach(cleanup);

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it; a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

/* Mouse events a set time apart, so a drag's speed is known. */
let time = 0;
function pointer(type: string, x: number, y = 300) {
  time += 30;
  const event = new PointerEvent(type, {
    pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    bubbles: true, cancelable: true, clientX: x, clientY: y,
  });
  Object.defineProperty(event, 'timeStamp', { value: time });
  return event;
}
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const rect = (w: number) => ({ width: w, left: 0, right: w, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

/** The host the pane sits in; happy-dom has no layout, so it is told how wide it is. */
const wide = (host: Element) => Object.defineProperty(host, 'clientWidth', { value: 800, configurable: true });

describe('AdaptivePane resizing', () => {
  it('is a tab stop with its value range', () => {
    const { container } = render(<div><AdaptivePane presentation="column" columnWidth={200} resizable minWidth={150} maxWidth={260}>x</AdaptivePane></div>);
    wide(container.firstElementChild!);
    const handle = screen.getByRole('separator', { name: 'Resize pane' });
    expect(handle.tabIndex).toBe(0);
    expect(handle.getAttribute('aria-valuemin')).toBe('150');
    expect(handle.getAttribute('aria-valuemax')).toBe('260');
  });

  it('follows a drag with the width variable alone, without re-rendering the children', async () => {
    let renders = 0;
    function Child() {
      renders += 1;
      return <p>body</p>;
    }
    const { container } = render(<div><AdaptivePane presentation="column" columnWidth={200} resizable><Child /></AdaptivePane></div>);
    wide(container.firstElementChild!);
    const pane = container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!;
    pane.getBoundingClientRect = () => rect(200);
    const handle = screen.getByRole('separator');
    const before = renders;
    await act(async () => {
      handle.dispatchEvent(pointer('pointerdown', 200));
      for (const x of [220, 240]) { document.dispatchEvent(pointer('pointermove', x)); await frame(); }
    });
    expect(pane.hasAttribute('data-dragging')).toBe(true);
    expect(pane.style.getPropertyValue('--adaptive-pane-w')).toBe('240px');
    await act(async () => { document.dispatchEvent(pointer('pointerup', 240)); });
    expect(pane.hasAttribute('data-dragging')).toBe(false);
    expect(renders).toBe(before);
  });

  it('has no separator unless resizable', () => {
    render(<AdaptivePane presentation="column" columnWidth={200}>x</AdaptivePane>);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('resizes a column with the keyboard, clamps, and resets', () => {
    const onWidthsChange = vi.fn();
    const { container } = render(
      <div><AdaptivePane presentation="column" columnWidth={200} resizable minWidth={150} maxWidth={260} onWidthsChange={onWidthsChange}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    const pane = container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!;
    pane.getBoundingClientRect = () => rect(200);
    const handle = screen.getByRole('separator', { name: 'Resize pane' });
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    act(() => { fireEvent.keyDown(handle, { key: 'ArrowRight' }); });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ column: 216 }, expect.objectContaining({ reason: 'resize-key' }));
    expect(pane.style.getPropertyValue('--adaptive-pane-w')).toBe('216px');
    pane.getBoundingClientRect = () => rect(216);
    act(() => { fireEvent.keyDown(handle, { key: 'End' }); });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ column: 260 }, expect.anything());
    pane.getBoundingClientRect = () => rect(260);
    act(() => { fireEvent.keyDown(handle, { key: 'Home' }); });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ column: 150 }, expect.anything());
    act(() => { fireEvent.keyDown(handle, { key: 'Enter' }); });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ column: undefined }, expect.objectContaining({ reason: 'size-reset' }));
    expect(pane.style.getPropertyValue('--adaptive-pane-w')).toBe('200px');
  });

  it('widens a right-hand pane with the left arrow', () => {
    const onWidthsChange = vi.fn();
    const { container } = render(
      <div><AdaptivePane presentation="column" side="right" columnWidth={200} resizable onWidthsChange={onWidthsChange}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!.getBoundingClientRect = () => rect(200);
    act(() => { fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft', shiftKey: true }); });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ column: 248 }, expect.anything());
  });

  it('right to left, a start pane is on the right: its separator sits on the inline end and the left arrow widens it', () => {
    const onWidthsChange = vi.fn();
    const { container } = render(
      <div style={{ direction: 'rtl' }}><AdaptivePane presentation="column" columnWidth={200} resizable onWidthsChange={onWidthsChange}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!.getBoundingClientRect = () => rect(200);
    const handle = screen.getByRole('separator');
    expect(handle.className).toContain('-end-[5px]');
    act(() => { fireEvent.keyDown(handle, { key: 'ArrowLeft' }); });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ column: 216 }, expect.anything());
  });

  it('a canceled change leaves the width alone', () => {
    const { container } = render(
      <div><AdaptivePane presentation="column" columnWidth={200} resizable onWidthsChange={(_w, details) => details.cancel()}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    const pane = container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!;
    pane.getBoundingClientRect = () => rect(200);
    act(() => { fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' }); });
    expect(pane.style.getPropertyValue('--adaptive-pane-w')).toBe('200px');
  });
});

describe('AdaptivePane presentations', () => {
  function Field() {
    const [text, setText] = useState('');
    return <input aria-label="Draft" value={text} onChange={(e) => setText(e.target.value)} />;
  }

  it('keeps its children mounted from column to drawer to hidden and back', () => {
    const { rerender } = render(<div><AdaptivePane presentation="column" open><Field /></AdaptivePane></div>);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Draft' });
    fireEvent.change(input, { target: { value: 'kept' } });
    rerender(<div><AdaptivePane presentation="drawer" open><Field /></AdaptivePane></div>);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Draft' })).toBe(input);
    expect(input.value).toBe('kept');
    rerender(<div><AdaptivePane presentation="hidden" open><Field /></AdaptivePane></div>);
    rerender(<div><AdaptivePane presentation="cover" open><Field /></AdaptivePane></div>);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Draft' })).toBe(input);
    expect(input.value).toBe('kept');
  });

  it('presents the drawer as a named dialog that Escape closes', () => {
    const onOpenChange = vi.fn();
    render(<div><AdaptivePane presentation="drawer" open aria-label="Navigation" onOpenChange={onOpenChange}><button>Inbox</button></AdaptivePane></div>);
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    act(() => { fireEvent.keyDown(dialog, { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  /** Drags the open drawer's panel most of the way to its (left) edge with a mouse. */
  async function dragClosed() {
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    dialog.getBoundingClientRect = () => new DOMRect(0, 0, 300, 600);
    await act(async () => { await frame(); await frame(); });
    await act(async () => {
      screen.getByText('body').dispatchEvent(pointer('pointerdown', 250));
      for (const x of [230, 180, 100, 20]) { document.dispatchEvent(pointer('pointermove', x)); await frame(); }
      document.dispatchEvent(pointer('pointerup', 20));
      await frame();
    });
    return dialog;
  }

  it('closes the drawer when its panel is dragged to its edge', async () => {
    const onOpenChange = vi.fn();
    render(<div><AdaptivePane presentation="drawer" open aria-label="Navigation" drawerWidth={300} onOpenChange={onOpenChange}><p>body</p></AdaptivePane></div>);
    await dragClosed();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'swipe' }));
  });

  it('with swipe={false}, a drag no longer closes it, while Escape still does', async () => {
    const onOpenChange = vi.fn();
    render(<div><AdaptivePane presentation="drawer" open aria-label="Navigation" drawerWidth={300} swipe={false} onOpenChange={onOpenChange}><p>body</p></AdaptivePane></div>);
    const dialog = await dragClosed();
    expect(dialog.hasAttribute('data-drawer-no-drag')).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
    act(() => { fireEvent.keyDown(dialog, { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  /** A closed drawer with `swipeToOpen` in a 390px host; returns the host and the open calls. */
  function closedPane(dir?: 'rtl') {
    const onOpenChange = vi.fn();
    render(
      <div data-testid="host" dir={dir} style={{ position: 'relative', width: 390, height: 600, direction: dir }}>
        <AdaptivePane presentation="drawer" open={false} swipeToOpen onOpenChange={onOpenChange}>x</AdaptivePane>
      </div>,
    );
    const host = screen.getByTestId('host');
    host.getBoundingClientRect = () => new DOMRect(0, 0, 390, 600);
    return { host, onOpenChange };
  }
  /** A press on the strip at `from`, moved through `xs` a slow 400ms apart, then let go. */
  async function swipe(from: number, xs: number[]) {
    const strip = document.querySelector<HTMLElement>('[data-slot=adaptive-pane-edge]')!;
    await act(async () => {
      strip.dispatchEvent(pointer('pointerdown', from));
      for (const x of xs) { time += 400; document.dispatchEvent(pointer('pointermove', x)); await frame(); }
      time += 400;
      document.dispatchEvent(pointer('pointerup', xs[xs.length - 1]));
    });
  }

  it('swipeToOpen: a short, slow swipe out of the strip leaves the drawer closed', async () => {
    const { onOpenChange } = closedPane();
    await swipe(2, [11, 14]);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('swipeToOpen: a swipe past a third of the host opens the drawer, with reason swipe', async () => {
    const { onOpenChange } = closedPane();
    await swipe(2, [40, 100, 160]);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'swipe' }));
  });

  it('right to left, the strip and the swipe are on the right edge (side defaults to start)', async () => {
    const { onOpenChange } = closedPane('rtl');
    const strip = document.querySelector<HTMLElement>('[data-slot=adaptive-pane-edge]')!;
    expect(strip.className).toContain('start-0');
    await swipe(386, [350, 290, 230]);
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'swipe' }));
  });

  it('right to left, a start pane opens from the right: the drawer content is on the right edge', async () => {
    // The page's direction: happy-dom has no top layer, so the drawer is portaled to the body.
    document.documentElement.style.direction = 'rtl';
    try {
      render(<div><AdaptivePane presentation="drawer" open aria-label="Navigation">x</AdaptivePane></div>);
      await act(async () => { await frame(); });
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expect(dialog.getAttribute('data-side')).toBe('right');
      expect(dialog.className).toContain('ml-auto');
    } finally {
      document.documentElement.style.direction = '';
    }
  });

  it('renders the edge strip only for a closed drawer that swipes open', () => {
    const { container, rerender } = render(<AdaptivePane presentation="drawer" open={false} swipeToOpen>x</AdaptivePane>);
    expect(container.querySelector('[data-slot=adaptive-pane-edge]')).not.toBeNull();
    rerender(<AdaptivePane presentation="drawer" open swipeToOpen>x</AdaptivePane>);
    expect(container.querySelector('[data-slot=adaptive-pane-edge]')).toBeNull();
    rerender(<AdaptivePane presentation="drawer" open={false} swipeToOpen={false}>x</AdaptivePane>);
    expect(container.querySelector('[data-slot=adaptive-pane-edge]')).toBeNull();
  });
});
