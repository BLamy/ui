// @vitest-environment happy-dom
import type * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend } from './composer';
import { ComposerCards, ComposerMorphCard, ComposerQueue, type ComposerQueueItem } from './composer-cards';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);

/* happy-dom runs no CSS transitions, so every exit would finish at once. Give each element a 30 ms transition, as a
   browser would report it, so the tests see the morph while it plays. */
let restore: () => void = () => {};
beforeEach(() => {
  const style = document.createElement('style');
  style.textContent = '* { transition-duration: 0.03s; transition-delay: 0s; animation-duration: 0s; animation-delay: 0s; animation-iteration-count: 1 }';
  document.head.append(style);
  const original = HTMLElement.prototype.getAnimations;
  HTMLElement.prototype.getAnimations = function () {
    const finished = new Promise<void>((resolve) => setTimeout(resolve, 30));
    return [{ transitionProperty: 'height', finished, finish: () => undefined, effect: { getComputedTiming: () => ({ endTime: 30, localTime: 0 }) } }] as unknown as Animation[];
  };
  restore = () => {
    HTMLElement.prototype.getAnimations = original;
    style.remove();
  };
});
afterEach(() => restore());

const frames = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 150)); });
const frameOf = (text: string) => screen.getByText(text).closest<HTMLElement>('[data-slot="composer-morph-frame"]')!;

function Tray({ cards, onExited }: { cards: string[]; onExited?: (key: string) => void }) {
  return (
    <>
      <Composer>
        <ComposerCards side="top">
          {cards.map((card) => (
            <ComposerMorphCard key={card} onExited={() => onExited?.(card)}>
              {card}
            </ComposerMorphCard>
          ))}
        </ComposerCards>
        <ComposerCard />
      </Composer>
    </>
  );
}

describe('ComposerCards', () => {
  it('shows the cards it mounts with at rest, without a morph', () => {
    render(<Tray cards={['a']} />);
    const frame = frameOf('a');
    expect(frame.hasAttribute('data-morphing')).toBe(false);
    expect(frame.hasAttribute('data-starting-style')).toBe(false);
  });

  it('morphs an added card out (data-starting-style), then rests', async () => {
    const { rerender } = render(<Tray cards={[]} />);
    rerender(<Tray cards={['a']} />);
    const frame = frameOf('a');
    expect(frame.hasAttribute('data-morphing')).toBe(true);
    expect(frame.hasAttribute('data-starting-style')).toBe(true);
    await frames();
    expect(frame.hasAttribute('data-morphing')).toBe(false);
  });

  it('keeps a removed card, inert, until it has sunk back (data-ending-style), then calls onExited', async () => {
    const onExited = vi.fn();
    const { rerender } = render(<Tray cards={['a', 'b']} onExited={onExited} />);
    rerender(<Tray cards={['a']} onExited={onExited} />);
    const frame = frameOf('b');
    const card = frame.querySelector<HTMLElement>('[data-slot="composer-morph-card"]')!;
    expect(frame.hasAttribute('data-ending-style')).toBe(true);
    expect(card.inert).toBe(true);
    // UI SDK's vocabulary only: no `data-state="closing"`.
    expect(card.hasAttribute('data-state')).toBe(false);
    expect(onExited).not.toHaveBeenCalled();
    await frames();
    expect(onExited).toHaveBeenCalledWith('b');
    expect(screen.queryByText('b')).toBeNull();
    expect(screen.getByText('a')).toBeTruthy();
  });
});

describe('ComposerQueue', () => {
  const queued = (...ids: string[]): ComposerQueueItem[] => ids.map((id) => ({ id, markdown: `message ${id}`, attachments: [] }));
  const Queue = (props: React.ComponentProps<typeof ComposerQueue>) => (
    <Composer streaming>
      <ComposerQueue {...props} />
      <ComposerCard>
        <ComposerInput aria-label="Message" />
        <ComposerFooter>
          <ComposerSend />
        </ComposerFooter>
      </ComposerCard>
    </Composer>
  );
  const cardOf = (id: string) => document.querySelector<HTMLElement>(`[data-queue-id="${id}"]`)!;
  const button = (id: string, name: string) => within(cardOf(id)).getByRole('button', { name });
  const editor = () =>
    waitFor(() => {
      const el = document.querySelector<HTMLElement>('[contenteditable="true"][aria-label="Message"]');
      expect(el).toBeTruthy();
      return el!;
    });

  it('removes a queued message with its remove button, as a controlled list, reporting why', async () => {
    const onItemsChange = vi.fn();
    render(<Queue items={queued('q1')} onItemsChange={onItemsChange} />);
    expect(screen.getByRole('list', { name: 'Queued messages' }).querySelectorAll('[role="listitem"]')).toHaveLength(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove from queue' })); });
    await waitFor(() => expect(onItemsChange).toHaveBeenCalledWith([], expect.objectContaining({ reason: 'remove', event: expect.objectContaining({ type: 'click' }) })));
  });

  it('keeps a card when onItemsChange cancels its removal', async () => {
    render(<Queue defaultItems={queued('q1')} onItemsChange={(_, details) => details.cancel()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove from queue' })); });
    await frames();
    expect(cardOf('q1')).toBeTruthy();
    expect(cardOf('q1').inert).toBe(false);
  });

  it('hands focus to the same button on the next card, then the previous, then the editor, as cards leave', async () => {
    render(<Queue defaultItems={queued('q1', 'q2', 'q3')} />);
    const input = await editor();
    // Above the composer the newest sits outermost: DOM order q3, q2, q1.
    const remove = button('q2', 'Remove from queue');
    remove.focus();
    await act(async () => { fireEvent.click(remove); });
    await waitFor(() => expect(document.activeElement).toBe(button('q1', 'Remove from queue')));
    // The last card in the tray: focus goes back to the one before it.
    await act(async () => { fireEvent.click(button('q1', 'Remove from queue')); });
    await waitFor(() => expect(document.activeElement).toBe(button('q3', 'Remove from queue')));
    // Sending the only card left hands focus to the editor.
    await act(async () => { fireEvent.click(button('q3', 'Send now')); });
    await waitFor(() => expect(document.activeElement).toBe(input));
    await frames();
  });

  it('moves focus to the editor when a card is taken back to edit', async () => {
    const onItemsChange = vi.fn();
    render(<Queue defaultItems={queued('q1', 'q2')} onItemsChange={onItemsChange} />);
    const input = await editor();
    const edit = button('q2', 'Edit queued message');
    edit.focus();
    await act(async () => { fireEvent.click(edit); });
    expect(onItemsChange).toHaveBeenLastCalledWith(queued('q1'), expect.objectContaining({ reason: 'edit' }));
    await waitFor(() => expect(document.activeElement).toBe(input));
    await frames();
  });
});
