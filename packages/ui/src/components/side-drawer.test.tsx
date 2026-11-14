// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SideDrawer, sideDrawerPageClass, type SideDrawerPresentation } from '@/components/ui/side-drawer';

/** happy-dom has no layout: every element reports this width, which `bindSizeClass` reads. */
let width = 900;
beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => width });
});
afterEach(() => {
  cleanup();
  width = 900;
});

function Field() {
  const [text, setText] = useState('');
  return <input aria-label="Comment" value={text} onChange={(e) => setText(e.target.value)} />;
}

function Host({ presentation, onOpenChange, open = true }: { presentation?: SideDrawerPresentation; onOpenChange?: (open: boolean, details: { reason: string; cancel: () => void }) => void; open?: boolean }) {
  return (
    <div data-testid="host">
      <main className={sideDrawerPageClass}>Page</main>
      <SideDrawer presentation={presentation} open={open} onOpenChange={onOpenChange} title="Activity" backLabel="Inbox">
        <Field />
      </SideDrawer>
    </div>
  );
}

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

const root = () => document.querySelector<HTMLElement>('[data-slot=side-drawer]')!;

describe('SideDrawer', () => {
  // First: a swipe in an earlier test leaves bindDrag waiting to swallow the click a browser sends after it.
  it('closing a push gives focus back to what opened it', async () => {
    width = 390;
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <main className={sideDrawerPageClass}><button type="button" onClick={() => setOpen(true)}>Open activity</button></main>
          <SideDrawer presentation="push" open={open} onOpenChange={setOpen} title="Activity" backLabel="Inbox"><Field /></SideDrawer>
        </div>
      );
    }
    render(<Opener />);
    const opener = screen.getByRole('button', { name: 'Open activity' });
    opener.focus();
    act(() => { fireEvent.click(opener); });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    // Focus went into the pushed page.
    expect(screen.getByRole('region', { name: 'Activity' }).contains(document.activeElement)).toBe(true);
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Inbox' })); });
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
    expect(document.activeElement).toBe(opener);
  });

  it('closes a fixed column from its close button', () => {
    const onOpenChange = vi.fn();
    render(<Host presentation="fixed" onOpenChange={onOpenChange} />);
    expect(root().getAttribute('data-presentation')).toBe('fixed');
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Close Activity' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
  });

  it('presents as an overlay dialog in a regular host, which Escape closes', () => {
    const onOpenChange = vi.fn();
    render(<Host onOpenChange={onOpenChange} />);
    expect(root().getAttribute('data-presentation')).toBe('overlay');
    act(() => { fireEvent.keyDown(screen.getByRole('dialog', { name: 'Activity' }), { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('right to left, the overlay comes from the end edge: the left', async () => {
    document.documentElement.style.direction = 'rtl';
    try {
      render(<Host presentation="overlay" />);
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      const dialog = screen.getByRole('dialog', { name: 'Activity' });
      expect(dialog.getAttribute('data-side')).toBe('left');
      expect(dialog.className).toContain('mr-auto');
    } finally {
      document.documentElement.style.direction = '';
    }
  });

  it('pushes over a compact host, moves the page under it, and pops from its back button', () => {
    width = 390;
    const onOpenChange = vi.fn();
    render(<Host onOpenChange={onOpenChange} />);
    expect(root().getAttribute('data-presentation')).toBe('push');
    expect(root().getAttribute('data-size-class')).toBe('compact');
    // The page under is covered: one variable on the host, nothing written on the page itself.
    const host = screen.getByTestId('host');
    expect(host.style.getPropertyValue('--side-drawer-under')).toBe('1');
    expect(screen.getByRole('main').getAttribute('style')).toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Inbox' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
  });

  it('pops from a swipe off its leading edge, scrubbing the page under it, and settles on one spring', async () => {
    width = 390;
    // What the host and the root say at the moment the swipe pops (the release).
    const atRelease: boolean[] = [];
    const onOpenChange = vi.fn<(open: boolean, details: unknown) => void>(() => {
      atRelease.push(screen.getByTestId('host').hasAttribute('data-side-drawer-settling'), root().hasAttribute('data-swipe-settling'));
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
      panel.dispatchEvent(pointer('pointerdown', 10, 300, 0));
      for (const x of [40, 120, 200]) {
        document.dispatchEvent(pointer('pointermove', x, 300));
        await frame();
      }
    });
    expect(panel.hasAttribute('data-swiping')).toBe(true);
    expect(root().hasAttribute('data-swiping')).toBe(true);
    expect(host.hasAttribute('data-side-drawer-swiping')).toBe(true);
    const under = Number(host.style.getPropertyValue('--side-drawer-under'));
    expect(under).toBeGreaterThan(0);
    expect(under).toBeLessThan(1);
    await act(async () => {
      document.dispatchEvent(pointer('pointermove', 260, 300));
      document.dispatchEvent(pointer('pointerup', 260, 300));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'swipe' }));
    expect(host.hasAttribute('data-side-drawer-swiping')).toBe(false);
    // Released, the dim and the page settle with the panel, on its spring, and the page is uncovered.
    expect(atRelease).toEqual([true, true]);
    expect(host.style.getPropertyValue('--side-drawer-under')).toBe('');
    await act(async () => { await frame(); await frame(); });
    expect(host.hasAttribute('data-side-drawer-settling')).toBe(false);
  });

  it('a refused swipe springs back and covers the page again', async () => {
    width = 390;
    const onOpenChange = vi.fn((_open: boolean, details: { cancel?: () => void }) => details.cancel?.());
    render(<Host onOpenChange={onOpenChange} />);
    const host = screen.getByTestId('host');
    const panel = screen.getByRole('region', { name: 'Activity' });
    panel.getBoundingClientRect = () => new DOMRect(0, 0, 390, 600);
    await act(async () => {
      panel.dispatchEvent(pointer('pointerdown', 10, 300, 0));
      for (const x of [40, 160, 260]) {
        document.dispatchEvent(pointer('pointermove', x, 300));
        await frame();
      }
      document.dispatchEvent(pointer('pointerup', 260, 300));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'swipe' }));
    expect(root().getAttribute('data-presentation')).toBe('push');
    expect(host.style.getPropertyValue('--side-drawer-under')).toBe('1');
  });

  it('right to left, the push swipes from the right edge and moves the way the finger goes', async () => {
    width = 390;
    const onOpenChange = vi.fn();
    render(<div dir="rtl" style={{ direction: 'rtl' }}><Host onOpenChange={onOpenChange} /></div>);
    const panel = screen.getByRole('region', { name: 'Activity' });
    panel.getBoundingClientRect = () => new DOMRect(0, 0, 390, 600);
    // Every offset is times --stack-dir, which right to left is -1: it enters from the left and follows the finger.
    expect(panel.className).toContain('rtl:[--stack-dir:-1]');
    expect(panel.className).toContain('data-swiping:translate-x-[calc(var(--stack-progress)*100%*var(--stack-dir,1))]');
    expect(panel.className).toContain('data-starting-style:translate-x-[calc(103%*var(--stack-dir,1))]');
    expect(sideDrawerPageClass).toContain('rtl:[--stack-dir:-1]');
    await act(async () => {
      panel.dispatchEvent(pointer('pointerdown', 380, 300, 0));
      for (const x of [340, 260, 180]) {
        document.dispatchEvent(pointer('pointermove', x, 300));
        await frame();
      }
    });
    expect(panel.hasAttribute('data-swiping')).toBe(true);
    expect(Number(panel.style.getPropertyValue('--stack-progress'))).toBeGreaterThan(0.4);
    await act(async () => {
      document.dispatchEvent(pointer('pointerup', 120, 300));
    });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'swipe' }));
  });

  it('keeps its children mounted from overlay to push to fixed', () => {
    const { rerender } = render(<Host presentation="overlay" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Comment' });
    fireEvent.change(input, { target: { value: 'kept' } });
    rerender(<Host presentation="push" />);
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBe(input);
    rerender(<Host presentation="fixed" />);
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBe(input);
    expect(input.value).toBe('kept');
  });
});
