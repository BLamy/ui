// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { buttonVariants } from '@/components/ui/button';
import {
  Popover, PopoverArrow, PopoverClose, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger, createPopoverController,
} from '@/components/ui/popover';
import { BLProvider, ThemeScope } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const content = () => document.querySelector<HTMLElement>('[data-slot=popover-content]');

function Share(props: Parameters<typeof Popover>[0]) {
  return (
    <Popover {...props}>
      <PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>Share</PopoverTrigger>
      <PopoverContent align="start">
        <PopoverArrow />
        <PopoverTitle>Share this document</PopoverTitle>
        <PopoverDescription>Anyone with the link can view it.</PopoverDescription>
        <PopoverClose>Done</PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('opens from its trigger as a dialog named by its title, and focus moves in', async () => {
    const onOpenChange = vi.fn();
    render(<Share onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Share' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(content()).toBeNull();

    fireEvent.click(trigger);
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Share this document' });
    expect(dialog).toBe(content());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
    expect(dialog.getAttribute('data-side')).toBe('bottom');
    expect(dialog.getAttribute('data-align')).toBe('start');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(dialog.querySelector('[data-slot=popover-arrow]')?.getAttribute('data-side')).toBe('bottom');
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
  });

  it('closes on Escape and from a Close part, and gives focus back to the trigger', async () => {
    const onOpenChange = vi.fn();
    render(<Share onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Share' });

    fireEvent.click(trigger);
    await settle();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(content()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));

    fireEvent.click(trigger);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await settle();
    expect(content()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press' }));
  });

  it('stays open when a change is cancelled', async () => {
    render(<Share defaultOpen onOpenChange={(open, details) => { if (!open) details.cancel(); }} />);
    await settle();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await settle();
    expect(content()).not.toBeNull();
  });

  it("renders into BLProvider's root, unless it is given a container of its own", async () => {
    const { unmount } = render(<BLProvider><div data-testid="page"><Share defaultOpen /></div></BLProvider>);
    await settle();
    expect(content()!.parentElement).toBe(document.querySelector('[data-slot=bl-provider]'));
    unmount();

    const elsewhere = document.body.appendChild(document.createElement('div'));
    render(<BLProvider><Share defaultOpen container={elsewhere} /></BLProvider>);
    await settle();
    expect(content()!.parentElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('wears the ThemeScope it opened in', async () => {
    render(
      <BLProvider>
        <ThemeScope scope="workbench" appearance="dark" tint="tomato"><Share defaultOpen /></ThemeScope>
      </BLProvider>,
    );
    await settle();
    const el = content()!;
    expect(el.getAttribute('data-theme-scope')).toBe('workbench');
    expect(el.classList.contains('dark')).toBe(true);
    expect(el.style.getPropertyValue('--primary')).toBe('tomato');
  });

  it('serves triggers elsewhere on the page through a controller, with their payload', async () => {
    const editor = createPopoverController<string>();
    render(
      <>
        <PopoverTrigger controller={editor} payload="Notes">Edit notes</PopoverTrigger>
        <PopoverTrigger controller={editor} payload="Tasks">Edit tasks</PopoverTrigger>
        <Popover controller={editor}>
          <PopoverContent<string> variant="surface">
            {(state) => <PopoverTitle>Edit {state.payload}</PopoverTitle>}
          </PopoverContent>
        </Popover>
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit tasks' }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'Edit Tasks' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit tasks' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Edit notes' }).getAttribute('aria-expanded')).toBe('false');
    act(() => { editor.close(); });
    await settle();
    expect(content()).toBeNull();
  });
});
