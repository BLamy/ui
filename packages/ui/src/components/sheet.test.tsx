// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet, SheetBackdrop, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
  SheetTrigger, SheetView, createSheetController,
} from '@/components/ui/sheet';
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

afterEach(cleanup);

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const sheet = () => document.querySelector<HTMLElement>('[data-slot=drawer-content]');

function Filters(props: Parameters<typeof Sheet>[0] & { onApply?: () => void }) {
  const { onApply, ...root } = props;
  return (
    <Sheet {...root}>
      <SheetTrigger className={buttonVariants({ variant: 'secondary' })}>Filters</SheetTrigger>
      <SheetBackdrop />
      <SheetContent>
        <SheetClose />
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Narrow the list of messages.</SheetDescription>
        </SheetHeader>
        <SheetBody><input aria-label="Sender" /></SheetBody>
        <SheetFooter>
          <SheetClose render={<Button size="pill" />} value="apply" action={onApply}>Apply</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

describe('Sheet', () => {
  it('opens from its trigger as a modal dialog named by its title, at the bottom with a grabber', async () => {
    const onOpenChange = vi.fn();
    render(<Filters onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    fireEvent.click(trigger);
    await settle();

    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toBe(sheet());
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('data-side')).toBe('bottom');
    expect(dialog.className).toContain('rounded-t-sheet');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.querySelector('[data-slot=sheet-grabber]')?.getAttribute('aria-hidden')).toBe('true');
    expect(dialog.querySelector('[data-slot=drawer-handle]')).toBeNull();
    const backdrop = document.querySelector('[data-slot=drawer-backdrop]');
    expect(backdrop).not.toBeNull();
    // UI SDK hides a closed backdrop with the native attribute, so it needs no class for it.
    expect(backdrop?.hasAttribute('hidden')).toBe(false);
    expect(backdrop?.className).not.toContain('data-hidden');
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
  });

  it('comes from the side it is given, without a grabber', async () => {
    render(<Filters side="right" defaultOpen />);
    await settle();
    expect(sheet()!.getAttribute('data-side')).toBe('right');
    expect(sheet()!.className).toContain('rounded-l-sheet');
    expect(sheet()!.querySelector('[data-slot=sheet-grabber]')).toBeNull();
  });

  it('closes on Escape, from the corner × and from a Close part, and returns focus to its trigger', async () => {
    const onOpenChange = vi.fn();
    const onApply = vi.fn();
    render(<Filters onOpenChange={onOpenChange} onApply={onApply} />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    const reopen = async () => { fireEvent.click(trigger); await settle(); };

    await reopen();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle(700);
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));

    await reopen();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await settle(700);
    expect(sheet()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));

    await reopen();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await settle(700);
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(sheet()).toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ returnValue: 'apply' }));
  });

  it('turns its grabber into a named handle when it has snap points', async () => {
    render(<Filters snapPoints={[0.5, 1]} defaultOpen />);
    await settle();
    const handle = screen.getByRole('button', { name: 'Resize' });
    expect(handle.getAttribute('data-slot')).toBe('drawer-handle');
    expect(handle.getAttribute('aria-controls')).toBe(sheet()!.id);
    expect(sheet()!.querySelector('[data-slot=sheet-grabber]')).toBeNull();
  });

  it("renders into BLProvider's root and opens from a controller", async () => {
    const filters = createSheetController();
    render(<BLProvider><Filters controller={filters} /></BLProvider>);
    await settle();
    expect(sheet()).toBeNull();
    act(() => { void filters.open(); });
    await settle();
    const root = document.querySelector('[data-slot=bl-provider]')!;
    expect(root.contains(sheet())).toBe(true);
    expect(document.querySelector('[data-slot=drawer-backdrop]')!.parentElement).toBe(root);
    expect(document.querySelector('[data-slot=drawer-viewport]')!.parentElement).toBe(root);
  });

  it('puts the handle after the content in the tab order, while it shows first', async () => {
    render(<Filters snapPoints={[0.5, 1]} defaultOpen />);
    await settle();
    const handle = screen.getByRole('button', { name: 'Resize' });
    const sender = screen.getByRole('textbox', { name: 'Sender' });
    expect(handle.compareDocumentPosition(sender) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(handle.className).toContain('order-first');
  });

  it('contained: renders in place, in a layer host of its own, and leaves the page outside it alone', async () => {
    render(
      <BLProvider>
        <button type="button">Outside</button>
        <div style={{ position: 'relative' }} data-testid="box">
          <Sheet contained side="left" defaultOpen>
            <SheetBackdrop />
            <SheetContent variant="panel" aria-label="Menu" swipe={false}><button type="button">Inside</button></SheetContent>
          </Sheet>
        </div>
      </BLProvider>,
    );
    await settle();
    const host = document.querySelector<HTMLElement>('[data-slot=sheet-host]')!;
    expect(host.hasAttribute('data-layer-host')).toBe(true);
    expect(host.className).toContain('[contain:layout]');
    expect(screen.getByTestId('box').contains(host)).toBe(true);
    const panel = screen.getByRole('dialog', { name: 'Menu' });
    // A panel: no grabber, flush with its edge, divided by a hairline, and opted out of the drag.
    expect(panel.getAttribute('data-variant')).toBe('panel');
    expect(panel.className).toContain('border-r');
    expect(panel.className).not.toContain('rounded-r-sheet');
    expect(panel.querySelector('[data-slot=sheet-grabber]')).toBeNull();
    expect(panel.hasAttribute('data-drawer-no-drag')).toBe(true);
  });

  it('contained and not modal: no scrim, and Escape still closes it', async () => {
    const onOpenChange = vi.fn();
    render(
      <div style={{ position: 'relative' }}>
        <button type="button">Outside</button>
        <Sheet contained side="left" defaultOpen modal={false} onOpenChange={onOpenChange}>
          <SheetContent variant="panel" aria-label="Menu"><button type="button">Inside</button></SheetContent>
        </Sheet>
      </div>,
    );
    await settle();
    expect(screen.getByRole('dialog', { name: 'Menu' }).getAttribute('aria-modal')).toBeNull();
    expect(screen.getByRole('button', { name: 'Outside' }).closest('[inert]')).toBeNull();
    const inside = screen.getByRole('button', { name: 'Inside' });
    act(() => inside.focus());
    act(() => { fireEvent.keyDown(inside, { key: 'Escape' }); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('view: the SheetView and its title travel with the flow', async () => {
    function Flow() {
      const [step, setStep] = useState('pick');
      return (
        <Sheet defaultOpen view={step}>
          <SheetContent>
            {/* The title stays mounted outside the view and travels by itself. */}
            <SheetHeader><SheetTitle>{step === 'pick' ? 'Choose a plan' : 'Confirm'}</SheetTitle></SheetHeader>
            <SheetView>
              {step === 'pick' ? <Button onClick={() => setStep('confirm')}>Continue</Button> : <p>Billed today.</p>}
            </SheetView>
          </SheetContent>
        </Sheet>
      );
    }
    render(<BLProvider><Flow /></BLProvider>);
    await settle();
    expect(screen.getByRole('dialog', { name: 'Choose a plan' })).toBeTruthy();
    expect(document.querySelector('[data-slot=dialog-view]')?.getAttribute('data-view')).toBe('pick');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'Confirm' })).toBeTruthy();
    expect(document.querySelector('[data-slot=dialog-view]')?.getAttribute('data-view')).toBe('confirm');
    // Forward: the new step and the title came from the right (Swap hides the leaving ones; see swap.test).
    const swap = document.querySelector<HTMLElement>('[data-slot=swap]:has([data-slot=dialog-view])')!;
    expect(swap.style.getPropertyValue('--swap-enter')).toBe('40px');
    expect(document.querySelector<HTMLElement>('[data-slot=drawer-title] [data-slot=swap]')!.style.getPropertyValue('--swap-enter')).toBe('18px');
  });
});
