// @vitest-environment happy-dom
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogBackdrop, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
  Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger, createConfirm,
} from '@/components/ui/dialog';
import { BLProvider } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
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
