// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Composer, ComposerCard, ComposerInput } from '@/components/ui/composer/composer';
import { FloatingChat, useFloatingChat } from '@/components/ui/floating-chat';
import { BLProvider } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

function Close() {
  const chat = useFloatingChat();
  return <button type="button" onClick={() => chat.setOpen(false)}>Done</button>;
}

const scrim = () => document.querySelector<HTMLElement>('[data-slot=floating-chat-scrim]');

function Chat(props: Parameters<typeof FloatingChat>[0]) {
  return (
    <BLProvider>
      <div style={{ position: 'relative', height: 640 }}>
        <FloatingChat hideOnScroll={false} {...props}>
          <FloatingChat.Chat><p>Three things changed.</p><Close /></FloatingChat.Chat>
          <FloatingChat.Composer>
            <Composer><ComposerCard><ComposerInput placeholder="Ask anything" /></ComposerCard></Composer>
          </FloatingChat.Composer>
        </FloatingChat>
      </div>
    </BLProvider>
  );
}

describe('FloatingChat', () => {
  it('turns the composer into a working status that brings it back when pressed', async () => {
    const onAdd = vi.fn();
    const onComposingChange = vi.fn();
    render(<Chat working workingLabel="Thinking…" onAdd={onAdd} onComposingChange={onComposingChange} />);
    await settle();
    const status = screen.getByRole('button', { name: /Thinking…/ });
    expect(status.textContent).toContain('Add something new');
    fireEvent.click(status);
    expect(onComposingChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(onComposingChange.mock.calls[0][1].event).toBeInstanceOf(Event);
    expect(onAdd).toHaveBeenCalledTimes(1);
    await settle();
    expect(screen.queryByRole('button', { name: /Thinking…/ })).toBeNull();
  });

  it('a canceled composing change keeps the working status', async () => {
    const onComposingChange = vi.fn((_c: boolean, details: { cancel: () => void }) => details.cancel());
    render(<Chat working workingLabel="Thinking…" onComposingChange={onComposingChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Thinking…/ }));
    await settle();
    expect(onComposingChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Thinking…/ })).toBeTruthy();
  });

  it('work starting and stopping hides and brings back an uncontrolled composer, reported as imperative', async () => {
    const onComposingChange = vi.fn();
    const { rerender } = render(<Chat onComposingChange={onComposingChange} />);
    await settle();
    expect(onComposingChange).not.toHaveBeenCalled();
    rerender(<Chat working workingLabel="Thinking…" onComposingChange={onComposingChange} />);
    await settle();
    expect(onComposingChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'imperative', source: 'programmatic' }));
    expect(screen.getByRole('button', { name: /Thinking…/ })).toBeTruthy();
  });

  it('keeps the FAB out of reach until the chat is folded into it, and unfolds from it', async () => {
    const onMinimizedChange = vi.fn();
    const { rerender } = render(<Chat minimized={false} onMinimizedChange={onMinimizedChange} />);
    await settle();
    const fab = () => document.querySelector<HTMLElement>('[aria-label="Open chat"]')!;
    expect(fab().className).toContain('pointer-events-none');
    rerender(<Chat minimized onMinimizedChange={onMinimizedChange} />);
    await settle();
    expect(fab().className).toContain('pointer-events-auto');
    fireEvent.click(fab());
    expect(onMinimizedChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
    expect(onMinimizedChange.mock.calls[0][1].event).toBeInstanceOf(Event);
  });

  it('a canceled unfold keeps the chat in its FAB', async () => {
    const onMinimizedChange = vi.fn((_m: boolean, details: { cancel: () => void }) => details.cancel());
    render(<Chat defaultMinimized onMinimizedChange={onMinimizedChange} />);
    await settle();
    const fab = document.querySelector<HTMLElement>('[aria-label="Open chat"]')!;
    fireEvent.click(fab);
    await settle();
    expect(onMinimizedChange).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-slot=floating-chat]')?.hasAttribute('data-minimized')).toBe(true);
  });

  it('opens from its handle and closes on an outside press, with the reason', async () => {
    const onOpenChange = vi.fn();
    render(<Chat onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }));
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'handle-press' }));
    expect(onOpenChange.mock.calls[0][1].event).toBeInstanceOf(Event);
    expect(document.querySelector('[data-slot=floating-chat]')?.hasAttribute('data-open')).toBe(true);
    // The scrim is decoration: no button, out of the tab order and the accessibility tree.
    expect(scrim()?.tagName).toBe('DIV');
    expect(scrim()?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    // A press on it is an outside press of the chat's layer.
    fireEvent.pointerDown(scrim()!, { button: 0, pointerType: 'mouse' });
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'outside-press' }));
    expect(document.querySelector('[data-slot=floating-chat]')?.hasAttribute('data-open')).toBe(false);
  });

  it('closes on Escape without moving focus, and a canceled change keeps it open', async () => {
    let cancel = true;
    const onOpenChange = vi.fn((_open: boolean, details: { cancel: () => void }) => {
      if (cancel) details.cancel();
    });
    render(<Chat defaultOpen onOpenChange={onOpenChange} />);
    await settle();
    const input = screen.getByRole('textbox');
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape' });
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    expect(document.querySelector('[data-slot=floating-chat]')?.hasAttribute('data-open')).toBe(true);
    cancel = false;
    fireEvent.keyDown(input, { key: 'Escape' });
    await settle();
    expect(document.querySelector('[data-slot=floating-chat]')?.hasAttribute('data-open')).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('reports a close from code as imperative', async () => {
    const onOpenChange = vi.fn();
    render(<Chat defaultOpen onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await settle();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'imperative', source: 'programmatic' }));
  });
});
