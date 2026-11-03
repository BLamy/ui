// @vitest-environment happy-dom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CallStack } from '@/components/ui/call-stack';
import type { CallStackFrame } from '@/lib/call-stack';

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

const rows = () => screen.getAllByRole('row');
const row = (start: string) => rows().find((r) => r.textContent?.includes(start)) as HTMLElement;

function Controlled({ frames = FRAMES, initial, onSelect }: { frames?: CallStackFrame[]; initial?: string; onSelect?: (id: string, index: number) => void }) {
  const [selected, setSelected] = useState(initial ?? null);
  return <CallStack frames={frames} selectedId={selected} onSelect={(frame, index) => { setSelected(frame.id); onSelect?.(frame.id, index); }} />;
}

describe('CallStack', () => {
  it('names itself, and takes a class and style on its root', () => {
    const { container } = render(<CallStack frames={FRAMES} className="w-40" style={{ color: 'red' }} aria-label="Stack" />);
    const el = container.querySelector('[data-slot="call-stack"]') as HTMLElement;
    expect(el.className).toContain('w-40');
    expect(el.style.color).toBe('red');
    expect(screen.getByRole('grid', { name: 'Stack' })).toBeTruthy();
  });

  it('marks its parts, so a host can find them', () => {
    render(<CallStack frames={FRAMES} />);
    expect(row('top').getAttribute('data-slot')).toBe('call-stack-frame');
    expect(row('top').getAttribute('data-kind')).toBe('app');
    expect(row('3 React frames').getAttribute('data-slot')).toBe('call-stack-run');
    expect(screen.getByText('await load').closest('[data-slot="call-stack-separator"]')).toBeTruthy();
  });

  it('shows frames with a short location, a fold and a separator', () => {
    render(<CallStack frames={FRAMES} />);
    expect(row('3 React frames')).toBeTruthy();
    expect(row('b.ts:1').textContent).toBe('bb.ts:1');
    expect(screen.getByText('await load')).toBeTruthy();
    expect(row('r2')).toBeUndefined();
  });

  it('marks the top frame apart from the selected one', () => {
    render(<CallStack frames={FRAMES} selectedId="b" />);
    expect(row('top').getAttribute('data-top')).toBe('true');
    expect(row('top').getAttribute('aria-selected')).toBe('false');
    expect(row('b.ts').getAttribute('aria-selected')).toBe('true');
    expect(row('b.ts').getAttribute('data-top')).toBeNull();
  });

  it('selects on press, and says which frame', () => {
    const onSelect = vi.fn();
    render(<Controlled onSelect={onSelect} initial="top" />);
    fireEvent.click(row('c.ts'));
    expect(onSelect).toHaveBeenCalledWith('c', 5);
    expect(row('c.ts').getAttribute('aria-selected')).toBe('true');
    expect(row('top').getAttribute('aria-selected')).toBe('false');
  });

  it('remembers its own selection when nobody controls it', () => {
    render(<CallStack frames={FRAMES} defaultSelectedId="b" />);
    expect(row('b.ts').getAttribute('aria-selected')).toBe('true');
    fireEvent.click(row('c.ts'));
    expect(row('c.ts').getAttribute('aria-selected')).toBe('true');
  });

  it('opens and closes a run on press, without selecting it', () => {
    const onSelect = vi.fn();
    render(<Controlled onSelect={onSelect} initial="top" />);
    fireEvent.click(row('3 React frames'));
    expect(row('r2')).toBeTruthy();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(row('3 React frames'));
    expect(row('r2')).toBeUndefined();
  });

  it('keeps the selected frame on show when it sits in a run', () => {
    render(<CallStack frames={FRAMES} selectedId="r2" />);
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
    expect(await screen.findByRole('dialog', { name: 'Location' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Location' }).textContent).toContain('/src/deep/b.ts:1:2');
    expect(row('top').getAttribute('aria-selected')).toBe('true');
  });

  it('lets the keyboard reach a location', () => {
    render(<CallStack frames={FRAMES} />);
    expect(screen.getByRole('button', { name: 'Location: /src/deep/b.ts:1:2' }).getAttribute('tabindex')).toBe('-1');
  });

  it('shows no location for a frame without one, and names an anonymous frame', () => {
    render(<CallStack frames={[{ id: 'x' }]} />);
    expect(rows()[0]!.textContent).toContain('(anonymous)');
    expect(screen.queryByRole('button', { name: /Location/ })).toBeNull();
  });

  it('says when there are no frames', () => {
    render(<CallStack frames={[]} emptyMessage="No JS is on the stack at this point." />);
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
    const list = screen.getByRole('grid');
    expect(list.querySelector('[role="presentation"]')!.getAttribute('style')).toContain('height: 26000px');
  });

  it('scrolls a frame selected from outside into view', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(260);
    const frames = Array.from({ length: 1000 }, (_, i) => app(`f${i}`));
    const { rerender } = render(<CallStack frames={frames} selectedId="f0" />);
    const list = screen.getByRole('grid');
    // A jump lands mid-list.
    rerender(<CallStack frames={frames} selectedId="f500" />);
    await waitFor(() => expect(list.scrollTop).toBe(500 * 26 - (260 - 26) / 2));
    // A step lands at the nearest edge, or nowhere if the frame's on show.
    const before = list.scrollTop;
    rerender(<CallStack frames={frames} selectedId="f503" />);
    await new Promise((resolve) => { setTimeout(resolve, 60); });
    expect(list.scrollTop).toBe(before);
    rerender(<CallStack frames={frames} selectedId="f510" />);
    await waitFor(() => expect(list.scrollTop).toBe(510 * 26 + 26 - 260));
    rerender(<CallStack frames={frames} selectedId="f0" />);
    await waitFor(() => expect(list.scrollTop).toBe(0));
  });

  it('takes the newest stack while new ones keep coming', async () => {
    const stacks = Array.from({ length: 30 }, (_, step) => [app(`s${step}-a`, step), app(`s${step}-b`, step)]);
    const { rerender } = render(<CallStack frames={stacks[0]!} selectedId={stacks[0]![0]!.id} />);
    for (const stack of stacks.slice(1)) rerender(<CallStack frames={stack} selectedId={stack[0]!.id} />);
    await waitFor(() => expect(row('s29-a')).toBeTruthy());
    expect(row('s29-a').getAttribute('aria-selected')).toBe('true');
  });
});
