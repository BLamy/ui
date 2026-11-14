// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Toast, ToastClose, ToastDescription, ToastIcon, ToastProvider, ToastRegion, ToastTitle, createHud, createToaster, useToast,
  type ToastRegionProps,
} from '@/components/ui/toast';
import { BLProvider } from '@/lib/theme';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;
// Reduced motion, so a HUD's label is plain text at once instead of a morph in flight.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: /reduce/.test(query), media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {},
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Lets timers, frames and the exit of a closed toast run. */
const pass = (ms = 50) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

/** A region with a queue of its own. */
function setup(props: Partial<ToastRegionProps> = {}) {
  const toaster = createToaster();
  const view = render(<ToastRegion toaster={toaster} {...props} />);
  return { toaster, ...view };
}
const toasts = () => Array.from(document.querySelectorAll<HTMLElement>('[data-slot=toast]'));
const titles = () => toasts().map((el) => el.querySelector('[data-slot=toast-title]')?.textContent);

describe('ToastRegion', () => {
  it('is a landmark named Notifications only while it has toasts', async () => {
    const { toaster } = setup();
    const region = document.querySelector('[data-slot=toast-region]') as HTMLElement;
    expect(region.getAttribute('role')).toBeNull();
    act(() => { toaster('Saved'); });
    await pass();
    expect(screen.getByRole('region', { name: 'Notifications' })).toBe(region);
    expect(region.getAttribute('aria-keyshortcuts')).toBe('F6');
    act(() => toaster.dismiss());
    await pass(600);
    expect(region.getAttribute('role')).toBeNull();
    expect(toasts()).toHaveLength(0);
  });

  it('sits at the bottom center by default, takes side and align, and carries its variant and offset', () => {
    setup({ side: 'top', align: 'end', offset: 12, 'aria-label': 'Alerts', className: 'custom-region' });
    const region = document.querySelector('[data-slot=toast-region]') as HTMLElement;
    expect(region.getAttribute('data-side')).toBe('top');
    expect(region.getAttribute('data-align')).toBe('end');
    expect(region.getAttribute('data-variant')).toBe('banner');
    expect(region.style.getPropertyValue('--bl-toast-offset')).toBe('12px');
    expect(region.classList.contains('custom-region')).toBe(true);
    cleanup();
    setup();
    const plain = document.querySelector('[data-slot=toast-region]') as HTMLElement;
    expect(plain.getAttribute('data-side')).toBe('bottom');
    expect(plain.getAttribute('data-align')).toBe('center');
  });

  it('renders into the layer host, BLProvider’s root', async () => {
    const toaster = createToaster();
    render(<BLProvider><div data-testid="deep"><ToastRegion toaster={toaster} /></div></BLProvider>);
    await pass();
    const region = document.querySelector('[data-slot=toast-region]') as HTMLElement;
    expect(region.parentElement?.getAttribute('data-slot')).toBe('bl-provider');
  });

  it('shows the newest toast first and at most five at once', async () => {
    const { toaster } = setup();
    act(() => { for (const n of [1, 2, 3, 4, 5, 6]) toaster(`Toast ${n}`, { duration: Infinity }); });
    await pass();
    expect(titles()).toEqual(['Toast 6', 'Toast 5', 'Toast 4', 'Toast 3', 'Toast 2']);
    expect(toasts()[0].hasAttribute('data-front')).toBe(true);
    expect(toasts()[1].hasAttribute('data-front')).toBe(false);
  });

  it('spreads while the pointer or focus is in it, or always with expanded', async () => {
    const { toaster } = setup();
    act(() => { toaster('One'); toaster('Two'); });
    await pass();
    const region = screen.getByRole('region');
    expect(region.hasAttribute('data-expanded')).toBe(false);
    fireEvent.pointerEnter(region, { pointerType: 'mouse' });
    expect(region.hasAttribute('data-expanded')).toBe(true);
    expect(toasts().every((el) => el.hasAttribute('data-expanded'))).toBe(true);
    fireEvent.pointerLeave(region, { pointerType: 'mouse' });
    expect(region.hasAttribute('data-expanded')).toBe(false);
    act(() => toasts()[1].focus());
    expect(region.hasAttribute('data-expanded')).toBe(true);
    cleanup();
    setup({ expanded: true });
    expect(document.querySelector('[data-slot=toast-region]')?.hasAttribute('data-expanded')).toBe(true);
  });
});

describe('banner', () => {
  it('is named by its title and described by its description, with an icon for its type', async () => {
    const { toaster } = setup();
    act(() => { toaster.success('Backup complete', { description: 'Backed up at 9:41.' }); });
    await pass();
    const [toast] = toasts();
    expect(toast.getAttribute('data-variant')).toBe('banner');
    expect(toast.getAttribute('data-type')).toBe('success');
    expect(toast.getAttribute('aria-labelledby')).toBe(toast.querySelector('[data-slot=toast-title]')?.id);
    expect(toast.getAttribute('aria-describedby')).toBe(toast.querySelector('[data-slot=toast-description]')?.id);
    expect(within(toast).getByText('Backed up at 9:41.')).toBeTruthy();
    expect(toast.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(toast.firstElementChild?.querySelector('svg')).toBeTruthy();
    expect(toast.firstElementChild?.className).toContain('text-success');
  });

  it('has no icon by default, takes one from data, and shows a spinner while loading', async () => {
    const { toaster } = setup();
    act(() => { toaster('Plain', { duration: Infinity }); });
    await pass();
    expect(toasts()[0].firstElementChild?.hasAttribute('aria-hidden')).toBe(false);
    act(() => { toaster('Message sent', { duration: Infinity, data: { icon: 'paperplane' } }); });
    await pass();
    expect(toasts()[0].firstElementChild?.querySelector('svg')).toBeTruthy();
    act(() => { toaster.loading('Uploading…'); });
    await pass();
    expect(toasts()[0].getAttribute('data-type')).toBe('loading');
    // The kit's Spinner, not a ring of its own.
    expect(toasts()[0].firstElementChild?.querySelector('[data-slot=spinner]')).toBeTruthy();
  });

  it('closes on its own after its duration, and waits while the pointer rests on the region', async () => {
    const { toaster } = setup();
    const onDismiss = vi.fn();
    act(() => { toaster('Saved', { onDismiss }); });
    await pass();
    const region = screen.getByRole('region');
    fireEvent.pointerEnter(region, { pointerType: 'mouse' });
    await pass(6000);
    expect(titles()).toEqual(['Saved']);
    fireEvent.pointerLeave(region, { pointerType: 'mouse' });
    await pass(5200);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onDismiss.mock.calls[0][0].reason).toBe('timeout');
    await pass(600);
    expect(toasts()).toHaveLength(0);
  });

  it('a loading toast stays until it is updated in place, then runs the default duration', async () => {
    const { toaster } = setup();
    let id = '';
    act(() => { id = toaster.loading('Uploading…'); });
    await pass(20_000);
    const [before] = toasts();
    expect(titles()).toEqual(['Uploading…']);
    act(() => { expect(toaster.update(id, { title: 'Uploaded', type: 'success', description: '12 MB in 2 files' })).toBe(true); });
    await pass();
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toBe(before);
    expect(titles()).toEqual(['Uploaded']);
    expect(before.getAttribute('data-type')).toBe('success');
    await pass(5600);
    expect(toasts()).toHaveLength(0);
    expect(toaster.update(id, 'Too late')).toBe(false);
  });

  it('showing a toast with a visible one’s id updates it instead of stacking', async () => {
    const { toaster } = setup();
    act(() => { toaster('one', { id: 'x' }); toaster('two', { id: 'x' }); });
    await pass();
    expect(titles()).toEqual(['two']);
  });

  it('runs its action and closes with reason action; dismiss: false keeps it open', async () => {
    const { toaster } = setup();
    const undo = vi.fn();
    const retry = vi.fn();
    const onDismiss = vi.fn();
    act(() => {
      toaster('Note moved to Trash', { action: { label: 'Undo', onAction: undo }, onDismiss });
      toaster.error('Couldn’t connect', { action: { label: 'Retry', onAction: retry, dismiss: false } });
    });
    await pass();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await pass();
    expect(retry).toHaveBeenCalledOnce();
    expect(titles()).toEqual(['Couldn’t connect', 'Note moved to Trash']);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await pass(600);
    expect(undo).toHaveBeenCalledOnce();
    expect(onDismiss.mock.calls[0][0].reason).toBe('action');
    expect(titles()).toEqual(['Couldn’t connect']);
  });

  it('has a Close button that dismisses with reason close-press, unless it is not dismissible', async () => {
    const { toaster } = setup();
    const onDismiss = vi.fn();
    act(() => {
      toaster('Pinned', { duration: Infinity, dismissible: false });
      toaster('Saved', { duration: Infinity, onDismiss });
    });
    await pass();
    const [saved, pinned] = toasts();
    expect(within(pinned).queryByRole('button')).toBeNull();
    fireEvent.click(within(saved).getByRole('button', { name: 'Close' }));
    await pass(600);
    expect(onDismiss.mock.calls[0][0].reason).toBe('close-press');
    expect(titles()).toEqual(['Pinned']);
  });

  it('renders a cancel button beside the action, and a canceled dismissal keeps the toast', async () => {
    const { toaster } = setup();
    const onCancel = vi.fn();
    let keep = true;
    act(() => {
      toaster('Delete 3 files?', {
        duration: Infinity, dismissible: false, cancel: { label: 'Not now', onCancel },
        onDismiss: (details) => { if (keep) details.cancel(); },
      });
    });
    await pass();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await pass(600);
    expect(onCancel).toHaveBeenCalledOnce();
    expect(titles()).toEqual(['Delete 3 files?']);
    keep = false;
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await pass(600);
    expect(toasts()).toHaveLength(0);
  });

  it('Escape closes the focused toast, and F6 moves focus to the newest toast and back', async () => {
    const { toaster } = setup();
    render(<button type="button">Outside</button>);
    const outside = screen.getByRole('button', { name: 'Outside' });
    const onDismiss = vi.fn();
    act(() => { toaster('Older', { duration: Infinity }); toaster('Newer', { duration: Infinity, onDismiss }); });
    await pass();
    act(() => outside.focus());
    fireEvent.keyDown(outside, { key: 'F6' });
    expect(document.activeElement).toBe(toasts()[0]);
    fireEvent.keyDown(toasts()[0], { key: 'F6' });
    expect(document.activeElement).toBe(outside);
    fireEvent.keyDown(outside, { key: 'F6' });
    fireEvent.keyDown(toasts()[0], { key: 'Escape' });
    await pass(600);
    expect(onDismiss.mock.calls[0][0].reason).toBe('escape-key');
    expect(titles()).toEqual(['Older']);
    // Focus moved to the toast that is left, not to the page.
    expect(document.activeElement).toBe(toasts()[0]);
  });

  it('toast.promise turns the loading toast into the result', async () => {
    const { toaster } = setup();
    let finish!: (value: string) => void;
    act(() => {
      toaster.promise(new Promise<string>((resolve) => { finish = resolve; }), {
        loading: 'Saving…', success: (name) => `${name} saved`, error: 'Couldn’t save',
      });
    });
    await pass();
    expect(titles()).toEqual(['Saving…']);
    await act(async () => { finish('Draft'); });
    await pass();
    expect(titles()).toEqual(['Draft saved']);
    expect(toasts()[0].getAttribute('data-type')).toBe('success');
  });

  it('a children function renders each toast from the parts, with className merged last', async () => {
    const { toaster } = setup({
      children: (item) => (
        <Toast className="custom-toast px-0">
          <ToastIcon>★</ToastIcon>
          <ToastTitle className="custom-title" />
          <ToastDescription>{`id ${item.id}`}</ToastDescription>
          <ToastClose aria-label="Dismiss" />
        </Toast>
      ),
    });
    act(() => { toaster('Custom', { id: 'c1', duration: Infinity }); });
    await pass();
    const [toast] = toasts();
    expect(toast.classList.contains('custom-toast')).toBe(true);
    expect(toast.classList.contains('px-3.5')).toBe(false);
    expect(toast.textContent).toContain('★');
    expect(toast.querySelector('.custom-title')?.textContent).toBe('Custom');
    expect(within(toast).getByText('id c1')).toBeTruthy();
    expect(within(toast).getByRole('button', { name: 'Dismiss' })).toBeTruthy();
  });
});

describe('hud', () => {
  function setupHud() {
    const hud = createHud();
    render(<ToastRegion variant="hud" toaster={hud.toaster} />);
    return hud;
  }

  it('shows one pill and updates it in place, starting fresh each time', async () => {
    const hud = setupHud();
    act(() => { hud('Password Copied', { type: 'success' }); });
    await pass();
    const [pill] = toasts();
    expect(pill.getAttribute('data-variant')).toBe('hud');
    expect(pill.getAttribute('data-type')).toBe('success');
    expect(pill.querySelector('svg')).toBeTruthy();
    expect(pill.querySelector('button')).toBeNull();
    act(() => { hud('Code Copied'); });
    await pass();
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toBe(pill);
    expect(titles()).toEqual(['Code Copied']);
    // Nothing of the last pill carries over: no type, so no icon.
    expect(pill.getAttribute('data-type')).toBe('default');
    expect(pill.querySelector('svg')).toBeNull();
  });

  it('is gone after 1.6 s, and a second call restarts the clock', async () => {
    const hud = setupHud();
    act(() => { hud('Copied'); });
    await pass(1000);
    act(() => { hud('Copied again'); });
    await pass(1000);
    expect(titles()).toEqual(['Copied again']);
    await pass(1200);
    expect(toasts()).toHaveLength(0);
  });

  it('cannot be closed by hand: Escape leaves it', async () => {
    const hud = setupHud();
    act(() => { hud('Copied'); });
    await pass();
    act(() => toasts()[0].focus());
    fireEvent.keyDown(toasts()[0], { key: 'Escape' });
    await pass(300);
    expect(titles()).toEqual(['Copied']);
  });
});

describe('useToast', () => {
  it('is the queue of the nearest ToastProvider', async () => {
    const toaster = createToaster();
    function Save() {
      const toast = useToast();
      return <button type="button" onClick={() => toast.warning('Couldn’t attach a file', { id: 'rejected' })}>Attach</button>;
    }
    render(<ToastProvider toaster={toaster}><Save /><ToastRegion toaster={toaster} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Attach' }));
    await pass();
    expect(toaster.toasts().map((t) => t.id)).toEqual(['rejected']);
    expect(toasts()[0].getAttribute('data-type')).toBe('warning');
  });

  it('is also what a banner region inside the provider shows, without a toaster of its own', async () => {
    const toaster = createToaster();
    function Save() {
      const toast = useToast();
      return <button type="button" onClick={() => toast('Saved', { id: 'saved' })}>Save</button>;
    }
    render(<ToastProvider toaster={toaster}><Save /><ToastRegion /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await pass();
    expect(titles()).toEqual(['Saved']);
  });
});
