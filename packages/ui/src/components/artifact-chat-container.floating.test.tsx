// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Composer, ComposerCard, ComposerInput } from '@/components/ui/composer/composer';
import {
  ArtifactChatContainer,
  ArtifactChatContainerChat,
  ArtifactChatContainerComposer,
  ArtifactChatContainerContent,
  useArtifactChatContainer,
  type ArtifactChatContainerProps,
} from '@/components/ui/artifact-chat-container';
import { BLProvider } from '@/lib/theme';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* The floating layout: the chat is a FloatingSheet over the content (its body the transcript, its foot the
   composer), peeking, growing and folding into a FAB. */

/* happy-dom rejects a cancelled animation's `finished` promise whether or not anyone reads it; a browser doesn't. */
const animate = Element.prototype.animate;
Element.prototype.animate = function (...args: Parameters<typeof animate>) {
  const animation = animate.apply(this, args);
  animation.finished.catch(() => undefined);
  return animation;
};

/* happy-dom has no layout: give the sheet a phone-sized host to measure. */
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.slot === 'floating-sheet-footer' ? 72 : 640;
    },
  });
});
afterAll(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', offsetHeight);
});
afterEach(cleanup);

const settle = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

function Close() {
  const chat = useArtifactChatContainer();
  return <button type="button" onClick={() => chat.setOpen(false)}>Done</button>;
}

const sheet = () => document.querySelector<HTMLElement>('[data-slot=floating-sheet]')!;
const scrim = () => document.querySelector<HTMLElement>('[data-slot=drawer-backdrop]');
const fab = () => document.querySelector<HTMLElement>('[aria-label="Open Chat"]')!;

function Chat(props: Partial<ArtifactChatContainerProps>) {
  return (
    <BLProvider>
      <div style={{ position: 'relative', height: 640 }}>
        <ArtifactChatContainer layout="floating" hideOnScroll={false} {...props}>
          <ArtifactChatContainerContent><p>Map</p></ArtifactChatContainerContent>
          <ArtifactChatContainerChat><p>Three things changed.</p><Close /></ArtifactChatContainerChat>
          <ArtifactChatContainerComposer>
            <Composer><ComposerCard><ComposerInput placeholder="Ask anything" /></ComposerCard></Composer>
          </ArtifactChatContainerComposer>
        </ArtifactChatContainer>
      </div>
    </BLProvider>
  );
}

describe('ArtifactChatContainer floating', () => {
  it('floats the chat as a sheet: the transcript in its body, the composer in its foot', async () => {
    render(<Chat />);
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Chat' });
    expect(dialog.querySelector('[data-slot=floating-sheet-body]')?.textContent).toContain('Three things changed.');
    expect(dialog.querySelector('[data-slot=floating-sheet-footer]')?.contains(screen.getByRole('textbox'))).toBe(true);
    // The composer wears the glass scope, in the page's appearance by default.
    expect(screen.getByRole('textbox').closest('[data-theme-scope=glass]')).not.toBeNull();
    // The content is not a landmark of its own.
    expect(document.querySelector('main')).toBeNull();
  });

  it('paints only the chat in an explicit appearance, never the artifact', async () => {
    render(<Chat appearance="dark" />);
    await settle();
    const content = document.querySelector<HTMLElement>('[data-slot=artifact-chat-content]')!;
    expect(content.closest('[data-theme-scope]')).toBeNull();
    expect(content.closest('.dark')).toBeNull();
    // The sheet and the composer's glass are dark.
    expect(screen.getByRole('textbox').closest('.dark')).not.toBeNull();
    expect(sheet().classList.contains('dark')).toBe(true);
  });

  it('turns the composer into a working status that brings it back when pressed', async () => {
    const onComposingChange = vi.fn();
    render(<Chat working workingLabel="Thinking…" onComposingChange={onComposingChange} />);
    await settle();
    const status = screen.getByRole('button', { name: 'Write a message' });
    // Named for its action; the status is its description.
    expect(document.getElementById(status.getAttribute('aria-describedby')!)?.textContent).toBe('Thinking…');
    fireEvent.click(status);
    expect(onComposingChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'trigger-press' }));
    expect(onComposingChange.mock.calls[0][1].event).toBeInstanceOf(Event);
    await settle();
    expect(screen.queryByRole('button', { name: 'Write a message' })).toBeNull();
  });

  it('a canceled composing change keeps the working status', async () => {
    const onComposingChange = vi.fn((_c: boolean, details: { cancel: () => void }) => details.cancel());
    render(<Chat working workingLabel="Thinking…" onComposingChange={onComposingChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Write a message' }));
    await settle();
    expect(onComposingChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Write a message' })).toBeTruthy();
  });

  it('work starting and stopping hides and brings back an uncontrolled composer, reported as imperative', async () => {
    const onComposingChange = vi.fn();
    const { rerender } = render(<Chat onComposingChange={onComposingChange} />);
    await settle();
    expect(onComposingChange).not.toHaveBeenCalled();
    rerender(<Chat working workingLabel="Thinking…" onComposingChange={onComposingChange} />);
    await settle();
    expect(onComposingChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'imperative', source: 'programmatic' }));
    expect(screen.getByRole('button', { name: 'Write a message' })).toBeTruthy();
  });

  it('keeps the FAB out of reach until the chat is folded into it, and unfolds from it', async () => {
    const onMinimizedChange = vi.fn();
    const { rerender } = render(<Chat minimized={false} onMinimizedChange={onMinimizedChange} />);
    await settle();
    expect(fab().hasAttribute('inert')).toBe(true);
    expect(fab().getAttribute('aria-hidden')).toBe('true');
    rerender(<Chat minimized onMinimizedChange={onMinimizedChange} />);
    await settle();
    expect(fab().hasAttribute('inert')).toBe(false);
    expect(fab().hasAttribute('aria-hidden')).toBe(false);
    fireEvent.click(fab());
    expect(onMinimizedChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'trigger-press' }));
    expect(onMinimizedChange.mock.calls[0][1].event).toBeInstanceOf(Event);
  });

  it('a canceled unfold keeps the chat in its FAB', async () => {
    const onMinimizedChange = vi.fn((_m: boolean, details: { cancel: () => void }) => details.cancel());
    render(<Chat defaultMinimized onMinimizedChange={onMinimizedChange} />);
    await settle();
    fireEvent.click(fab());
    await settle();
    expect(onMinimizedChange).toHaveBeenCalledTimes(1);
    expect(sheet().hasAttribute('data-minimized')).toBe(true);
  });

  it('grows from its cap over a decorative scrim, with the reason', async () => {
    const onOpenChange = vi.fn();
    render(<Chat onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    await settle();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'handle-press' }));
    expect(onOpenChange.mock.calls[0][1].event).toBeInstanceOf(Event);
    expect(sheet().hasAttribute('data-open')).toBe(true);
    // The scrim is decoration: no button, out of the accessibility tree. (A press on it is the drawer's outside
    // press, which needs layout to know the sheet is modal: checked in the browser, not here.)
    expect(scrim()?.getAttribute('role')).toBe('presentation');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse' })).toBeTruthy();
  });

  it('comes back to rest on Escape without moving focus, and a canceled change keeps it grown', async () => {
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
    expect(sheet().hasAttribute('data-open')).toBe(true);
    cancel = false;
    fireEvent.keyDown(input, { key: 'Escape' });
    await settle();
    expect(sheet().hasAttribute('data-open')).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('reports a close from code as imperative', async () => {
    const onOpenChange = vi.fn();
    render(<Chat defaultOpen onOpenChange={onOpenChange} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await settle();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'imperative', source: 'programmatic' }));
    expect(sheet().hasAttribute('data-open')).toBe(false);
  });

  it('places its FAB by side and align, with a face of its own', async () => {
    render(<Chat defaultMinimized fabSide="end" fabAlign="end" fabIcon={<span>AI</span>} />);
    await settle();
    expect(fab().className).toContain('end-(--fs-fab-gutter)');
    expect(fab().textContent).toBe('AI');
  });
});
