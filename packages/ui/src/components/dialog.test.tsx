// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Dialog, DialogBack, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, DialogView, createConfirm, type DialogProps,
} from '@/components/ui/dialog';
import { BLProvider } from '@/lib/theme';
import { SizeClassProvider, type SizeClass } from '@/lib/container';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it (a sheet cancels its
   own as it is torn down); a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

afterEach(cleanup);

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const card = () => document.querySelector<HTMLElement>('[data-slot=dialog-content]');
/* A whole mouse press. The click lands on the page when the press already removed what was under the pointer. */
const press = (el: Element) => {
  fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(el, { pointerType: 'mouse', button: 0 });
  fireEvent.click(el.isConnected ? el : document.body);
};

function Rename(props: Parameters<typeof Dialog>[0] & { onSave?: () => void }) {
  const { onSave, ...root } = props;
  return (
    <Dialog {...root}>
      <DialogTrigger className={buttonVariants()}>Rename…</DialogTrigger>
      <DialogBackdrop />
      <DialogContent size="lg">
        <DialogClose />
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>Names are visible to everyone.</DialogDescription>
        </DialogHeader>
        <DialogBody><input aria-label="Name" defaultValue="Aurora" /></DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <DialogClose render={<Button />} value="save" action={onSave}>Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Delete(props: Parameters<typeof AlertDialog>[0] & { onDelete?: () => void }) {
  const { onDelete, ...root } = props;
  return (
    <AlertDialog {...root}>
      <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete photo…</AlertDialogTrigger>
      <AlertDialogBackdrop />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
          <AlertDialogClose variant="destructive" value="confirm" action={onDelete}>Delete</AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

describe('Dialog', () => {
  it('opens as a modal dialog named by its title and described by its description, with focus inside', async () => {
    const onOpenChange = vi.fn();
    render(<Rename onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename…' }));
    await settle();

    const dialog = screen.getByRole('dialog', { name: 'Rename project' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('data-size')).toBe('lg');
    expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Names are visible to everyone.');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.querySelector('[data-slot=dialog-backdrop]')).not.toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
  });

  it('closes from the corner ×, Escape and an outside press, and returns focus to its trigger', async () => {
    const onOpenChange = vi.fn();
    render(<Rename onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Rename…' });
    const reopen = async () => { fireEvent.click(trigger); await settle(); };

    await reopen();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));

    await reopen();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));

    await reopen();
    press(document.querySelector('[data-slot=dialog-backdrop]')!);
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'outside-press' }));
  });

  it("runs a Close part's action and reports its value", async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn();
    render(<Rename defaultOpen onOpenChange={onOpenChange} onSave={onSave} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ returnValue: 'save' }));
  });

  it('refuses dismissal while it is not dismissible, but its Close parts still close it', async () => {
    const onDismissAttempt = vi.fn();
    render(<Rename defaultOpen dismissible={false} onDismissAttempt={onDismissAttempt} />);
    await settle();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onDismissAttempt).toHaveBeenCalledWith(expect.objectContaining({ reason: 'escape-key' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("renders its backdrop and its card into BLProvider's root", async () => {
    render(<BLProvider><Rename defaultOpen /></BLProvider>);
    await settle();
    const root = document.querySelector('[data-slot=bl-provider]');
    expect(root!.hasAttribute('data-layer-host')).toBe(true);
    expect(document.querySelector('[data-slot=dialog-backdrop]')!.parentElement).toBe(root);
    expect(screen.getByRole('dialog').parentElement).toBe(root);
  });

  it('makes only the rest of its host inert, not the page around it', async () => {
    render(
      <>
        <button type="button">Outside</button>
        <BLProvider><button type="button">Inside</button><Rename defaultOpen /></BLProvider>
      </>,
    );
    await settle();
    const inert = (name: string) => screen.getByRole('button', { name, hidden: true }).closest('[inert],[aria-hidden=true]');
    expect(inert('Inside')).not.toBeNull();
    expect(inert('Outside')).toBeNull();
  });
});

describe('AlertDialog', () => {
  it('is an alertdialog that starts on its first answer', async () => {
    render(<Delete />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete photo…' }));
    await settle();
    const alert = screen.getByRole('alertdialog', { name: 'Delete this photo?' });
    expect(alert.getAttribute('aria-modal')).toBe('true');
    expect(alert.getAttribute('data-size')).toBe('alert');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('ignores an outside press, closes on Escape, and returns focus to its trigger', async () => {
    const onOpenChange = vi.fn();
    render(<Delete onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Delete photo…' });
    fireEvent.click(trigger);
    await settle();
    press(document.querySelector('[data-slot=alert-dialog-backdrop]')!);
    await settle();
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('reports which answer closed it', async () => {
    const onOpenChange = vi.fn();
    const onDelete = vi.fn();
    render(<Delete onOpenChange={onOpenChange} onDelete={onDelete} />);
    const trigger = screen.getByRole('button', { name: 'Delete photo…' });

    fireEvent.click(trigger);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
    expect(onOpenChange.mock.lastCall![1].returnValue).toBeUndefined();

    fireEvent.click(trigger);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await settle();
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ returnValue: 'confirm' }));
  });

  it('answers a question asked from code', async () => {
    const confirm = createConfirm<string>();
    render(
      <AlertDialog controller={confirm.controller}>
        <AlertDialogBackdrop />
        <AlertDialogContent<string>>
          {(state) => (
            <>
              <AlertDialogHeader><AlertDialogTitle>Delete {state.payload}?</AlertDialogTitle></AlertDialogHeader>
              <AlertDialogFooter orientation="vertical">
                <AlertDialogClose variant="cancel">Keep</AlertDialogClose>
                <AlertDialogClose variant="destructive" value="confirm">Delete</AlertDialogClose>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>,
    );
    let answer: boolean | undefined;
    act(() => { void confirm('Aurora').then((value) => { answer = value; }); });
    await settle();
    expect(screen.getByRole('alertdialog', { name: 'Delete Aurora?' })).toBeTruthy();
    expect(document.querySelector('[data-slot=alert-dialog-footer]')!.getAttribute('data-orientation')).toBe('vertical');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await settle();
    expect(answer).toBe(true);
  });
});

describe('presentation="auto" open at mount', () => {
  it('opens as a sheet once the compact container around it has measured, even though it opened first', async () => {
    const { SizeClassProvider } = await import('@/lib/container');
    const { useLayoutEffect, useState } = await import('react');
    // happy-dom rejects a cancelled animation's `finished`, which the sheet cancels as it is torn down: not this test's.
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
      const animation = animate.apply(this, args);
      animation.finished.catch(() => undefined);
      return animation;
    };
    onTestFinished(() => { Element.prototype.animate = animate; });
    function Measuring({ children }: { children: React.ReactNode }) {
      // A container whose size class is known only after its own layout effect, as a measured one is.
      const [sizeClass, setSizeClass] = useState<'compact' | undefined>(undefined);
      useLayoutEffect(() => setSizeClass('compact'), []);
      return <SizeClassProvider value={sizeClass ?? 'regular'}>{children}</SizeClassProvider>;
    }
    render(
      <BLProvider>
        <Measuring>
          <Dialog defaultOpen presentation="auto">
            <DialogContent><DialogTitle>Sign in</DialogTitle></DialogContent>
          </Dialog>
        </Measuring>
      </BLProvider>,
    );
    await settle();
    expect(document.querySelector('[data-slot="dialog-content"]')?.getAttribute('data-presentation')).toBe('sheet');
  });
});


describe('Dialog presentation', () => {
  function InScope({ sizeClass, ...props }: Partial<DialogProps> & { sizeClass?: SizeClass }) {
    return (
      <BLProvider>
        <SizeClassProvider value={sizeClass}>
          <Dialog defaultOpen {...props}>
            <DialogContent><DialogTitle>Sign in</DialogTitle></DialogContent>
          </Dialog>
        </SizeClassProvider>
      </BLProvider>
    );
  }

  it('is "auto" by default: a sheet with a grabber in a compact scope, a card in a regular one', async () => {
    render(<InScope sizeClass="compact" />);
    await settle();
    expect(card()?.getAttribute('data-presentation')).toBe('sheet');
    expect(card()?.getAttribute('data-variant')).toBe('default');
    expect(card()?.querySelector('[data-slot=dialog-grabber]')).not.toBeNull();
    cleanup();
    render(<InScope sizeClass="regular" />);
    await settle();
    expect(card()?.getAttribute('data-presentation')).toBe('dialog');
    expect(card()?.querySelector('[data-slot=dialog-grabber]')).toBeNull();
  });

  it('stays a card with presentation="dialog", even in a compact scope', async () => {
    render(<InScope sizeClass="compact" presentation="dialog" />);
    await settle();
    expect(card()?.getAttribute('data-presentation')).toBe('dialog');
  });

  it('drops the grabber and the × from a sheet that can’t be dismissed', async () => {
    render(
      <BLProvider>
        <Dialog defaultOpen presentation="sheet" dismissible={false}>
          <DialogContent variant="tray">
            <DialogHeader variant="bar"><DialogTitle>Updated terms</DialogTitle><DialogClose /></DialogHeader>
            <DialogClose>Agree</DialogClose>
          </DialogContent>
        </Dialog>
      </BLProvider>,
    );
    await settle();
    expect(card()?.getAttribute('data-presentation')).toBe('sheet');
    expect(card()?.getAttribute('data-variant')).toBe('tray');
    expect(card()?.querySelector('[data-slot=dialog-grabber]')).toBeNull();
    expect(card()?.querySelector('[aria-label=Close]')).toBeNull();
    expect(card()?.textContent).toContain('Agree');
  });
});

describe('Dialog header bar', () => {
  /** A dialog in its host (inside a container of `sizeClass`, when given), and a key listener standing in for a
      NavigationStack behind it. */
  function SignIn(props: Partial<DialogProps> & { sizeClass?: SizeClass }) {
    const { sizeClass, ...root } = props;
    return (
      <BLProvider>
        <SizeClassProvider value={sizeClass}>
          <Dialog {...root}>
            <DialogTrigger>Sign in…</DialogTrigger>
            <DialogBackdrop />
            <DialogContent variant="tray">
              <DialogHeader variant="bar">
                <DialogTitle>Sign in</DialogTitle>
                <DialogClose />
              </DialogHeader>
              <DialogView><button type="button">Continue</button></DialogView>
            </DialogContent>
          </Dialog>
        </SizeClassProvider>
      </BLProvider>
    );
  }

  async function open(props: Partial<DialogProps> & { sizeClass?: SizeClass } = {}) {
    const onOpenChange = vi.fn();
    const behind = vi.fn();
    window.addEventListener('keydown', behind);
    render(<SignIn onOpenChange={onOpenChange} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in…' }));
    await settle();
    const done = () => window.removeEventListener('keydown', behind);
    return { onOpenChange, behind, done };
  }

  it('opens from its trigger as a modal dialog named by its title, focus inside, the × in the row', async () => {
    const { done } = await open();
    const dialog = screen.getByRole('dialog', { name: 'Sign in' });
    expect(dialog).toBe(card());
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.parentElement?.getAttribute('data-slot')).toBe('dialog-header');
    expect(close.className.split(' ')).not.toContain('absolute');
    done();
  });

  it('closes on Escape, handled so the views behind leave it, with a reason', async () => {
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

  it('presents as a floating tray with a grabber in a compact container, and as a card otherwise', async () => {
    const tray = await open({ sizeClass: 'compact' });
    expect(card()?.getAttribute('data-presentation')).toBe('sheet');
    expect(card()?.querySelector('[data-slot=dialog-grabber]')).not.toBeNull();
    tray.done();
    cleanup();
    const dialog = await open({ sizeClass: 'regular' });
    expect(card()?.getAttribute('data-presentation')).toBe('dialog');
    expect(card()?.querySelector('[data-slot=dialog-grabber]')).toBeNull();
    dialog.done();
  });
});

describe('Dialog views', () => {
  function Flow() {
    const [view, setView] = useState('card');
    return (
      <BLProvider>
        <Dialog defaultOpen dismissible={false} view={view}>
          <DialogContent variant="tray">
            <DialogHeader variant="bar">
              <DialogBack hidden={view === 'card'} onClick={() => setView('card')} />
              <DialogTitle>{view === 'card' ? 'Payment' : 'Verify'}</DialogTitle>
            </DialogHeader>
            <DialogView>
              {view === 'card'
                ? <button type="button" onClick={() => setView('code')}>Pay</button>
                : <input aria-label="Code" />}
            </DialogView>
          </DialogContent>
        </Dialog>
      </BLProvider>
    );
  }

  it('folds the back chevron away until there is somewhere to go back to', async () => {
    render(<Flow />);
    await settle();
    const back = document.querySelector<HTMLElement>('[data-slot=dialog-back]')!;
    expect(back.hasAttribute('data-hidden')).toBe(true);
    expect(back.getAttribute('aria-hidden')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await settle();
    expect(back.hasAttribute('data-hidden')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pay' })).toBeTruthy());
  });

  it('swaps the title in the direction of travel: the old one plays its exit, then goes', async () => {
    // happy-dom runs no transitions: give the title's views one that ends when the test says.
    const isTitleView = (el: HTMLElement) => el.dataset.slot === 'swap-view' && el.closest('[data-slot=dialog-title]') !== null;
    const style = document.createElement('style');
    style.textContent = '[data-slot=dialog-title] [data-slot=swap-view] { transition-duration: 5s; transition-delay: 0s; animation-duration: 0s; animation-delay: 0s; animation-iteration-count: 1 }';
    document.head.append(style);
    let end = () => {};
    const finished = new Promise<void>((resolve) => { end = resolve; });
    const original = HTMLElement.prototype.getAnimations;
    HTMLElement.prototype.getAnimations = function (this: HTMLElement) {
      return isTitleView(this)
        ? [{ transitionProperty: 'opacity', finished, finish: () => undefined, effect: null } as unknown as Animation]
        : original.call(this);
    };
    onTestFinished(() => {
      HTMLElement.prototype.getAnimations = original;
      style.remove();
    });
    render(<Flow />);
    await settle();
    const texts = () => [...document.querySelectorAll<HTMLElement>('[data-slot=dialog-title] [data-slot=swap-view]')];
    // Nothing plays on first paint.
    expect(texts().map((t) => t.textContent)).toEqual(['Payment']);
    expect(texts()[0].hasAttribute('data-starting-style')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    const [leaving, arriving] = texts();
    expect([leaving.textContent, arriving.textContent]).toEqual(['Payment', 'Verify']);
    expect(leaving.hasAttribute('data-ending-style')).toBe(true);
    // The leaving title is out of the accessibility tree, so the dialog is named by the arriving one alone.
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Verify' })).toBeTruthy();
    // Forward: the new title comes from the right, the old leaves to the left.
    const vars = leaving.parentElement!.style;
    expect([vars.getPropertyValue('--swap-enter'), vars.getPropertyValue('--swap-exit')]).toEqual(['18px', '-18px']);
    await settle();
    expect(texts()).toHaveLength(2);
    await act(async () => { end(); await finished; });
    await waitFor(() => expect(texts().map((t) => t.textContent)).toEqual(['Verify']));
    expect(screen.getByRole('dialog', { name: 'Verify' })).toBeTruthy();
    // Back: the reverse.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(texts()[0].parentElement!.style.getPropertyValue('--swap-enter')).toBe('-18px');
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

  it('without a view on the root the title renders plainly, with no swap', async () => {
    render(<BLProvider><Dialog defaultOpen><DialogContent><DialogHeader><DialogTitle>Plain</DialogTitle></DialogHeader></DialogContent></Dialog></BLProvider>);
    await settle();
    expect(document.querySelector('[data-slot=dialog-title] [data-slot=swap]')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Plain' })).toBeTruthy();
  });
});
