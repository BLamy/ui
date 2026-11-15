// @vitest-environment happy-dom
import { useRef, useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FloatingSheet, FloatingSheetBody, FloatingSheetFab, FloatingSheetFooter, useFloatingSheet } from '@/components/ui/floating-sheet';
import { useHideOnScroll } from '@/lib/scroll-edge';
import { BLProvider } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it; a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

/* happy-dom has no layout: give every element a phone-sized box so the sheet can measure its host. */
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      if (this.dataset.slot === 'floating-sheet') return hostHeight;
      return this.dataset.slot === 'floating-sheet-footer' ? 60 : 720;
    },
  });
});
afterAll(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight);
});
afterEach(() => {
  cleanup();
  hostHeight = 720;
});
/** The sheet's host height, which a test can change (and then tell the observers about). */
let hostHeight = 720;

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const surface = () => document.querySelector<HTMLElement>('[data-slot=floating-sheet-surface]');

function State() {
  const s = useFloatingSheet();
  return (
    <>
      <output aria-label="State">{`${s.open ? 'open' : 'rest'} ${s.minimized ? 'min' : ''}`.trim()}</output>
      <button type="button" onClick={() => s.setMinimized(true)}>Minimize</button>
    </>
  );
}

function Order(props: Parameters<typeof FloatingSheet>[0]) {
  return (
    <BLProvider>
      <div style={{ position: 'relative', height: 720 }}>
        <button type="button">Page</button>
        <FloatingSheet aria-label="Order" peek={120} {...props}>
          {props.children ?? (
            <>
              <FloatingSheetBody><p>Arriving in 12 minutes</p><State /></FloatingSheetBody>
              <FloatingSheetFooter><button type="button">Track</button></FloatingSheetFooter>
            </>
          )}
        </FloatingSheet>
      </div>
    </BLProvider>
  );
}

describe('FloatingSheet', () => {
  it('rests beside the page: named, not modal, focus left alone', async () => {
    render(<Order />);
    await settle(1000);
    const sheet = screen.getByRole('dialog', { name: 'Order' });
    expect(sheet.contains(surface())).toBe(true);
    expect(sheet.getAttribute('aria-modal')).not.toBe('true');
    expect(sheet.contains(document.activeElement)).toBe(false);
    expect(screen.getByRole('button', { name: 'Expand' })).toBeTruthy();
    // A contained Sheet: its layer host fills the sheet's box, not the app.
    expect(document.querySelector('[data-slot=floating-sheet] > [data-slot=sheet-host]')?.hasAttribute('data-layer-host')).toBe(true);
    expect(document.querySelector('[data-slot=sheet-host]')?.contains(sheet)).toBe(true);
  });

  it('grows from its cap and reports the change with a reason', async () => {
    const onOpenChange = vi.fn();
    render(<Order onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    await settle();
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'handle-press' }));
    expect(screen.getByRole('status', { name: 'State' }).textContent).toBe('open');
  });

  it('comes back to rest on Escape instead of closing', async () => {
    function Controlled() {
      const [open, setOpen] = useState(true);
      return <Order open={open} onOpenChange={setOpen} />;
    }
    render(<Controlled />);
    await settle();
    expect(screen.getByRole('status', { name: 'State' }).textContent).toBe('open');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Track' }), { key: 'Escape' });
    await settle();
    expect(screen.getByRole('status', { name: 'State' }).textContent).toBe('rest');
    expect(screen.getByRole('dialog', { name: 'Order' })).toBeTruthy();
  });

  it('keeps the FAB folded and out of reach until the sheet is minimized', async () => {
    render(<Order />);
    await settle();
    const fab = document.querySelector<HTMLElement>('[aria-label="Open Order"]')!;
    expect(fab.hasAttribute('data-folded')).toBe(true);
    expect(fab.hasAttribute('inert')).toBe(true);
    expect(fab.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    await settle(600);
    expect(fab.hasAttribute('data-folded')).toBe(false);
    expect(fab.hasAttribute('inert')).toBe(false);
    fireEvent.click(fab);
    await settle(600);
    expect(fab.hasAttribute('data-folded')).toBe(true);
    expect(screen.getByRole('status', { name: 'State' }).textContent).toBe('rest');
  });

  it('has no FAB when it collapses by hiding, and hides when not visible', async () => {
    render(<Order collapse="hide" visible={false} />);
    await settle();
    expect(document.querySelector('[data-floating-sheet-fab]')).toBeNull();
    expect(document.querySelector('[data-slot=floating-sheet]')?.hasAttribute('data-dismissed')).toBe(true);
  });

  it('keeps the Body mounted, with its state, while the host measures 0', async () => {
    const observers = new Set<() => void>();
    const RO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      private cb: () => void;
      constructor(cb: () => void) { this.cb = () => cb(); }
      observe() { observers.add(this.cb); }
      unobserve() { /* the test never unobserves one element */ }
      disconnect() { observers.delete(this.cb); }
    } as unknown as typeof ResizeObserver;
    const resize = async (height: number) => {
      hostHeight = height;
      await act(async () => observers.forEach((cb) => cb()));
      await settle();
    };
    function Counter() {
      const [n, setN] = useState(0);
      return <button type="button" onClick={() => setN(n + 1)}>{`Count ${n}`}</button>;
    }
    try {
      hostHeight = 0;
      render(
        <div style={{ position: 'relative', height: 720 }}>
          <FloatingSheet aria-label="Order" peek={120}>
            <FloatingSheetBody><Counter /></FloatingSheetBody>
          </FloatingSheet>
        </div>,
      );
      await settle();
      // Not measured yet: rendered, but closed.
      const counter = screen.getByRole('button', { name: 'Count 0', hidden: true });
      fireEvent.click(counter);
      await resize(720);
      expect(screen.getByRole('dialog', { name: 'Order' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Count 1' })).toBe(counter);
      // Hidden (a closed tab): the sheet keeps its geometry and the Body keeps its state and its element.
      await resize(0);
      expect(screen.getByRole('button', { name: 'Count 1', hidden: true })).toBe(counter);
      await resize(720);
      expect(screen.getByRole('button', { name: 'Count 1' })).toBe(counter);
    } finally {
      globalThis.ResizeObserver = RO;
    }
  });

  it('marks its FAB with a hook attribute, leaving data-slot to UI SDK', async () => {
    render(<Order />);
    await settle();
    const fab = document.querySelector<HTMLElement>('[data-floating-sheet-fab]')!;
    expect(fab.getAttribute('aria-label')).toBe('Open Order');
    expect(fab.getAttribute('data-slot')).toBe('button');
  });

  it('reports Escape and the scrim with their reason, and a canceled change keeps it grown', async () => {
    let cancel = true;
    const onOpenChange = vi.fn((_open: boolean, details: { cancel: () => void }) => {
      if (cancel) details.cancel();
    });
    render(<Order defaultOpen onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Track' }), { key: 'Escape' });
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    expect(screen.getByRole('status', { name: 'State' }).textContent).toBe('open');
    cancel = false;
    fireEvent.keyDown(screen.getByRole('button', { name: 'Track' }), { key: 'Escape' });
    await settle();
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status', { name: 'State' }).textContent).toBe('rest');
  });

  it('folds into a FAB that names itself, controlled, with the reason', async () => {
    const onMinimizedChange = vi.fn();
    const { rerender } = render(
      <Order minimized={false} onMinimizedChange={onMinimizedChange}>
        <FloatingSheetBody><State /></FloatingSheetBody>
        <FloatingSheetFab aria-label="Show order"><span>bag</span></FloatingSheetFab>
      </Order>,
    );
    await settle();
    // One FAB: the part replaces the default.
    expect(document.querySelectorAll('[data-floating-sheet-fab]')).toHaveLength(1);
    const fab = () => document.querySelector<HTMLElement>('[aria-label="Show order"]')!;
    expect(fab().hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(onMinimizedChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'imperative' }));
    // Controlled: nothing moved until the parent passes it back.
    expect(document.querySelector('[data-slot=floating-sheet]')?.hasAttribute('data-minimized')).toBe(false);
    rerender(
      <Order minimized onMinimizedChange={onMinimizedChange}>
        <FloatingSheetFab aria-label="Show order"><span>bag</span></FloatingSheetFab>
      </Order>,
    );
    await settle();
    expect(fab().hasAttribute('inert')).toBe(false);
    fireEvent.click(fab());
    expect(onMinimizedChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
    expect(onMinimizedChange.mock.calls.at(-1)?.[1].event).toBeInstanceOf(Event);
  });

  it('places the FAB by side and align, on the inline edges', async () => {
    render(
      <Order>
        <FloatingSheetBody><p>Arriving in 12 minutes</p></FloatingSheetBody>
        <FloatingSheetFab side="end" align="end" aria-label="Show order" />
      </Order>,
    );
    await settle();
    const fab = document.querySelector<HTMLElement>('[data-floating-sheet-fab]')!;
    expect(fab.className).toContain('end-(--fs-fab-gutter)');
    expect(fab.className).toContain('bottom-(--fs-fab-gutter)');
  });

  it('follows the page unless an appearance is given, then wears the sheet scope', async () => {
    const { rerender } = render(<Order />);
    await settle();
    const root = () => document.querySelector<HTMLElement>('[data-slot=floating-sheet]')!;
    expect(root().hasAttribute('data-theme-scope')).toBe(false);
    expect(root().classList.contains('dark')).toBe(false);
    rerender(<Order appearance="dark" variant="card" />);
    await settle();
    expect(root().getAttribute('data-theme-scope')).toBe('sheet');
    expect(root().classList.contains('dark')).toBe(true);
    expect(root().getAttribute('data-variant')).toBe('card');
  });
});

describe('useHideOnScroll', () => {
  function Chrome({ on = true }: { on?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const hidden = useHideOnScroll(on, ref);
    return <div ref={ref} data-testid="scroller"><output aria-label="chrome">{hidden ? 'hidden' : 'shown'}</output></div>;
  }
  const scrollTo = (el: HTMLElement, y: number) => act(() => {
    el.scrollTop = y;
    el.dispatchEvent(new Event('scroll'));
  });

  it('hides on a scroll down, comes back on a scroll up and at the top', () => {
    render(<Chrome />);
    const scroller = screen.getByTestId('scroller');
    const chrome = () => screen.getByRole('status', { name: 'chrome' }).textContent;
    expect(chrome()).toBe('shown');
    scrollTo(scroller, 40);
    expect(chrome()).toBe('hidden');
    scrollTo(scroller, 30);
    expect(chrome()).toBe('shown');
    scrollTo(scroller, 80);
    expect(chrome()).toBe('hidden');
    // A move of a few px either way is noise.
    scrollTo(scroller, 78);
    expect(chrome()).toBe('hidden');
    scrollTo(scroller, 2);
    expect(chrome()).toBe('shown');
  });

  it('stays shown while off', () => {
    render(<Chrome on={false} />);
    scrollTo(screen.getByTestId('scroller'), 200);
    expect(screen.getByRole('status', { name: 'chrome' }).textContent).toBe('shown');
  });
});
