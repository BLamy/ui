// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  Conversation, ConversationComposer, ConversationEmpty, ConversationMessages, ConversationSuggestions,
  ConversationSuggestion, ConversationUserMessage,
} from '@/components/ui/conversation';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

/* happy-dom runs no CSS transitions, so every exit would end at once. Give the leaving parts one that ends when the
   test says, as a browser would report it. */
let end = () => {};
let restore = () => {};
beforeEach(() => {
  const finished = new Promise<void>((resolve) => { end = resolve; });
  const style = document.createElement('style');
  style.textContent = '* { transition-duration: 5s; transition-delay: 0s; animation-duration: 0s; animation-delay: 0s; animation-iteration-count: 1 }';
  document.head.append(style);
  const original = HTMLElement.prototype.getAnimations;
  HTMLElement.prototype.getAnimations = function () {
    return [{ transitionProperty: 'opacity', finished, finish: () => undefined, effect: null }] as unknown as Animation[];
  };
  restore = () => {
    HTMLElement.prototype.getAnimations = original;
    style.remove();
  };
});
afterEach(() => {
  cleanup();
  restore();
});

const greeting = () => screen.queryByText('What are we building?')?.closest<HTMLElement>('[data-slot=conversation-empty] > div') ?? null;
const chips = () => document.querySelector<HTMLElement>('[data-slot=conversation-suggestions] > div');

function Thread({ empty }: { empty: boolean }) {
  return (
    <Conversation empty={empty}>
      <ConversationEmpty title="What are we building?" />
      <ConversationMessages threadKey="t1">
        {empty ? null : <ConversationUserMessage key="u1">Build a map</ConversationUserMessage>}
      </ConversationMessages>
      <ConversationComposer>
        <textarea aria-label="Message" />
      </ConversationComposer>
      <ConversationSuggestions>
        <ConversationSuggestion>Plan a trip</ConversationSuggestion>
      </ConversationSuggestions>
    </Conversation>
  );
}

describe('Conversation', () => {
  it('shows the greeting and the suggestions while empty, with nothing playing on first paint', () => {
    render(<Thread empty />);
    expect(greeting()?.hasAttribute('data-starting-style')).toBe(false);
    expect(screen.getByRole('button', { name: 'Plan a trip' })).toBeTruthy();
    expect(document.querySelector('[data-slot=conversation]')?.hasAttribute('data-empty')).toBe(true);
    expect(document.querySelector('[data-slot=message-scroller]')).toBeNull();
  });

  it('starting the thread plays the greeting and suggestions out of the flow, keeps the same composer, and brings the messages in', async () => {
    const { rerender } = render(<Thread empty />);
    const message = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    message.value = 'draft';
    rerender(<Thread empty={false} />);
    // Leaving: the ending style, inert, and lifted out of the flow so the composer moves at once.
    const leaving = greeting()!;
    expect(leaving.hasAttribute('data-ending-style')).toBe(true);
    expect(leaving.inert).toBe(true);
    expect(leaving.className).toContain('absolute');
    expect(chips()?.hasAttribute('data-ending-style')).toBe(true);
    // The thread arrives.
    const thread = document.querySelector<HTMLElement>('[data-slot=conversation-messages] > div')!;
    expect(thread.hasAttribute('data-starting-style')).toBe(true);
    expect(screen.getByText('Build a map')).toBeTruthy();
    // The composer is the same element, draft intact.
    expect(screen.getByRole('textbox', { name: 'Message' })).toBe(message);
    expect(message.value).toBe('draft');
    // Once the exits finish, the parts unmount.
    await act(async () => { end(); await new Promise((r) => setTimeout(r, 30)); });
    expect(greeting()).toBeNull();
    expect(chips()).toBeNull();
  });

  it('brings the greeting back when the thread empties again', () => {
    const { rerender } = render(<Thread empty={false} />);
    expect(greeting()).toBeNull();
    rerender(<Thread empty />);
    expect(greeting()?.hasAttribute('data-starting-style')).toBe(true);
    expect(chips()?.hasAttribute('data-starting-style')).toBe(true);
  });

  it('names the empty state with a heading', () => {
    render(<Thread empty />);
    expect(screen.getByRole('heading', { level: 2, name: 'What are we building?' })).toBeTruthy();
  });
});

describe('ConversationUserMessage', () => {
  it('shows what the Composer sent: images by name, other files as chips', () => {
    render(
      <ConversationUserMessage
        attachments={[
          { id: 'i', name: 'shot.png', type: 'image/png', src: 'data:image/png;base64,AAAA' },
          { id: 'f', name: 'notes.pdf', type: 'application/pdf', size: 2048 },
        ]}
      >
        Look
      </ConversationUserMessage>,
    );
    expect(screen.getByRole('img', { name: 'shot.png' })).toBeTruthy();
    expect(screen.getByText('notes.pdf')).toBeTruthy();
  });
});
