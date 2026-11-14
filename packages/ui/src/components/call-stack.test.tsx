// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallStack } from '@/components/ui/call-stack';
import type { CallStackFrame } from '@/lib/call-stack-model';

// The Copy button's label morphs with framer-motion, whose canceled animations happy-dom reports as unhandled.
vi.mock('@/components/ui/text-morph', () => ({ TextMorph: ({ children }: { children: string }) => children }));

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

// The rows are virtualized: give the list a size to lay them out in.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1200);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const app = (id: string, line = 1): CallStackFrame => ({ id, functionName: id, location: { file: `/src/deep/${id}.ts`, line, column: 2 } });
const fw = (id: string): CallStackFrame => ({ id, functionName: id, kind: 'framework', label: 'React', location: { file: '/node_modules/react.js', line: 9 } });

const FRAMES: CallStackFrame[] = [
  app('top'), app('b'), fw('r1'), fw('r2'), fw('r3'), app('c'), { id: 'await-1', kind: 'async', label: 'await load' }, app('d'),
];

const rows = () => screen.getAllByRole('treeitem');
const row = (start: string) => rows().find((r) => r.textContent?.includes(start)) as HTMLElement;
const label = (start: string) => row(start).querySelector('[data-slot="tree-label"]') as HTMLElement;
const scroller = () => screen.getByRole('tree').parentElement as HTMLElement;
const selected = () => rows().filter((r) => r.getAttribute('aria-selected') === 'true').map((r) => r.getAttribute('data-key'));
const focused = () => document.activeElement?.getAttribute('data-key');

function Controlled({ frames = FRAMES, initial, onSelect }: { frames?: CallStackFrame[]; initial?: string; onSelect?: (id: string, index: number, reason: string) => void }) {
  const [value, setValue] = useState(initial ?? null);
  return <CallStack frames={frames} value={value} onValueChange={(id, details) => { setValue(id); onSelect?.(details.frame.id, details.index, details.reason); }} />;
}

describe('CallStack', () => {
  it('names itself, and takes a class and style on its root', () => {
    const { container } = render(<CallStack frames={FRAMES} className="w-40" style={{ color: 'red' }} aria-label="Stack" />);
    const el = container.querySelector('[data-slot="call-stack"]') as HTMLElement;
    expect(el.className).toContain('w-40');
    expect(el.style.color).toBe('red');
    expect(screen.getByRole('tree', { name: 'Stack' })).toBeTruthy();
  });

  it('marks its parts, so a host can find them', () => {
    render(<CallStack frames={FRAMES} />);
    expect(label('top').getAttribute('data-row')).toBe('frame');
    expect(label('top').getAttribute('data-kind')).toBe('app');
    expect(label('3 React frames').getAttribute('data-row')).toBe('run');
    expect(row('3 React frames').getAttribute('aria-expanded')).toBe('false');
    expect(label('await load').getAttribute('data-row')).toBe('separator');
    expect(row('await load').getAttribute('aria-disabled')).toBe('true');
  });

  it('shows frames with a short location, a fold and a separator', () => {
    render(<CallStack frames={FRAMES} />);
    expect(row('3 React frames')).toBeTruthy();
    expect(row('b.ts:1').textContent).toBe('bb.ts:1');
    expect(screen.getByText('await load')).toBeTruthy();
    expect(row('r2')).toBeUndefined();
  });

  it('marks the top frame apart from the selected one', () => {
    render(<CallStack frames={FRAMES} value="b" />);
    expect(label('top').getAttribute('data-top')).toBe('true');
    expect(row('top').getAttribute('aria-selected')).toBe('false');
    expect(row('b.ts').getAttribute('aria-selected')).toBe('true');
    expect(label('b.ts').getAttribute('data-top')).toBeNull();
  });

  it('selects on press, and says which frame', () => {
    const onSelect = vi.fn();
    render(<Controlled onSelect={onSelect} initial="top" />);
    fireEvent.click(row('c.ts'));
    expect(onSelect).toHaveBeenCalledWith('c', 5, 'item-press');
    expect(row('c.ts').getAttribute('aria-selected')).toBe('true');
    expect(row('top').getAttribute('aria-selected')).toBe('false');
  });

  it('remembers its own selection when nobody controls it', () => {
    render(<CallStack frames={FRAMES} defaultValue="b" />);
    expect(row('b.ts').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row('c.ts'));
    expect(row('c.ts').getAttribute('aria-selected')).toBe('true');
  });

  it('opens and closes a run on press, without selecting it', () => {
    const onSelect = vi.fn();
    render(<Controlled onSelect={onSelect} initial="top" />);
    fireEvent.click(row('3 React frames'));
    expect(row('r2')).toBeTruthy();
    expect(row('3 React frames').getAttribute('aria-expanded')).toBe('true');
    expect(row('r2').getAttribute('aria-level')).toBe('2');
    expect(onSelect).not.toHaveBeenCalled();
    expect(selected()).toEqual(['top']);
    fireEvent.click(row('3 React frames'));
    expect(row('r2')).toBeUndefined();
  });

  it('is one tab stop: the arrow keys select frames, step over a boundary, and open and close a run', async () => {
    const onSelect = vi.fn();
    render(<Controlled onSelect={onSelect} initial="top" />);
    expect(rows().filter((r) => r.getAttribute('tabindex') === '0').map((r) => r.getAttribute('data-key'))).toEqual(['top']);
    row('top').focus();
    fireEvent.keyDown(row('top'), { key: 'ArrowDown' });
    expect(focused()).toBe('b');
    expect(onSelect).toHaveBeenLastCalledWith('b', 1, 'list-navigation');
    expect(selected()).toEqual(['b']);
    // The run takes focus but is never selected. Right opens it, then steps into it; Left steps back out, then closes it.
    fireEvent.keyDown(row('b.ts'), { key: 'ArrowDown' });
    const run = row('3 React frames');
    expect(document.activeElement).toBe(run);
    expect(selected()).toEqual(['b']);
    fireEvent.keyDown(run, { key: 'ArrowRight' });
    expect(row('r2')).toBeTruthy();
    fireEvent.keyDown(row('3 React frames'), { key: 'ArrowRight' });
    expect(focused()).toBe('r1');
    expect(onSelect).toHaveBeenLastCalledWith('r1', 2, 'list-navigation');
    // (New frames and selections are paced, so the list shows the newest a moment later.)
    await waitFor(() => expect(selected()).toEqual(['r1']));
    fireEvent.keyDown(row('r1'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(row('3 React frames'));
    fireEvent.keyDown(row('3 React frames'), { key: 'ArrowLeft' });
    // The selected frame stays on show, so the run folds around it.
    await waitFor(() => expect(row('r2')).toBeUndefined());
    expect(row('r1')).toBeTruthy();
    // End reaches the last frame, past the async boundary, which the keyboard never lands on.
    fireEvent.keyDown(row('r1'), { key: 'End' });
    expect(focused()).toBe('d');
    fireEvent.keyDown(row('d.ts'), { key: 'ArrowUp' });
    expect(focused()).toBe('c');
    // Typing finds a frame by its name.
    fireEvent.keyDown(row('c.ts'), { key: 't' });
    expect(focused()).toBe('top');
  });

  it('keeps a frame selected, and lets the owner refuse a change', () => {
    const onValueChange = vi.fn((id: string, details: { cancel: () => void }) => { if (id === 'c') details.cancel(); });
    render(<CallStack frames={FRAMES} defaultValue="b" onValueChange={onValueChange} />);
    fireEvent.click(row('c.ts'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(selected()).toEqual(['b']);
    // Space on the selected frame doesn't clear the selection.
    row('b.ts').focus();
    fireEvent.keyDown(row('b.ts'), { key: ' ' });
    expect(selected()).toEqual(['b']);
    fireEvent.click(row('d.ts'));
    expect(selected()).toEqual(['d']);
  });

  it('keeps the selected frame on show when it sits in a run', () => {
    render(<CallStack frames={FRAMES} value="r2" />);
    expect(row('r2').getAttribute('aria-selected')).toBe('true');
    expect(row('react.js')).toBeTruthy();
  });

  it('can open runs from the start, or never fold them', () => {
    const { unmount } = render(<CallStack frames={FRAMES} defaultExpandedRuns={['r1']} />);
    expect(row('r2')).toBeTruthy();
    expect(row('3 React frames')).toBeTruthy();
    unmount();
    render(<CallStack frames={FRAMES} collapseRuns={false} />);
    expect(row('r2')).toBeTruthy();
    expect(row('3 React frames')).toBeUndefined();
  });

  it('has the whole path a press away, without selecting the frame', async () => {
    render(<Controlled initial="top" />);
    const location = screen.getByRole('button', { name: 'Location: /src/deep/b.ts:1:2' });
    expect(location.title).toBe('/src/deep/b.ts:1:2');
    expect(location.textContent).toBe('b.ts:1');
    fireEvent.click(location);
    expect((await screen.findByRole('dialog')).textContent).toContain('/src/deep/b.ts:1:2');
    expect(selected()).toEqual(['top']);
  });

  it('says Copied for a while, restarting on a second press, and leaves no timer behind', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const setTimer = vi.spyOn(globalThis, 'setTimeout');
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout');
    const copiedTimers = () => setTimer.mock.results.filter((_, i) => setTimer.mock.calls[i]![1] === 1200).map((r) => r.value);
    const { unmount } = render(<Controlled initial="top" />);
    fireEvent.click(screen.getByRole('button', { name: 'Location: /src/deep/b.ts:1:2' }));
    const dialog = await screen.findByRole('dialog');
    const copy = () => dialog.querySelector('[data-slot="button"]') as HTMLElement;
    await act(async () => { fireEvent.click(copy()); });
    expect(writeText).toHaveBeenCalledWith('/src/deep/b.ts:1:2');
    expect(copy().textContent).toBe('Copied');
    await act(async () => { fireEvent.click(copy()); });
    const [first, second] = copiedTimers();
    expect(clearTimer).toHaveBeenCalledWith(first);
    unmount();
    expect(clearTimer).toHaveBeenCalledWith(second);
    vi.unstubAllGlobals();
  });

  it('keeps a location out of the tab order, and shows it with Return on its frame', async () => {
    render(<Controlled initial="top" />);
    expect(screen.getByRole('button', { name: 'Location: /src/deep/b.ts:1:2' }).getAttribute('tabindex')).toBe('-1');
    row('top').focus();
    await act(async () => { fireEvent.keyDown(row('top'), { key: 'Enter' }); });
    expect((await screen.findByRole('dialog')).textContent).toContain('/src/deep/top.ts:1:2');
  });

  it('shows no location for a frame without one, and names an anonymous frame', () => {
    render(<CallStack frames={[{ id: 'x' }]} />);
    expect(rows()[0]!.textContent).toContain('(anonymous)');
    expect(screen.queryByRole('button', { name: /Location/ })).toBeNull();
  });

  it('says when there are no frames', () => {
    render(<CallStack frames={[]} emptyState="No JS is on the stack at this point." />);
    expect(screen.getByText('No JS is on the stack at this point.')).toBeTruthy();
  });

  it('does not confuse a frame called top with a section', () => {
    render(<CallStack frames={[app('top'), { id: 'a', kind: 'async' }, app('later')]} />);
    expect(row('top.ts')).toBeTruthy();
    expect(row('later.ts')).toBeTruthy();
    expect(screen.getByText('async')).toBeTruthy();
  });

  it('only draws the rows that fit a thousand-frame stack', () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(520);
    const frames = Array.from({ length: 1000 }, (_, i) => app(`f${i}`));
    render(<CallStack frames={frames} />);
    expect(rows().length).toBeLessThan(60);
    expect(screen.getByRole('tree').style.height).toBe('24000px');
    expect(row('f3.ts').getAttribute('aria-setsize')).toBe('1000');
  });

  it('reaches a frame that is not in the DOM with the keyboard', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(260);
    const onSelect = vi.fn();
    render(<Controlled frames={Array.from({ length: 200 }, (_, i) => app(`f${i}`))} initial="f0" onSelect={onSelect} />);
    expect(row('f199.ts')).toBeUndefined();
    row('f0.ts').focus();
    fireEvent.keyDown(row('f0.ts'), { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith('f199', 199, 'list-navigation');
    await waitFor(() => expect(scroller().scrollTop).toBe(200 * 24 - 260));
    await act(async () => { fireEvent.scroll(scroller()); });
    expect(focused()).toBe('f199');
    expect(selected()).toEqual(['f199']);
  });

  it('scrolls a frame selected from outside into view', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(260);
    const frames = Array.from({ length: 1000 }, (_, i) => app(`f${i}`));
    const { rerender } = render(<CallStack frames={frames} value="f0" />);
    const list = scroller();
    // A jump lands mid-list.
    rerender(<CallStack frames={frames} value="f500" />);
    await waitFor(() => expect(list.scrollTop).toBe(500 * 24 - (260 - 24) / 2));
    // A step lands at the nearest edge, or nowhere if the frame's on show.
    const before = list.scrollTop;
    rerender(<CallStack frames={frames} value="f503" />);
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    expect(list.scrollTop).toBe(before);
    rerender(<CallStack frames={frames} value="f510" />);
    await waitFor(() => expect(list.scrollTop).toBe(510 * 24 + 24 - 260));
    rerender(<CallStack frames={frames} value="f0" />);
    await waitFor(() => expect(list.scrollTop).toBe(0));
  });

  it('takes the newest stack while new ones keep coming', async () => {
    const stacks = Array.from({ length: 30 }, (_, step) => [app(`s${step}-a`, step), app(`s${step}-b`, step)]);
    const { rerender } = render(<CallStack frames={stacks[0]!} value={stacks[0]![0]!.id} />);
    for (const stack of stacks.slice(1)) rerender(<CallStack frames={stack} value={stack[0]!.id} />);
    await waitFor(() => expect(row('s29-a')).toBeTruthy());
    expect(row('s29-a').getAttribute('aria-selected')).toBe('true');
  });
});
