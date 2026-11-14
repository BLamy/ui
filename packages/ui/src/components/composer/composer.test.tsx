// @vitest-environment happy-dom
import type * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Composer,
  ComposerAdd,
  ComposerAttachments,
  ComposerBump,
  ComposerBumpContent,
  ComposerBumpHandle,
  ComposerCard,
  ComposerExpand,
  ComposerFooter,
  ComposerInput,
  ComposerSelect,
  ComposerSend,
  ComposerSeparator,
  ComposerStop,
  AnnotateLightbox,
  type ComposerAttachment,
} from './composer';
import { ComposerQueue } from './composer-cards';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
afterEach(cleanup);

// Behavior, not motion: the shape morphs (framer-motion on happy-dom's Web Animations) stay out of these tests.
const matchMedia = window.matchMedia.bind(window);
window.matchMedia = (query: string) => (query.includes('prefers-reduced-motion') ? { ...matchMedia(query), matches: true } : matchMedia(query));

const attr = (el: Element | null, name: string) => el?.getAttribute(name) ?? null;
const has = (el: Element | null, name: string) => !!el?.hasAttribute(name);
/** Lets UI SDK commit what an event started (focus moves and popups settle a tick later). */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
/** Presses a key on whatever has focus. */
const key = async (k: string) => { fireEvent.keyDown(document.activeElement ?? document.body, { key: k }); await settle(); };

const file = (name: string, type: string, body = 'x') => new File([body], name, { type });

/** A drag event carrying files, as the OS sends one. */
function dropFiles(target: Element, files: File[], point = { clientX: 0, clientY: 0 }) {
  const dataTransfer = { files, items: [], types: ['Files'], dropEffect: 'none', effectAllowed: 'all', getData: () => '' };
  fireEvent.dragEnter(target, { dataTransfer, ...point });
  fireEvent.dragOver(target, { dataTransfer, ...point });
  fireEvent.drop(target, { dataTransfer, ...point });
}

describe('Composer', () => {
  it('sends the draft and clears it; send is disabled while there is nothing to send', async () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <Composer value="" onSubmit={onSubmit}>
        <ComposerCard>
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    const send = screen.getByRole('button', { name: 'Send' });
    expect(has(send, 'data-disabled')).toBe(true);
    const onValueChange = vi.fn();
    rerender(
      <Composer value="  hello  " onValueChange={onValueChange} onSubmit={onSubmit}>
        <ComposerCard>
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    expect(has(send, 'data-disabled')).toBe(false);
    await act(async () => { fireEvent.click(send); });
    expect(onSubmit).toHaveBeenCalledWith('hello', []);
    // One change, the send's: clearing the editor doesn't echo an `input-change`.
    expect(onValueChange.mock.calls).toEqual([['', expect.objectContaining({ reason: 'send' })]]);
  });

  it('turns send into stop while streaming, and shows ComposerStop only then', async () => {
    const onStop = vi.fn();
    const { rerender } = render(
      <Composer streaming onStop={onStop}>
        <ComposerCard>
          <ComposerFooter>
            <ComposerStop variant="solid" />
            <ComposerSend morph={false} />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Stop' })); });
    expect(onStop).toHaveBeenCalledTimes(1);
    rerender(
      <Composer streaming={false} onStop={onStop}>
        <ComposerCard>
          <ComposerFooter>
            <ComposerStop variant="solid" />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull());
    rerender(
      <Composer streaming onStop={onStop}>
        <ComposerCard>
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    const morphed = screen.getByRole('button', { name: 'Stop' });
    expect(attr(morphed, 'data-state')).toBe('stop');
  });

  it('attaches files dropped on the card, and turns away the ones it does not take', async () => {
    const onAttachmentsChange = vi.fn();
    const onFilesRejected = vi.fn();
    const onDropFiles = vi.fn();
    render(
      <Composer acceptedFileTypes={['.pdf', 'text/*']} onAttachmentsChange={onAttachmentsChange} onFilesRejected={onFilesRejected} onDropFiles={onDropFiles}>
        <ComposerCard>
          <ComposerAttachments />
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    const card = document.querySelector('[data-slot="composer-card"]')!;
    await act(async () => dropFiles(card, [file('spec.pdf', 'application/pdf'), file('song.mp3', 'audio/mpeg')]));
    await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalled());
    expect(onDropFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'spec.pdf' })], 'drop');
    expect(onFilesRejected).toHaveBeenCalledWith([expect.objectContaining({ reason: 'type' })]);
    const attached = onAttachmentsChange.mock.lastCall![0] as ComposerAttachment[];
    expect(attached.map((a) => a.name)).toEqual(['spec.pdf']);
    expect(onAttachmentsChange.mock.lastCall![1]).toMatchObject({ reason: 'drop', event: expect.objectContaining({ type: 'drop' }) });
    expect(await screen.findByRole('button', { name: /^Open spec\.pdf/ })).toBeTruthy();
    expect(has(screen.getByRole('button', { name: 'Send' }), 'data-disabled')).toBe(false);
  });

  it('attaches files pasted while focus is in the card', async () => {
    const onDropFiles = vi.fn();
    render(
      <Composer onDropFiles={onDropFiles}>
        <ComposerCard>
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    const send = screen.getByRole('button', { name: 'Send' });
    const clipboardData = { files: [file('notes.txt', 'text/plain')], items: [], types: ['Files'], getData: () => '' };
    await act(async () => {
      fireEvent.paste(send, { clipboardData });
    });
    await waitFor(() => expect(onDropFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'notes.txt' })], 'paste'));
  });

  it('attaches what the "+" picker chose', async () => {
    const onDropFiles = vi.fn();
    render(
      <Composer onDropFiles={onDropFiles}>
        <ComposerCard>
          <ComposerFooter>
            <ComposerAdd />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    expect(screen.getByRole('button', { name: 'Add files' })).toBeTruthy();
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.multiple).toBe(true);
    await act(async () => { fireEvent.change(input, { target: { files: [file('a.md', 'text/markdown')] } }); });
    await waitFor(() => expect(onDropFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'a.md' })], 'picker'));
  });

  it('removes a tile with its ✕ and with Backspace, handing focus to a neighbour', async () => {
    const attachments: ComposerAttachment[] = [
      { id: 'a', name: 'a.pdf', type: 'application/pdf', size: 10 },
      { id: 'b', name: 'b.pdf', type: 'application/pdf', size: 10 },
      { id: 'c', name: 'c.pdf', type: 'application/pdf', size: 10 },
    ];
    const onAttachmentsChange = vi.fn();
    render(
      <Composer defaultAttachments={attachments} onAttachmentsChange={onAttachmentsChange}>
        <ComposerCard>
          <ComposerAttachments />
        </ComposerCard>
      </Composer>,
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove a.pdf' })); });
    expect(onAttachmentsChange.mock.lastCall![0].map((a: ComposerAttachment) => a.id)).toEqual(['b', 'c']);
    expect(onAttachmentsChange.mock.lastCall![1]).toMatchObject({ reason: 'remove', event: expect.objectContaining({ type: 'click' }) });
    const b = screen.getByRole('button', { name: /^Open b\.pdf/ });
    b.focus();
    await key('Backspace');
    expect(onAttachmentsChange.mock.lastCall![0].map((a: ComposerAttachment) => a.id)).toEqual(['c']);
    expect(onAttachmentsChange.mock.lastCall![1]).toMatchObject({ reason: 'remove', event: expect.objectContaining({ type: 'keydown' }) });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Open c\.pdf/ }));
  });

  it('chooses an option from a ComposerSelect menu with the keyboard', async () => {
    const onValueChange = vi.fn();
    render(
      <Composer>
        <ComposerCard>
          <ComposerFooter>
            <ComposerSelect
              aria-label="Effort"
              options={[
                { id: 'low', label: 'Low' },
                { id: 'high', label: 'High', description: 'Thinks longer' },
              ]}
              onValueChange={onValueChange}
            />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    const trigger = screen.getByRole('button', { name: 'Effort: Low' });
    trigger.focus();
    await key('ArrowDown');
    // Named by its trigger.
    const menu = screen.getByRole('menu', { name: 'Effort: Low' });
    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(2);
    expect(attr(items[0], 'aria-checked')).toBe('true');
    expect(menu).toBeTruthy();
    await key('ArrowDown');
    await waitFor(() => expect(has(items[1], 'data-highlighted')).toBe(true));
    await key('Enter');
    expect(onValueChange).toHaveBeenCalledWith('high', expect.objectContaining({ reason: expect.any(String) }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Effort: High' })).toBeTruthy());
    // Let the label's text morph finish before unmounting.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1200)); });
  });

  it('keeps an uncontrolled tile when onAttachmentsChange cancels its removal', async () => {
    render(
      <Composer defaultAttachments={[{ id: 'a', name: 'a.pdf', type: 'application/pdf', size: 10 }]} onAttachmentsChange={(_, details) => details.cancel()}>
        <ComposerCard>
          <ComposerAttachments />
        </ComposerCard>
      </Composer>,
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove a.pdf' })); });
    await settle();
    expect(screen.getByRole('button', { name: /^Open a\.pdf/ })).toBeTruthy();
  });

  it('lets a ComposerSelect consumer cancel before an uncontrolled pill commits', async () => {
    const onValueChange = vi.fn((_: string, details: { cancel: () => void }) => details.cancel());
    render(
      <Composer>
        <ComposerCard>
          <ComposerFooter>
            <ComposerSelect aria-label="Effort" options={[{ id: 'low', label: 'Low' }, { id: 'high', label: 'High' }]} onValueChange={onValueChange} />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    screen.getByRole('button', { name: 'Effort: Low' }).focus();
    await key('ArrowDown');
    await key('ArrowDown');
    await key('Enter');
    expect(onValueChange).toHaveBeenCalledWith('high', expect.anything());
    await settle();
    expect(screen.getByRole('button', { name: 'Effort: Low' })).toBeTruthy();
  });

  it('toggles the tall mode with ComposerExpand', async () => {
    const onExpandedChange = vi.fn();
    render(
      <Composer onExpandedChange={onExpandedChange}>
        <ComposerCard>
          <ComposerExpand />
        </ComposerCard>
      </Composer>,
    );
    const expand = screen.getByRole('button', { name: 'Expand composer' });
    expect(attr(expand, 'aria-pressed')).toBe('false');
    await act(async () => { fireEvent.click(expand); });
    expect(onExpandedChange).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'press' }));
    expect(attr(screen.getByRole('button', { name: 'Collapse composer' }), 'aria-pressed')).toBe('true');
    expect(has(document.querySelector('[data-slot="composer"]'), 'data-expanded')).toBe(true);
  });

  it('opens a draggable bump from its grip, and Escape closes it', async () => {
    const onOpenChange = vi.fn();
    render(
      <Composer>
        <ComposerBump side="top" draggable onOpenChange={onOpenChange} maxReveal={200}>
          <ComposerBumpContent label="Transcript">Messages</ComposerBumpContent>
          <ComposerBumpHandle label="Chat" />
        </ComposerBump>
        <ComposerCard />
      </Composer>,
    );
    const grip = screen.getByRole('button', { name: 'Chat' });
    expect(attr(grip, 'aria-expanded')).toBe('false');
    const region = document.getElementById(grip.getAttribute('aria-controls')!)!;
    expect(attr(region, 'aria-hidden')).toBe('true');
    await act(async () => { fireEvent.click(grip); });
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'press' }));
    expect(attr(grip, 'aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: 'Transcript' })).toBeTruthy();
    await key('Escape');
    // bindLayer's reason and event reach the consumer.
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key', event: expect.any(KeyboardEvent) }));
    expect(attr(grip, 'aria-expanded')).toBe('false');
  });

  it('opens an image attachment in the preview dialog, and closes it', async () => {
    render(
      <Composer annotator={null} defaultAttachments={[{ id: 'img', name: 'shot.png', type: 'image/png', src: 'data:image/png;base64,AAAA' }]}>
        <ComposerCard>
          <ComposerAttachments />
        </ComposerCard>
      </Composer>,
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Preview shot.png' })); });
    const dialog = await screen.findByRole('dialog', { name: 'Preview image' });
    expect(dialog).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Close' })); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 });
  });

  it('queues a draft sent while a reply streams, and sends it when the reply ends', async () => {
    const onSubmit = vi.fn();
    const ui = (streaming: boolean, value: string) => (
      <Composer streaming={streaming} value={value} onSubmit={onSubmit}>
        <ComposerQueue />
        <ComposerCard>
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    );
    const { rerender } = render(ui(true, 'follow up'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Queue message' })); });
    expect(onSubmit).not.toHaveBeenCalled();
    const queue = screen.getByRole('list', { name: 'Queued messages' });
    expect(queue.querySelectorAll('[role="listitem"]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove from queue' })).toBeTruthy();
    rerender(ui(false, ''));
    // The card merges back in (its exit plays), then the message goes to onSubmit.
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('follow up', []));
    await waitFor(() => expect(queue.querySelectorAll('[role="listitem"]')).toHaveLength(0));
  });

  it('a queue that refuses the draft keeps it: the text, the editor and the attachments stay, nothing is sent', async () => {
    const onSubmit = vi.fn();
    const values: string[] = [];
    const tile: ComposerAttachment = { id: 't', name: 't.pdf', type: 'application/pdf', size: 10 };
    const queued = vi.fn();
    render(
      <Composer streaming defaultValue="keep me" defaultAttachments={[tile]} onSubmit={onSubmit} onValueChange={(v) => values.push(v)}>
        <ComposerQueue onItemsChange={(_, d) => { queued(d.reason, d.event?.type); if (d.reason === 'queue') d.cancel(); }} />
        <ComposerCard><ComposerAttachments /><ComposerInput /><ComposerFooter><ComposerSend /></ComposerFooter></ComposerCard>
      </Composer>,
    );
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeTruthy());
    await settle();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Queue message' })); });
    await settle();
    // The queue's change carries the click.
    expect(queued).toHaveBeenCalledWith('queue', 'click');
    expect(values.at(-1)).toBe('keep me');
    expect(document.querySelector('[contenteditable="true"]')!.textContent).toBe('keep me');
    expect(screen.getByRole('button', { name: 'Remove t.pdf' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Queued messages' })?.querySelectorAll('[role="listitem"]').length ?? 0).toBe(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a send whose draft change is canceled sends nothing and keeps the editor as it was', async () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn((_: string, d: { reason: string; event?: Event; cancel: () => void }) => { if (d.reason === 'send') d.cancel(); });
    render(
      <Composer defaultValue="hello" onSubmit={onSubmit} onValueChange={onValueChange}>
        <ComposerCard><ComposerInput /><ComposerFooter><ComposerSend /></ComposerFooter></ComposerCard>
      </Composer>,
    );
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeTruthy());
    await settle();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send' })); });
    await settle();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.querySelector('[contenteditable="true"]')!.textContent).toBe('hello');
    // The send's change carries the click that asked for it.
    expect(onValueChange.mock.calls[0]![1]).toMatchObject({ reason: 'send', event: expect.objectContaining({ type: 'click' }) });
  });

  it('a send from Enter carries the key in its details', async () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    render(
      <Composer defaultValue="hello" onSubmit={onSubmit} onValueChange={onValueChange}>
        <ComposerCard><ComposerInput /></ComposerCard>
      </Composer>,
    );
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).toBeTruthy());
    await settle();
    const editable = document.querySelector('[contenteditable="true"]') as HTMLElement;
    act(() => editable.focus());
    await act(async () => { fireEvent.keyDown(editable, { key: 'Enter', metaKey: true }); });
    expect(onSubmit).toHaveBeenCalledWith('hello', []);
    expect(onValueChange.mock.lastCall![1]).toMatchObject({ reason: 'send', event: expect.objectContaining({ type: 'keydown' }) });
  });

  it('removing an image with its ✕ asks once, with the click, and a canceled removal keeps the tile and its chip', async () => {
    const img: ComposerAttachment = { id: 'i1', name: 'shot.png', type: 'image/png', size: 10, src: 'data:image/png;base64,AAAA' };
    const calls: [number, string, string | null][] = [];
    let refuse = true;
    render(
      <Composer
        defaultValue="hi ![shot.png](attachment:i1) there"
        defaultAttachments={[img]}
        onAttachmentsChange={(a, d) => { calls.push([a.length, d.reason, d.event?.type ?? null]); if (refuse) d.cancel(); }}
      >
        <ComposerCard><ComposerAttachments /><ComposerInput /></ComposerCard>
      </Composer>,
    );
    await waitFor(() => expect(document.querySelector('[contenteditable="true"] [data-attachment-id]')).toBeTruthy());
    await settle();
    const chips = () => document.querySelectorAll('[contenteditable="true"] [data-attachment-id]').length;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove shot.png' })); });
    await settle();
    expect(calls).toEqual([[0, 'remove', 'click']]);
    expect(chips()).toBe(1);
    expect(screen.getByRole('button', { name: 'Remove shot.png' })).toBeTruthy();
    refuse = false;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove shot.png' })); });
    await settle();
    expect(calls).toEqual([[0, 'remove', 'click'], [0, 'remove', 'click']]);
    expect(chips()).toBe(0);
    expect(screen.queryByRole('button', { name: 'Remove shot.png' })).toBeNull();
  });

  it('pulls a draggable bump open with a flick of its handle (bindDrag + release velocity)', async () => {
    const onOpenChange = vi.fn();
    render(
      <Composer>
        <ComposerBump side="top" draggable onOpenChange={onOpenChange} maxReveal={200}>
          <ComposerBumpContent label="Transcript">Messages</ComposerBumpContent>
          <ComposerBumpHandle label="Chat">Row</ComposerBumpHandle>
        </ComposerBump>
        <ComposerCard />
      </Composer>,
    );
    const row = screen.getByText('Row');
    // A flick is distance over time, so the test owns the clock: one frame (16ms) between samples however
    // slowly the machine runs them.
    let now = performance.now();
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
    const pointer = (type: string, clientY: number) => {
      now += 16;
      return new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 10, clientY });
    };
    await act(async () => { row.dispatchEvent(pointer('pointerdown', 300)); });
    for (const y of [290, 260, 220, 180]) await act(async () => { document.dispatchEvent(pointer('pointermove', y)); });
    expect(has(document.querySelector('[data-slot="composer-bump"]'), 'data-dragging')).toBe(true);
    await act(async () => { document.dispatchEvent(pointer('pointerup', 180)); });
    clock.mockRestore();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ reason: 'drag' }));
    expect(attr(screen.getByRole('button', { name: 'Chat' }), 'aria-expanded')).toBe('true');
    expect(has(document.querySelector('[data-slot="composer-bump"]'), 'data-dragging')).toBe(false);
  });

  it('keeps a closing bump body shown until its own transition ends, not on a timer', async () => {
    render(
      <Composer>
        <ComposerBump side="top" draggable defaultOpen maxReveal={200}>
          <ComposerBumpContent label="Transcript">Messages</ComposerBumpContent>
          <ComposerBumpHandle label="Chat" />
        </ComposerBump>
        <ComposerCard />
      </Composer>,
    );
    const region = screen.getByRole('region', { name: 'Transcript' });
    // The body's height transition, as the browser would report it, finishing when the test says so.
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    const transition = { transitionProperty: 'height', finished, finish: () => {}, effect: { getComputedTiming: () => ({ endTime: 5000, localTime: 0 }) } };
    region.getAnimations = (() => [transition]) as unknown as typeof region.getAnimations;
    // happy-dom computes no transition timing; give the fallback timeout the real one's order of magnitude.
    Object.assign(region.style, { transitionDuration: '5s', transitionDelay: '0s', animationDuration: '0s', animationDelay: '0s', animationIterationCount: '1' });
    screen.getByRole('button', { name: 'Chat' }).focus();
    await key('Escape');
    expect(attr(screen.getByRole('button', { name: 'Chat' }), 'aria-expanded')).toBe('false');
    // Well past the old 420 ms copy of the spring's duration: still closing.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 600)); });
    expect(attr(region, 'aria-hidden')).toBe('false');
    await act(async () => { finish(); await finished; });
    await waitFor(() => expect(attr(region, 'aria-hidden')).toBe('true'));
  });

  it('ComposerSeparator is UI SDK\'s vertical separator', () => {
    render(
      <Composer>
        <ComposerCard>
          <ComposerFooter>
            <ComposerSeparator />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    const separator = screen.getByRole('separator');
    expect(attr(separator, 'aria-orientation')).toBe('vertical');
    expect(attr(separator, 'data-slot')).toBe('separator');
  });

  it('hands focus to the editor when the last tile leaves from the keyboard', async () => {
    const onAttachmentsChange = vi.fn();
    render(
      <Composer defaultAttachments={[{ id: 'a', name: 'a.pdf', type: 'application/pdf', size: 10 }]} onAttachmentsChange={onAttachmentsChange}>
        <ComposerCard>
          <ComposerAttachments />
          <ComposerInput aria-label="Message" />
        </ComposerCard>
      </Composer>,
    );
    const editor = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[contenteditable="true"][aria-label="Message"]');
      expect(el).toBeTruthy();
      return el!;
    });
    const open = screen.getByRole('button', { name: /^Open a\.pdf/ });
    open.focus();
    await key('Delete');
    expect(onAttachmentsChange.mock.lastCall![0]).toEqual([]);
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });
});

/* A transcript beside the composer: 2000px of content in a 500px box, resting at its newest message (the bottom). */
function fakeScroller() {
  const el = document.createElement('div');
  let top = 1500;
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 2000 });
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 500 });
  Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = v; } });
  document.body.append(el);
  return el;
}

describe('Composer collapse on scroll', () => {
  let now = 0;
  let restoreNow: () => void = () => {};
  const ref = { current: null as HTMLElement | null };
  afterEach(() => {
    restoreNow();
    ref.current?.remove();
    ref.current = null;
  });
  const setup = (props: Partial<React.ComponentProps<typeof Composer>> = {}, children: React.ReactNode = null) => {
    now = 1000;
    const spy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    restoreNow = () => spy.mockRestore();
    ref.current = fakeScroller();
    const onCollapsedChange = vi.fn();
    const view = render(
      <Composer collapseOnScroll={ref} collapseTo="fab" onCollapsedChange={onCollapsedChange} {...props}>
        <ComposerCard>
          {children}
          <ComposerFooter>
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>,
    );
    return { ...view, onCollapsedChange, root: () => document.querySelector('[data-slot="composer"]')! };
  };
  /** Scrolls the transcript `by` px away from its newest message, `ms` after the last scroll. */
  const scrollAway = async (by: number, ms = 100) => {
    now += ms;
    ref.current!.scrollTop -= by;
    await act(async () => { ref.current!.dispatchEvent(new Event('scroll')); });
  };

  it('folds none → compact → fab on a slow read away, reporting the scroll as the reason', async () => {
    const { root, onCollapsedChange } = setup();
    expect(attr(root(), 'data-collapsed')).toBe('none');
    const seen = new Set<string>();
    for (let i = 0; i < 14; i++) {
      await scrollAway(50);
      seen.add(attr(root(), 'data-collapsed')!);
    }
    expect([...seen]).toEqual(['none', 'compact', 'fab']);
    expect(onCollapsedChange.mock.calls.map(([c, d]) => [c, d.reason])).toEqual([['compact', 'scroll'], ['fab', 'scroll']]);
    // Coming back near the newest message restores the full card.
    ref.current!.scrollTop = 1490;
    await act(async () => { ref.current!.dispatchEvent(new Event('scroll')); });
    expect(attr(root(), 'data-collapsed')).toBe('none');
  });

  it('folds straight to the FAB on a flick (UI SDK velocity tracker)', async () => {
    const { root } = setup();
    await scrollAway(30, 16);
    await scrollAway(120, 16);
    expect(attr(root(), 'data-collapsed')).toBe('fab');
  });

  it('never folds a draft into the FAB, and never collapses while focus is inside or an attachment is there', async () => {
    const draft = setup({ value: 'unsent' });
    for (let i = 0; i < 14; i++) await scrollAway(50);
    expect(attr(draft.root(), 'data-collapsed')).toBe('compact');
    draft.unmount();
    restoreNow();
    ref.current?.remove();

    const withFile = setup({ defaultAttachments: [{ id: 'a', name: 'a.pdf', type: 'application/pdf', size: 1 }] });
    for (let i = 0; i < 14; i++) await scrollAway(50);
    expect(attr(withFile.root(), 'data-collapsed')).toBe('none');
    withFile.unmount();
    restoreNow();
    ref.current?.remove();

    const focused = setup({}, <ComposerExpand />);
    screen.getByRole('button', { name: 'Expand composer' }).focus();
    expect(focused.root().contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 14; i++) await scrollAway(50);
    expect(attr(focused.root(), 'data-collapsed')).toBe('none');
  });

  it('never folds into the FAB while a reply streams', async () => {
    const { root } = setup({ streaming: true });
    for (let i = 0; i < 14; i++) await scrollAway(50);
    expect(attr(root(), 'data-collapsed')).toBe('compact');
  });

  it('restores from the FAB when it is pressed, and focuses the editor', async () => {
    const { root, onCollapsedChange } = setup({ defaultCollapsed: 'fab' }, <ComposerInput aria-label="Message" />);
    const editor = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[contenteditable="true"][aria-label="Message"]');
      expect(el).toBeTruthy();
      return el!;
    });
    expect(attr(root(), 'data-collapsed')).toBe('fab');
    const fab = screen.getByRole('button', { name: 'Open composer' });
    await act(async () => { fireEvent.click(fab); });
    expect(attr(root(), 'data-collapsed')).toBe('none');
    expect(onCollapsedChange).toHaveBeenLastCalledWith('none', expect.objectContaining({ reason: 'press' }));
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });
});

describe('AnnotateLightbox', () => {
  const SRC = 'data:image/png;base64,AAAA';

  it('opens and closes through UI SDK\'s open API, reporting why', async () => {
    const onOpenChange = vi.fn();
    const onOpenChangeComplete = vi.fn();
    render(<AnnotateLightbox src={SRC} canvas={<div />} defaultOpen onOpenChange={onOpenChange} onOpenChangeComplete={onOpenChangeComplete} />);
    const dialog = await screen.findByRole('dialog', { name: 'Annotate image' });
    expect(dialog.getAttribute('data-slot')).toBe('dialog-content');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'close-press', returnValue: 'cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 });
    expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
  });

  it('closes on Escape with the escape-key reason, and a consumer can refuse it', async () => {
    const onOpenChange = vi.fn((open: boolean, details: { cancel: () => void }) => {
      if (!open) details.cancel();
    });
    render(<AnnotateLightbox src={SRC} defaultOpen annotator={null} onOpenChange={onOpenChange} />);
    await screen.findByRole('dialog', { name: 'Preview image' });
    await key('Escape');
    expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape-key' }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'Preview image' })).toBeTruthy();
  });

  it('saves the flattened image, then closes with the action reason', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as never);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,SAVED');
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    render(<AnnotateLightbox src={SRC} canvas={<div />} defaultOpen onSave={onSave} onOpenChange={onOpenChange} />);
    await screen.findByRole('dialog', { name: 'Annotate image' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save annotation' })); });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('data:image/png;base64,SAVED', expect.objectContaining({ source: expect.any(String) })));
    await waitFor(() => expect(onOpenChange).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'action', returnValue: 'save' })));
    getContext.mockRestore();
    toDataURL.mockRestore();
  });

  it('replaces the attachment with the saved image once the lightbox has closed', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as never);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,SAVED');
    const onAttachmentsChange = vi.fn();
    render(
      <Composer annotateCanvas={<div />} defaultAttachments={[{ id: 'img', name: 'shot.png', type: 'image/png', src: SRC }]} onAttachmentsChange={onAttachmentsChange}>
        <ComposerCard>
          <ComposerAttachments />
        </ComposerCard>
      </Composer>,
    );
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Annotate shot.png' })); });
    await screen.findByRole('dialog', { name: 'Annotate image' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save annotation' })); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(onAttachmentsChange.mock.lastCall?.[0]?.[0]).toEqual(expect.objectContaining({ id: 'img', src: 'data:image/png;base64,SAVED', type: 'image/png' })));
    getContext.mockRestore();
    toDataURL.mockRestore();
  });
});
