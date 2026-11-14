// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Sheet, SheetBackdrop, SheetBody, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
  SheetTrigger, createSheetController,
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
    expect(dialog.className).toContain('rounded-t-card');
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
    expect(sheet()!.className).toContain('rounded-l-card');
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
});
