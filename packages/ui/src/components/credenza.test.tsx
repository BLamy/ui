// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  Credenza, CredenzaBack, CredenzaBackdrop, CredenzaClose, CredenzaContent, CredenzaHeader, CredenzaTitle, CredenzaTrigger,
  CredenzaView, type CredenzaProps,
} from '@/components/ui/credenza';
import { BLProvider } from '@/lib/theme';
import { SizeClassProvider, type SizeClass } from '@/lib/container';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it; a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

afterEach(cleanup);

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const card = () => document.querySelector<HTMLElement>('[data-slot=dialog-content]');

/** A Credenza in its host (inside a container of `sizeClass`, when given), and a key listener standing in for a
    NavigationStack behind it. */
function SignIn(props: Partial<CredenzaProps> & { sizeClass?: SizeClass }) {
  const { sizeClass, ...root } = props;
  return (
    <BLProvider>
      <SizeClassProvider value={sizeClass}>
        <Credenza {...root}>
          <CredenzaTrigger>Sign in…</CredenzaTrigger>
          <CredenzaBackdrop />
          <CredenzaContent>
            <CredenzaHeader>
              <CredenzaTitle>Sign in</CredenzaTitle>
              <CredenzaClose />
            </CredenzaHeader>
            <CredenzaView><button type="button">Continue</button></CredenzaView>
          </CredenzaContent>
        </Credenza>
      </SizeClassProvider>
    </BLProvider>
  );
}

async function open(props: Partial<CredenzaProps> & { sizeClass?: SizeClass } = {}) {
  const onOpenChange = vi.fn();
  const behind = vi.fn();
  window.addEventListener('keydown', behind);
  render(<SignIn onOpenChange={onOpenChange} {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in…' }));
  await settle();
  const done = () => window.removeEventListener('keydown', behind);
  return { onOpenChange, behind, done };
}

describe('Credenza', () => {
  it('opens from its trigger as a modal dialog named by its title, focus inside', async () => {
    const { done } = await open();
    const dialog = screen.getByRole('dialog', { name: 'Sign in' });
    expect(dialog).toBe(card());
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    done();
  });

  it('closes on Escape (handled, so the views behind leave it), the backdrop, the backdrop and the ×, with a reason', async () => {
    const { onOpenChange, behind, done } = await open();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Continue' }), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    expect(behind.mock.calls.every(([e]) => e.defaultPrevented)).toBe(true);
    done();
  });

  it('closes from its × button', async () => {
    const { onOpenChange, done } = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
    await settle(400);
    expect(card()).toBeNull();
    done();
  });

  it('with dismissible={false} has no × and refuses Escape, reporting the attempt', async () => {
    const onDismissAttempt = vi.fn();
    const { onOpenChange, behind, done } = await open({ dismissible: false, onDismissAttempt });
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Continue' }), { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalledWith(false, expect.anything());
    expect(onDismissAttempt).toHaveBeenCalledWith(expect.objectContaining({ reason: 'escape-key' }));
    expect(behind.mock.calls.every(([e]) => e.defaultPrevented)).toBe(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
    done();
  });

  it('presents as a tray with a grabber in a compact container, and as a card otherwise', async () => {
    const tray = await open({ sizeClass: 'compact' });
    expect(card()?.getAttribute('data-presentation')).toBe('sheet');
    expect(card()?.querySelector('[data-slot=credenza-grabber]')).not.toBeNull();
    tray.done();
    cleanup();
    const dialog = await open({ sizeClass: 'regular' });
    expect(card()?.getAttribute('data-presentation')).toBe('dialog');
    expect(card()?.querySelector('[data-slot=credenza-grabber]')).toBeNull();
    dialog.done();
  });

  it('drops the grabber from a tray that can’t be dismissed', async () => {
    const gate = await open({ presentation: 'sheet', dismissible: false });
    expect(card()?.getAttribute('data-presentation')).toBe('sheet');
    expect(card()?.querySelector('[data-slot=credenza-grabber]')).toBeNull();
    gate.done();
  });
});

describe('Credenza views', () => {
  function Flow() {
    const [view, setView] = useState('card');
    return (
      <BLProvider>
        <Credenza defaultOpen dismissible={false} view={view}>
          <CredenzaContent>
            <CredenzaHeader>
              <CredenzaBack hidden={view === 'card'} onClick={() => setView('card')} />
              <CredenzaTitle>{view === 'card' ? 'Payment' : 'Verify'}</CredenzaTitle>
            </CredenzaHeader>
            <CredenzaView>
              {view === 'card'
                ? <button type="button" onClick={() => setView('code')}>Pay</button>
                : <input aria-label="Code" />}
            </CredenzaView>
          </CredenzaContent>
        </Credenza>
      </BLProvider>
    );
  }

  it('folds the back chevron away until there is somewhere to go back to', async () => {
    render(<Flow />);
    await settle();
    const back = document.querySelector<HTMLElement>('[data-slot=credenza-back]')!;
    expect(back.hasAttribute('data-hidden')).toBe(true);
    expect(back.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await settle();
    expect(back.hasAttribute('data-hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay' })).toBeTruthy());
  });

  it('swaps the title in the direction of travel: the old one plays its exit, hidden, then goes', async () => {
    // happy-dom runs no transitions: give the title texts one that ends when the test says.
    const style = document.createElement('style');
    style.textContent = '[data-slot=credenza-title-text] { transition-duration: 5s; transition-delay: 0s; animation-duration: 0s; animation-delay: 0s; animation-iteration-count: 1 }';
    document.head.append(style);
    let end = () => {};
    const finished = new Promise<void>((resolve) => { end = resolve; });
    const original = HTMLElement.prototype.getAnimations;
    HTMLElement.prototype.getAnimations = function (this: HTMLElement) {
      return this.dataset.slot === 'credenza-title-text'
        ? [{ transitionProperty: 'opacity', finished, finish: () => undefined, effect: null } as unknown as Animation]
        : original.call(this);
    };
    onTestFinished(() => {
      HTMLElement.prototype.getAnimations = original;
      style.remove();
    });
    render(<Flow />);
    await settle();
    const texts = () => [...document.querySelectorAll<HTMLElement>('[data-slot=credenza-title-text]')];
    // Nothing plays on first paint.
    expect(texts().map((t) => t.textContent)).toEqual(['Payment']);
    expect(texts()[0].hasAttribute('data-starting-style')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const [leaving, arriving] = texts();
    expect([leaving.textContent, arriving.textContent]).toEqual(['Payment', 'Verify']);
    expect(leaving.hasAttribute('data-ending-style')).toBe(true);
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(arriving.hasAttribute('aria-hidden')).toBe(false);
    // Forward: the new title comes from the right, the old leaves to the left.
    const vars = leaving.parentElement!.style;
    expect([vars.getPropertyValue('--title-enter'), vars.getPropertyValue('--title-exit')]).toEqual(['18px', '-18px']);
    await settle();
    expect(texts()).toHaveLength(2);
    await act(async () => { end(); await finished; });
    await waitFor(() => expect(texts().map((t) => t.textContent)).toEqual(['Verify']));
    expect(screen.getByRole('dialog', { name: 'Verify' })).toBeTruthy();
    // Back: the reverse.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(texts()[0].parentElement!.style.getPropertyValue('--title-enter')).toBe('-18px');
    await waitFor(() => expect(texts().map((t) => t.textContent)).toEqual(['Payment']));
  });

  it('keeps focus in the card when a view change takes the focused control away', async () => {
    render(<Flow />);
    await settle();
    const pay = screen.getByRole('button', { name: 'Pay' });
    pay.focus();
    fireEvent.click(pay);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Pay' })).toBeNull(), { timeout: 3000 });
    await settle();
    expect(card()?.contains(document.activeElement)).toBe(true);
  });
});
