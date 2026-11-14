// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@ui-sdk/core/testing';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from '@/components/ui/tooltip';
import { BLProvider } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(() => { cleanup(); vi.useRealTimers(); });

const enter = (el: Element, pointerType = 'mouse') => fireEvent.pointerEnter(el, { pointerType });
const leave = (el: Element) => fireEvent.pointerLeave(el, { pointerType: 'mouse' });
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/* The parts settle on real timers (a tooltip decides a tick after mounting whether it names its trigger), then the
   test takes over the clock. */
async function mount(ui: Parameters<typeof render>[0], clock: 'real' | 'fake' = 'fake') {
  render(ui);
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  if (clock === 'fake') vi.useFakeTimers();
}
const tip = (text: string) => screen.getByText(text).closest<HTMLElement>('[data-slot=tooltip-content]')!;
const isOpen = (text: string) => tip(text).hasAttribute('data-open');

function Toolbar({ onOpenChange }: { onOpenChange?: Parameters<typeof Tooltip>[0]['onOpenChange'] }) {
  return (
    <div>
      <Tooltip onOpenChange={onOpenChange}>
        <TooltipTrigger aria-label="Bold">B</TooltipTrigger>
        <TooltipContent>Make the selection bold</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger><svg aria-hidden="true" /></TooltipTrigger>
        <TooltipContent arrow={false}>Italic</TooltipContent>
      </Tooltip>
    </div>
  );
}

describe('Tooltip', () => {
  it('names a trigger without a name and describes one that has its own', async () => {
    await mount(<Toolbar />, 'real');
    const [bold, italic] = screen.getAllByRole('button');
    expect(tip('Make the selection bold').getAttribute('role')).toBe('tooltip');
    expect(bold.getAttribute('aria-describedby')).toBe(tip('Make the selection bold').id);
    expect(italic.getAttribute('aria-labelledby')).toBe(tip('Italic').id);
    expect(screen.getByRole('button', { name: 'Italic' })).toBe(italic);
  });

  it('draws its arrow unless told not to', () => {
    render(<Toolbar />);
    expect(tip('Make the selection bold').querySelector('[data-slot=tooltip-arrow]')).not.toBeNull();
    expect(tip('Italic').querySelector('[data-slot=tooltip-arrow]')).toBeNull();
  });

  it('opens after half a second of hover, and never from touch', async () => {
    const onOpenChange = vi.fn();
    await mount(<Toolbar onOpenChange={onOpenChange} />);
    const bold = screen.getByRole('button', { name: 'Bold' });

    enter(bold, 'touch');
    wait(1000);
    expect(isOpen('Make the selection bold')).toBe(false);

    enter(bold);
    wait(400);
    expect(isOpen('Make the selection bold')).toBe(false);
    wait(150);
    expect(isOpen('Make the selection bold')).toBe(true);
    expect(tip('Make the selection bold').getAttribute('data-side')).toBe('top');
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'trigger-hover' }));
  });

  it('opens the next one at once while one is warm, and keeps one open at a time', async () => {
    await mount(<Toolbar />);
    const [bold, italic] = screen.getAllByRole('button');
    enter(bold);
    wait(550);
    leave(bold);
    enter(italic);
    wait(10);
    expect(isOpen('Italic')).toBe(true);
    expect(tip('Italic').hasAttribute('data-instant')).toBe(true);
    expect(isOpen('Make the selection bold')).toBe(false);
  });

  it('opens at once on keyboard focus and closes on Escape, leaving focus on the trigger', async () => {
    const onOpenChange = vi.fn();
    await mount(<Toolbar onOpenChange={onOpenChange} />);
    const bold = screen.getByRole('button', { name: 'Bold' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => { bold.focus(); });
    wait(10);
    expect(isOpen('Make the selection bold')).toBe(true);

    fireEvent.keyDown(bold, { key: 'Escape' });
    wait(10);
    expect(isOpen('Make the selection bold')).toBe(false);
    expect(document.activeElement).toBe(bold);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
  });

  it("renders into BLProvider's root and shows its shortcut", async () => {
    await mount(
      <BLProvider>
        <Tooltip shortcut="mod+s" defaultOpen>
          <TooltipTrigger>Save</TooltipTrigger>
          <TooltipContent>Save the file<TooltipShortcut /></TooltipContent>
        </Tooltip>
      </BLProvider>,
      'real',
    );
    const content = document.querySelector<HTMLElement>('[data-slot=tooltip-content]')!;
    expect(content.parentElement).toBe(document.querySelector('[data-slot=bl-provider]'));
    expect(content.querySelector('[data-slot=tooltip-shortcut]')?.textContent).toMatch(/(⌘|Ctrl\+)S/);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-keyshortcuts')).toBeTruthy();
  });

  it("puts a shortcut's modifiers in Apple's order", async () => {
    setPlatform('apple');
    await mount(
      <Tooltip shortcut="mod+shift+s" defaultOpen>
        <TooltipTrigger>Save As</TooltipTrigger>
        <TooltipContent>Save a copy<TooltipShortcut /></TooltipContent>
      </Tooltip>,
      'real',
    );
    setPlatform('other');
    expect(document.querySelector('[data-slot=tooltip-shortcut]')?.textContent).toBe('⇧⌘S');
  });
});
