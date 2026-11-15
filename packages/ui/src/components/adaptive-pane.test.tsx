// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  AdaptivePane, AdaptivePaneClose, AdaptivePaneHeader, AdaptivePaneTitle, AdaptivePaneTrigger, adaptivePanePageClass,
  createAdaptivePaneController, type AdaptivePanePresentation,
} from '@/components/ui/adaptive-pane';
import { SizeClassProvider, type SizeClass } from '@/lib/container';

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
    const { container } = render(<div><AdaptivePane presentation="column" open columnWidth={200} resizable minWidth={150} maxWidth={260}>x</AdaptivePane></div>);
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
    const { container } = render(<div><AdaptivePane presentation="column" open columnWidth={200} resizable><Child /></AdaptivePane></div>);
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
    render(<AdaptivePane presentation="column" open columnWidth={200}>x</AdaptivePane>);
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('resizes a column with the keyboard, clamps, and resets', () => {
    const onWidthsChange = vi.fn();
    const { container } = render(
      <div><AdaptivePane presentation="column" open columnWidth={200} resizable minWidth={150} maxWidth={260} onWidthsChange={onWidthsChange}>x</AdaptivePane></div>,
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

  it('widens an end pane with the left arrow', () => {
    const onWidthsChange = vi.fn();
    const { container } = render(
      <div><AdaptivePane presentation="column" open side="end" columnWidth={200} resizable onWidthsChange={onWidthsChange}>x</AdaptivePane></div>,
    );
    wide(container.firstElementChild!);
    container.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!.getBoundingClientRect = () => rect(200);
    act(() => { fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft', shiftKey: true }); });
    expect(onWidthsChange).toHaveBeenLastCalledWith({ column: 248 }, expect.anything());
  });

  it('right to left, a start pane is on the right: its separator sits on the inline end and the left arrow widens it', () => {
    const onWidthsChange = vi.fn();
    const { container } = render(
      <div style={{ direction: 'rtl' }}><AdaptivePane presentation="column" open columnWidth={200} resizable onWidthsChange={onWidthsChange}>x</AdaptivePane></div>,
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
      <div><AdaptivePane presentation="column" open columnWidth={200} resizable onWidthsChange={(_w, details) => details.cancel()}>x</AdaptivePane></div>,
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

describe('AdaptivePane auto', () => {
  function Scoped({ sizeClass, side = 'end' as const }: { sizeClass: SizeClass; side?: 'start' | 'end' }) {
    return (
      <SizeClassProvider value={sizeClass}>
        <div><AdaptivePane side={side} open aria-label="Activity">x</AdaptivePane></div>
      </SizeClassProvider>
    );
  }
  const shown = () => document.querySelector('[data-slot=adaptive-pane]')!.getAttribute('data-presentation');

  it('is a column in a regular scope and a drawer in a medium one', () => {
    const { rerender } = render(<Scoped sizeClass="regular" />);
    expect(shown()).toBe('column');
    rerender(<Scoped sizeClass="medium" />);
    expect(shown()).toBe('drawer');
  });

  it('in a compact scope, an end pane is pushed and a start pane is a drawer', () => {
    const { rerender } = render(<Scoped sizeClass="compact" />);
    expect(shown()).toBe('push');
    rerender(<Scoped sizeClass="compact" side="start" />);
    expect(shown()).toBe('drawer');
  });

  it('outside every scope is a column', () => {
    render(<div><AdaptivePane open>x</AdaptivePane></div>);
    expect(shown()).toBe('column');
  });
});

describe('AdaptivePane header parts', () => {
  function Pane({ presentation, onOpenChange, open = true }: { presentation: AdaptivePanePresentation; onOpenChange?: (open: boolean, details: { reason: string }) => void; open?: boolean }) {
    return (
      <div>
        <AdaptivePane side="end" presentation={presentation} open={open} onOpenChange={onOpenChange}>
          <AdaptivePaneHeader>
            <AdaptivePaneTitle>Activity</AdaptivePaneTitle>
            <AdaptivePaneClose backLabel="Inbox" />
          </AdaptivePaneHeader>
          <p>body</p>
        </AdaptivePane>
      </div>
    );
  }

  it('names the drawer by its title, and its × says what it closes', () => {
    const onOpenChange = vi.fn();
    render(<Pane presentation="drawer" onOpenChange={onOpenChange} />);
    const dialog = screen.getByRole('dialog', { name: 'Activity' });
    expect(dialog.getAttribute('data-variant')).toBe('panel');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Close Activity' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
  });

  it('closes a column from its ×, and a closed column is out of sight and of the tree', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Pane presentation="column" onOpenChange={onOpenChange} />);
    const root = document.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!;
    expect(root.hasAttribute('hidden')).toBe(false);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Close Activity' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
    rerender(<Pane presentation="column" open={false} onOpenChange={onOpenChange} />);
    expect(root.hasAttribute('hidden')).toBe(true);
    // The kit ships no preflight: the display class must not beat the `hidden` attribute.
    expect(root.className.split(' ')).toContain('hidden');
    expect(root.hasAttribute('data-closed')).toBe(true);
  });

  it('in a push, the header is the bar: the back button leads, named by where it goes', () => {
    render(<Pane presentation="push" />);
    const header = document.querySelector('[data-slot=adaptive-pane-header]')!;
    expect(header.getAttribute('data-presentation')).toBe('push');
    // NavigationStack's back button (lib/nav-bar): named "Back to" where it goes, first in the bar, over barSurface.
    const back = screen.getByRole('button', { name: 'Back to Inbox' });
    expect(header.querySelector('button')).toBe(back);
    expect(header.querySelector('[data-side=top]')?.className).toContain('bg-bar');
    expect(screen.getByRole('region', { name: 'Activity' })).toBeTruthy();
  });

  it('takes className on the pane box in every presentation, and a function of its state', () => {
    const cls = ({ presentation }: { presentation: string }) => `pane-${presentation}`;
    const { rerender } = render(<div><AdaptivePane presentation="column" open className={cls}>x</AdaptivePane></div>);
    expect(document.querySelector('[data-slot=adaptive-pane]')!.className).toContain('pane-column');
    rerender(<div><AdaptivePane presentation="drawer" open aria-label="Pane" className={cls}>x</AdaptivePane></div>);
    expect(screen.getByRole('dialog', { name: 'Pane' }).className).toContain('pane-drawer');
    rerender(<div><AdaptivePane presentation="push" open aria-label="Pane" className={cls}>x</AdaptivePane></div>);
    expect(screen.getByRole('region', { name: 'Pane' }).className).toContain('pane-push');
  });
});

/* ── The push (a pane pushed over a compact host, NavigationStack-style) ── */

function Comment() {
  const [text, setText] = useState('');
  return <input aria-label="Comment" value={text} onChange={(e) => setText(e.target.value)} />;
}

function Host({ presentation = 'auto', onOpenChange, open = true, sizeClass = 'compact' }: {
  presentation?: AdaptivePanePresentation | 'auto'; onOpenChange?: (open: boolean, details: { reason: string; cancel: () => void }) => void; open?: boolean; sizeClass?: SizeClass;
}) {
  return (
    <SizeClassProvider value={sizeClass}>
      <div data-testid="host">
        <main className={adaptivePanePageClass}>Page <button type="button">Under</button></main>
        <AdaptivePane side="end" presentation={presentation} open={open} onOpenChange={onOpenChange}>
          <AdaptivePaneHeader>
            <AdaptivePaneTitle>Activity</AdaptivePaneTitle>
            <AdaptivePaneClose backLabel="Inbox" />
          </AdaptivePaneHeader>
          <Comment />
        </AdaptivePane>
      </div>
    </SizeClassProvider>
  );
}

/* Touch events a set time apart, so a swipe's speed is known. */
function touch(type: string, x: number, y: number, ms = 50) {
  time += ms;
  const event = new PointerEvent(type, {
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
    bubbles: true, cancelable: true, clientX: x, clientY: y,
  });
  Object.defineProperty(event, 'timeStamp', { value: time });
  return event;
}

const paneRoot = () => document.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!;

describe('AdaptivePane push', () => {
  it('closing a push gives focus back to what opened it', async () => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <main className={adaptivePanePageClass}><button type="button" onClick={() => setOpen(true)}>Open activity</button></main>
          <AdaptivePane side="end" presentation="push" open={open} onOpenChange={setOpen}>
            <AdaptivePaneHeader><AdaptivePaneTitle>Activity</AdaptivePaneTitle><AdaptivePaneClose backLabel="Inbox" /></AdaptivePaneHeader>
            <Comment />
          </AdaptivePane>
        </div>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'Open activity' });
    opener.focus();
    act(() => { fireEvent.click(opener); });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    expect(screen.getByRole('region', { name: 'Activity' }).contains(document.activeElement)).toBe(true);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Back to Inbox' })); });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    expect(document.activeElement).toBe(opener);
  });

  it('pushes over a compact host, covers and inerts the page under it, and pops from its back button', () => {
    const onOpenChange = vi.fn();
    render(<Host onOpenChange={onOpenChange} />);
    expect(paneRoot().getAttribute('data-presentation')).toBe('push');
    const host = screen.getByTestId('host');
    // The page under is covered: one variable on the host, and the page leaves the tab order and the tree.
    expect(host.style.getPropertyValue('--adaptive-pane-under')).toBe('1');
    const main = screen.getByRole('main', { hidden: true });
    expect(main.getAttribute('style')).toBeNull();
    expect(main.hasAttribute('inert')).toBe(true);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Back to Inbox' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
  });

  it('gives the page back when the push closes', () => {
    const { rerender } = render(<Host />);
    const main = screen.getByRole('main', { hidden: true });
    expect(main.hasAttribute('inert')).toBe(true);
    rerender(<Host open={false} />);
    expect(main.hasAttribute('inert')).toBe(false);
    expect(screen.getByTestId('host').style.getPropertyValue('--adaptive-pane-under')).toBe('');
  });

  it('pops from a swipe off its leading edge, scrubbing the page under it, and settles on one spring', async () => {
    const atRelease: boolean[] = [];
    const onOpenChange = vi.fn<(open: boolean, details: unknown) => void>(() => {
      atRelease.push(screen.getByTestId('host').hasAttribute('data-adaptive-pane-settling'), paneRoot().hasAttribute('data-swipe-settling'));
    });
    function Controlled() {
      const [open, setOpen] = useState(true);
      return <Host open={open} onOpenChange={(next, details) => { onOpenChange(next, details); setOpen(next); }} />;
    }
    render(<Controlled />);
    const host = screen.getByTestId('host');
    const panel = screen.getByRole('region', { name: 'Activity' });
    panel.getBoundingClientRect = () => new DOMRect(0, 0, 390, 600);
    await act(async () => {
      panel.dispatchEvent(touch('pointerdown', 10, 300, 0));
      for (const x of [40, 120, 200]) {
        document.dispatchEvent(touch('pointermove', x, 300));
        await frame();
      }
    });
    expect(panel.hasAttribute('data-swiping')).toBe(true);
    expect(paneRoot().hasAttribute('data-swiping')).toBe(true);
    expect(host.hasAttribute('data-adaptive-pane-swiping')).toBe(true);
    const under = Number(host.style.getPropertyValue('--adaptive-pane-under'));
    expect(under).toBeGreaterThan(0);
    expect(under).toBeLessThan(1);
    await act(async () => {
      document.dispatchEvent(touch('pointermove', 260, 300));
      document.dispatchEvent(touch('pointerup', 260, 300));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'swipe' }));
    expect(host.hasAttribute('data-adaptive-pane-swiping')).toBe(false);
    expect(atRelease).toEqual([true, true]);
    expect(host.style.getPropertyValue('--adaptive-pane-under')).toBe('');
    await act(async () => { await frame(); await frame(); });
    expect(host.hasAttribute('data-adaptive-pane-settling')).toBe(false);
  });

  it('a refused swipe springs back and covers the page again', async () => {
    const onOpenChange = vi.fn((_open: boolean, details: { cancel?: () => void }) => details.cancel?.());
    render(<Host onOpenChange={onOpenChange} />);
    const host = screen.getByTestId('host');
    const panel = screen.getByRole('region', { name: 'Activity' });
    panel.getBoundingClientRect = () => new DOMRect(0, 0, 390, 600);
    await act(async () => {
      panel.dispatchEvent(touch('pointerdown', 10, 300, 0));
      for (const x of [40, 160, 260]) {
        document.dispatchEvent(touch('pointermove', x, 300));
        await frame();
      }
      document.dispatchEvent(touch('pointerup', 260, 300));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'swipe' }));
    expect(paneRoot().getAttribute('data-presentation')).toBe('push');
    expect(host.style.getPropertyValue('--adaptive-pane-under')).toBe('1');
  });

  it('right to left, the push swipes from the right edge and moves the way the finger goes', async () => {
    const onOpenChange = vi.fn();
    render(<div dir="rtl" style={{ direction: 'rtl' }}><Host onOpenChange={onOpenChange} /></div>);
    const panel = screen.getByRole('region', { name: 'Activity' });
    panel.getBoundingClientRect = () => new DOMRect(0, 0, 390, 600);
    expect(panel.className).toContain('rtl:[--stack-dir:-1]');
    expect(panel.className).toContain('data-swiping:translate-x-[calc(var(--stack-progress)*100%*var(--stack-dir,1))]');
    expect(panel.className).toContain('data-starting-style:translate-x-[calc(103%*var(--stack-dir,1))]');
    expect(adaptivePanePageClass).toContain('rtl:[--stack-dir:-1]');
    await act(async () => {
      panel.dispatchEvent(touch('pointerdown', 380, 300, 0));
      for (const x of [340, 260, 180]) {
        document.dispatchEvent(touch('pointermove', x, 300));
        await frame();
      }
    });
    expect(panel.hasAttribute('data-swiping')).toBe(true);
    expect(Number(panel.style.getPropertyValue('--stack-progress'))).toBeGreaterThan(0.4);
    await act(async () => {
      document.dispatchEvent(touch('pointerup', 120, 300));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'swipe' }));
  });

  it('keeps its children mounted from drawer to push to column', () => {
    const { rerender } = render(<Host presentation="drawer" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Comment' });
    fireEvent.change(input, { target: { value: 'kept' } });
    rerender(<Host presentation="push" />);
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBe(input);
    rerender(<Host presentation="column" />);
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBe(input);
    expect(input.value).toBe('kept');
  });
});

describe('AdaptivePaneTrigger', () => {
  // A drag that ended above (the resize tests) leaves UI SDK's one-shot "swallow the click after a drag" listener
  // armed, as a real pointerup is always followed by a click: give it that click.
  beforeEach(() => { document.body.click(); });

  it('opens and closes the pane through its controller, saying whether it shows and what it controls', () => {
    const onOpenChange = vi.fn();
    const pane = createAdaptivePaneController();
    render(
      <div>
        <AdaptivePaneTrigger controller={pane}>Activity</AdaptivePaneTrigger>
        <AdaptivePane controller={pane} presentation="column" aria-label="Activity" onOpenChange={onOpenChange}>x</AdaptivePane>
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Activity' });
    const root = document.querySelector<HTMLElement>('[data-slot=adaptive-pane]')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(root.id);
    act(() => { fireEvent.click(trigger); });
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(root.hasAttribute('data-open')).toBe(true);
    act(() => { fireEvent.click(trigger); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('follows a controlled pane, and an onClick that prevents default keeps it as it is', () => {
    const pane = createAdaptivePaneController();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <AdaptivePaneTrigger controller={pane} onClick={(e) => { if (e.shiftKey) e.preventDefault(); }}>Pane</AdaptivePaneTrigger>
          <AdaptivePane controller={pane} presentation="column" aria-label="Side" open={open} onOpenChange={setOpen}>x</AdaptivePane>
        </div>
      );
    }
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Pane' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    act(() => { fireEvent.click(trigger, { shiftKey: true }); });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    act(() => { fireEvent.click(trigger); });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
