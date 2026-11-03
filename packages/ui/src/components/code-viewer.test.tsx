// @vitest-environment happy-dom
import { StrictMode, createRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CodeViewer, type CodeViewerGutter, type CodeViewerHandle } from '@/components/ui/code-viewer';

const WIDTH = 800;
const HEIGHT = 400;
const CELL = 8;
const LINE = 20;
/** The space before the first character, which clicks have to allow for. */
const PADDING = 10;

/* happy-dom has no layout, so the box is stubbed: every element is 800 by 400 at the origin, and the probe measures 8 px a
   character. */
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => WIDTH });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => HEIGHT });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const text = this.textContent ?? '';
    const width = /^0{128}$/.test(text) ? 128 * CELL : WIDTH;
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: HEIGHT, width, height: HEIGHT, toJSON: () => ({}) };
  });
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

const root = () => document.querySelector('[data-slot="code-viewer"]') as HTMLElement;
const lineEl = (n: number) => document.querySelector(`[data-slot="code-viewer-line"][data-line="${n}"]`) as HTMLElement | null;
const lineNumbers = () => [...document.querySelectorAll<HTMLElement>('[data-slot="code-viewer-line"]')].map((el) => Number(el.dataset.line));
const textOf = (n: number) => lineEl(n)?.querySelector('[data-slot="code-viewer-text"]')?.textContent ?? '';
const domText = () => [...document.querySelectorAll('[data-slot="code-viewer-text"]')].map((t) => t.textContent ?? '').join('');
const flushFrames = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

function scrollTo({ top, left }: { top?: number; left?: number }) {
  const el = root();
  if (top !== undefined) el.scrollTop = top;
  if (left !== undefined) el.scrollLeft = left;
  act(() => { fireEvent.scroll(el); });
}

const numbered = (count: number) => Array.from({ length: count }, (_, i) => `line ${i + 1}`);
const generated = (i: number) => `line ${i + 1}`;

describe('CodeViewer', () => {
  it('takes className and style last, and has a role, a label and a tab stop', () => {
    render(<CodeViewer lines={['a']} className="h-64" style={{ color: 'red' }} aria-label="app.js" />);
    const el = root();
    expect(el.className).toContain('h-64');
    expect(el.className).not.toContain('h-full');
    expect(el.style.color).toBe('red');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('app.js');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('renders what is on screen of half a million lines, and asks for no others', () => {
    const getLine = vi.fn(generated);
    render(<CodeViewer lineCount={500_000} getLine={getLine} maxLineLength={20} highlight={null} />);
    const rows = lineNumbers();
    expect(rows[0]).toBe(1);
    expect(rows.length).toBeLessThanOrEqual(HEIGHT / LINE + 16);
    expect(textOf(5)).toBe('line 5');
    expect(getLine.mock.calls.length).toBeLessThan(100);

    scrollTo({ top: 400_000 * LINE });
    const deep = lineNumbers();
    expect(deep[0]).toBeGreaterThan(399_000);
    expect(deep.length).toBeLessThanOrEqual(HEIGHT / LINE + 24);
    expect(textOf(400_001)).toBe('line 400001');
  });

  it('marks each line with where it is in the list, for assistive tech', () => {
    render(<CodeViewer lineCount={500_000} getLine={generated} maxLineLength={20} highlight={null} />);
    expect(lineEl(3)?.getAttribute('role')).toBe('listitem');
    expect(lineEl(3)?.getAttribute('aria-posinset')).toBe('3');
    expect(lineEl(3)?.getAttribute('aria-setsize')).toBe('500000');
  });

  it('never puts a megabyte line in the DOM', () => {
    const line = Array.from({ length: 200_000 }, (_, i) => `v${i};`).join('').slice(0, 1 << 20);
    render(<CodeViewer lines={['start', line]} />);
    expect(domText().length).toBeLessThan(1000);
    expect(textOf(2)).toBe(line.slice(0, textOf(2).length));

    const left = 900_000 * CELL;
    scrollTo({ left });
    const shown = textOf(2);
    expect(shown.length).toBeLessThan(1000);
    const start = line.indexOf(shown);
    expect(start).toBeGreaterThan(899_000);
    expect(start).toBeLessThanOrEqual(900_000);
    // The start line is too short to reach this far.
    expect(textOf(1)).toBe('');
    // Its position is on the grid, in small numbers.
    const el = lineEl(2)?.querySelector('[data-slot="code-viewer-text"]') as HTMLElement;
    expect(Math.abs(parseFloat(el.style.left))).toBeLessThan(100_000);
  });

  it('scrolls the width of the longest line, and past what a browser can size only by scaling', () => {
    const { unmount } = render(<CodeViewer lines={['x'.repeat(10_000)]} />);
    const extent = () => document.querySelector('[data-slot="code-viewer-extent"]') as HTMLElement;
    expect(parseFloat(extent().style.width)).toBeGreaterThan(10_000 * CELL);
    unmount();
    render(<CodeViewer lineCount={3_000_000} getLine={generated} maxLineLength={20} highlight={null} />);
    expect(parseFloat(extent().style.height)).toBe(16_000_000);
    scrollTo({ top: 16_000_000 - HEIGHT });
    expect(lineNumbers().at(-1)).toBe(3_000_000);
  });

  describe('gutters', () => {
    const gutters: CodeViewerGutter[] = [
      { id: 'hits', width: 40, render: (n) => <span data-testid={`hits-${n}`}>{n * 2}</span> },
      { id: 'dot', width: 16, render: () => '•', onPress: vi.fn(), isPressable: (n) => n % 2 === 0, label: (n) => `Toggle ${n}` },
    ];

    it('come in order, with the line numbers next to the code, and keep their place when the code scrolls', () => {
      render(<CodeViewer lines={numbered(5)} gutters={gutters} />);
      const row = document.querySelector('[data-slot="code-viewer-gutter-row"][data-line="2"]') as HTMLElement;
      expect([...row.children].map((el) => (el as HTMLElement).dataset.gutter)).toEqual(['hits', 'dot', 'line-number']);
      expect(screen.getByTestId('hits-2').textContent).toBe('4');
      // Only the code's layer moves sideways.
      const code = document.querySelector('[data-slot="code-viewer-code"]') as HTMLElement;
      expect(code.contains(row)).toBe(false);
    });

    it('put line numbers first on request, or leave them out', () => {
      const { unmount } = render(<CodeViewer lines={numbered(5)} gutters={gutters} lineNumbers="start" />);
      const cells = () => [...(document.querySelector('[data-slot="code-viewer-gutter-row"]') as HTMLElement).children].map((el) => (el as HTMLElement).dataset.gutter);
      expect(cells()).toEqual(['line-number', 'hits', 'dot']);
      unmount();
      render(<CodeViewer lines={numbered(5)} gutters={gutters} lineNumbers={false} />);
      expect(cells()).toEqual(['hits', 'dot']);
    });

    it('press through a button on lines that can be pressed, and hold anything', () => {
      const onPress = vi.fn();
      render(<CodeViewer lines={numbered(5)} gutters={[{ ...gutters[1], onPress }]} />);
      const two = screen.getByRole('button', { name: 'Toggle 2' });
      fireEvent.click(two);
      expect(onPress).toHaveBeenCalledWith(2);
      expect(screen.queryByRole('button', { name: 'Toggle 3' })).toBeNull();
    });

    it('line numbers are buttons only when they do something', () => {
      const onLineNumberPress = vi.fn();
      const { unmount } = render(<CodeViewer lines={numbered(3)} />);
      expect(screen.queryByRole('button')).toBeNull();
      unmount();
      render(<CodeViewer lines={numbered(3)} onLineNumberPress={onLineNumberPress} isLineNumberPressable={(n) => n !== 2} lineNumberLabel={(n) => `Jump to ${n}`} />);
      fireEvent.click(screen.getByRole('button', { name: 'Jump to 3' }));
      expect(onLineNumberPress).toHaveBeenCalledWith(3);
      expect(screen.queryByRole('button', { name: 'Jump to 2' })).toBeNull();
    });

    it('leave nothing for the selection or the copied text', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={numbered(3)} gutters={gutters} />);
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText()).toBe('line 1\nline 2\nline 3');
    });
  });

  describe('line state', () => {
    it('shows the current line and its column', () => {
      render(<CodeViewer lines={numbered(5)} currentLine={3} currentColumn={2} />);
      const bands = document.querySelectorAll('[data-slot="code-viewer-band"]');
      expect(bands.length).toBe(1);
      expect((bands[0] as HTMLElement).dataset.tint).toBe('current');
      expect((bands[0] as HTMLElement).style.top).toBe(`${2 * LINE}px`);
      const mark = lineEl(3)?.querySelector('[data-slot="code-viewer-column"]') as HTMLElement;
      expect(parseFloat(mark.style.left)).toBe(PADDING + 2 * CELL);
      expect(document.querySelector('[data-slot="code-viewer-gutter-row"][data-line="3"]')?.hasAttribute('data-current')).toBe(true);
    });

    it('decorates lines by function: bands, classes on the text and on the gutter', () => {
      const decorate = (n: number) => (n === 2 ? { tint: 'danger' as const, textClassName: 'dim', gutterClassName: 'gutter-dim' } : n === 4 ? { className: 'mine' } : null);
      render(<CodeViewer lines={numbered(5)} lineDecoration={decorate} />);
      const bands = [...document.querySelectorAll<HTMLElement>('[data-slot="code-viewer-band"]')];
      expect(bands.map((b) => b.dataset.tint)).toEqual(['danger', undefined]);
      expect(bands[1].className).toContain('mine');
      expect(lineEl(2)?.className).toContain('dim');
      expect(document.querySelector('[data-line="2"] [data-gutter="line-number"]')?.className).toContain('gutter-dim');
    });

    it('keeps the current line in view when it changes, and leaves the scroll alone when it already is', () => {
      const { rerender } = render(<CodeViewer lines={numbered(10_000)} currentLine={5} />);
      expect(root().scrollTop).toBe(0);
      rerender(<CodeViewer lines={numbered(10_000)} currentLine={8} />);
      expect(root().scrollTop).toBe(0);
      rerender(<CodeViewer lines={numbered(10_000)} currentLine={5000} />);
      expect(root().scrollTop).toBe(4999 * LINE - HEIGHT / 3);
    });

    it('can leave following along to the host', () => {
      const { rerender } = render(<CodeViewer lines={numbered(10_000)} currentLine={5} revealCurrentLine={false} />);
      rerender(<CodeViewer lines={numbered(10_000)} currentLine={5000} revealCurrentLine={false} />);
      expect(root().scrollTop).toBe(0);
    });

    it('brings a current column into view sideways', () => {
      render(<CodeViewer lines={['x'.repeat(100_000)]} currentLine={1} currentColumn={50_000} />);
      expect(root().scrollLeft).toBeGreaterThan(49_000 * CELL);
      expect(lineEl(1)?.querySelector('[data-slot="code-viewer-column"]')).not.toBeNull();
    });
  });

  describe('markers', () => {
    it('press, at their column, from an array or a function', () => {
      const onPress = vi.fn();
      const { unmount } = render(<CodeViewer lines={numbered(5)} markers={[{ line: 2, column: 3, label: 'Site at 3', onPress }, { line: 2, column: 1, label: 'Site at 1', isActive: true, onPress }]} />);
      const three = screen.getByRole('button', { name: 'Site at 3' });
      expect(parseFloat(three.style.left)).toBe(PADDING + 3 * CELL);
      fireEvent.click(three);
      expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ column: 3 }));
      expect(screen.getByRole('button', { name: 'Site at 1' }).getAttribute('aria-pressed')).toBe('true');
      unmount();
      render(<CodeViewer lines={numbered(5)} markers={(n) => (n === 4 ? [{ column: 2, label: 'Only here' }] : undefined)} />);
      expect(lineEl(4)?.querySelectorAll('[data-slot="code-viewer-marker"]').length).toBe(1);
      expect(lineEl(3)?.querySelectorAll('[data-slot="code-viewer-marker"]').length).toBe(0);
    });

    it('on a long line, only the ones in the part that is rendered are in the DOM', () => {
      const marks = Array.from({ length: 50_000 }, (_, i) => ({ column: i * 20, label: `At ${i * 20}`, onPress: () => {} }));
      render(<CodeViewer lines={['x'.repeat(1_000_000)]} markers={(n) => (n === 1 ? marks : undefined)} />);
      expect(document.querySelectorAll('[data-slot="code-viewer-marker"]').length).toBeLessThan(40);
      scrollTo({ left: 800_000 * CELL });
      const labels = [...document.querySelectorAll('[data-slot="code-viewer-marker"]')].map((el) => el.getAttribute('aria-label'));
      expect(labels.length).toBeGreaterThan(5);
      expect(labels.length).toBeLessThan(40);
      expect(labels).toContain('At 800040');
    });
  });

  describe('scrolling', () => {
    it('goes to a line through the ref, aligned', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={numbered(10_000)} />);
      act(() => ref.current?.scrollToLine(1000, { align: 'start' }));
      expect(root().scrollTop).toBe(999 * LINE);
      act(() => ref.current?.scrollToLine(1000, { align: 'end' }));
      expect(root().scrollTop).toBe(1000 * LINE - HEIGHT);
      act(() => ref.current?.scrollToLine(5000));
      expect(root().scrollTop).toBe(4999 * LINE + LINE / 2 - HEIGHT / 2);
      act(() => ref.current?.scrollToLine(1));
      expect(root().scrollTop).toBe(0);
    });

    it('goes to a line through the prop, when it changes', () => {
      const { rerender } = render(<CodeViewer lines={numbered(10_000)} scrollToLine={{ line: 500, align: 'start' }} />);
      expect(root().scrollTop).toBe(499 * LINE);
      root().scrollTop = 0;
      // The same target again, as a new object: not a change.
      rerender(<CodeViewer lines={numbered(10_000)} scrollToLine={{ line: 500, align: 'start' }} />);
      expect(root().scrollTop).toBe(0);
      rerender(<CodeViewer lines={numbered(10_000)} scrollToLine={700} />);
      expect(root().scrollTop).toBe(699 * LINE + LINE / 2 - HEIGHT / 2);
    });

    it('animates on request, unless motion is reduced', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={numbered(10_000)} />);
      const scrollTo = vi.fn();
      root().scrollTo = scrollTo as typeof root.prototype.scrollTo;
      act(() => ref.current?.scrollToLine(1000, { smooth: true, align: 'start' }));
      expect(scrollTo).toHaveBeenCalledWith({ top: 999 * LINE, behavior: 'smooth' });
      vi.stubGlobal('matchMedia', () => ({ matches: true }));
      scrollTo.mockClear();
      act(() => ref.current?.scrollToLine(2000, { smooth: true, align: 'start' }));
      expect(scrollTo).not.toHaveBeenCalled();
      expect(root().scrollTop).toBe(1999 * LINE);
    });

    it('scrolls sideways to a column, and back when the line it goes to is too short to see', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={['short', 'x'.repeat(100_000)]} />);
      act(() => ref.current?.scrollToLine(2, { column: 90_000 }));
      expect(root().scrollLeft).toBeGreaterThan(89_000 * CELL);
      act(() => { fireEvent.scroll(root()); });
      act(() => ref.current?.scrollToLine(1));
      expect(root().scrollLeft).toBe(0);
    });
  });

  describe('selection', () => {
    const codeLayer = () => document.querySelector('[data-slot="code-viewer-code"]') as HTMLElement;
    const at = (row: number, column: number) => ({ clientX: PADDING + column * CELL, clientY: row * LINE + LINE / 2, pointerId: 1, pointerType: 'mouse', button: 0 });

    it('drags by the grid, whatever is in the DOM', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={['const a = 1;', 'const b = 2;', 'const c = 3;']} />);
      fireEvent.pointerDown(codeLayer(), at(0, 6));
      fireEvent.pointerMove(codeLayer(), at(2, 7));
      fireEvent.pointerUp(codeLayer(), at(2, 7));
      expect(ref.current?.getSelectionText()).toBe('a = 1;\nconst b = 2;\nconst c');
      expect(ref.current?.getSelection()).toEqual({ anchor: { line: 1, column: 6 }, focus: { line: 3, column: 7 } });
    });

    it('draws on each line it covers, with a cell for the newline', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={['abcd', '', 'efgh']} />);
      act(() => ref.current?.setSelection({ anchor: { line: 1, column: 2 }, focus: { line: 3, column: 1 } }));
      const rects = [...document.querySelectorAll<HTMLElement>('[data-slot="code-viewer-selection"]')];
      expect(rects.map((r) => [parseFloat(r.style.left), parseFloat(r.style.width)])).toEqual([
        [PADDING + 2 * CELL, 3 * CELL],
        [PADDING, CELL],
        [PADDING, CELL],
      ]);
    });

    it('copies the source, not the gutters', () => {
      const ref = createRef<CodeViewerHandle>();
      const onCopyText = vi.fn();
      render(<CodeViewer ref={ref} lines={['\tone', 'two']} tabSize={4} gutters={[{ id: 'g', width: 20, render: () => 'GUTTER' }]} onCopyText={onCopyText} />);
      act(() => ref.current?.selectAll());
      const setData = vi.fn();
      const handled = !fireEvent.copy(root(), { clipboardData: { setData } });
      expect(setData).toHaveBeenCalledWith('text/plain', '\tone\ntwo');
      expect(handled).toBe(true);
      expect(onCopyText).toHaveBeenCalledWith({ text: '\tone\ntwo', truncated: false });
    });

    it('leaves copying alone with nothing selected', () => {
      render(<CodeViewer lines={['one']} />);
      const setData = vi.fn();
      expect(fireEvent.copy(root(), { clipboardData: { setData } })).toBe(true);
      expect(setData).not.toHaveBeenCalled();
    });

    it('selects a line far down, however far it scrolled from where it began', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lineCount={500_000} getLine={generated} maxLineLength={20} highlight={null} />);
      fireEvent.pointerDown(codeLayer(), at(0, 0));
      fireEvent.pointerUp(codeLayer(), at(0, 0));
      scrollTo({ top: 400_000 * LINE });
      fireEvent.pointerDown(codeLayer(), { ...at(0, 4), shiftKey: true });
      fireEvent.pointerUp(codeLayer(), at(0, 4));
      const text = ref.current?.getSelectionText() ?? '';
      expect(text.split('\n').length).toBe(400_001);
      expect(text.startsWith('line 1\nline 2\n')).toBe(true);
      expect(text.endsWith('\nline')).toBe(true);
    });

    it('selects all, and clears on escape, by keyboard', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={numbered(3)} />);
      fireEvent.keyDown(root(), { key: 'a', metaKey: true });
      expect(ref.current?.getSelectionText()).toBe('line 1\nline 2\nline 3');
      fireEvent.keyDown(root(), { key: 'Escape' });
      expect(ref.current?.getSelection()).toBeNull();
    });

    it('extends with shift and the arrow keys, from where the last click landed', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={['const a = 1;', 'const b = 2;']} />);
      fireEvent.pointerDown(codeLayer(), at(0, 6));
      fireEvent.pointerUp(codeLayer(), at(0, 6));
      fireEvent.keyDown(root(), { key: 'ArrowRight', shiftKey: true });
      expect(ref.current?.getSelectionText()).toBe('a');
      fireEvent.keyDown(root(), { key: 'ArrowDown', shiftKey: true });
      expect(ref.current?.getSelectionText()).toBe('a = 1;\nconst b');
      fireEvent.keyDown(root(), { key: 'End', shiftKey: true });
      expect(ref.current?.getSelectionText()).toBe('a = 1;\nconst b = 2;');
      // Back past the anchor, and it runs the other way.
      fireEvent.keyDown(root(), { key: 'ArrowUp', shiftKey: true });
      fireEvent.keyDown(root(), { key: 'Home', shiftKey: true });
      expect(ref.current?.getSelection()).toEqual({ anchor: { line: 1, column: 6 }, focus: { line: 1, column: 0 } });
      expect(ref.current?.getSelectionText()).toBe('const ');
    });

    it('selects from the top of the view with nothing clicked', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={numbered(10)} />);
      fireEvent.keyDown(root(), { key: 'ArrowDown', shiftKey: true });
      expect(ref.current?.getSelectionText()).toBe('line 1\n');
    });

    it('reports changes, and forgets positions when the content changes', () => {
      const ref = createRef<CodeViewerHandle>();
      const onSelectionChange = vi.fn();
      const { rerender } = render(<CodeViewer ref={ref} lines={numbered(3)} onSelectionChange={onSelectionChange} />);
      act(() => ref.current?.setSelection({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 2 } }));
      expect(onSelectionChange).toHaveBeenLastCalledWith({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 2 } });
      rerender(<CodeViewer ref={ref} lines={numbered(4)} onSelectionChange={onSelectionChange} />);
      expect(ref.current?.getSelection()).toBeNull();
      expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    });

    it('a press on a marker or gutter button starts no selection', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={numbered(3)} markers={[{ line: 1, column: 0, label: 'Mark', onPress: () => {} }]} />);
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Mark' }), at(0, 0));
      fireEvent.pointerMove(codeLayer(), at(1, 3));
      expect(ref.current?.getSelection()).toBeNull();
    });
  });

  describe('highlighting', () => {
    const typeOf = (text: string) => [...document.querySelectorAll('.bl-tok')].find((el) => el.textContent === text)?.className;

    it('labels with the default lexer at once', () => {
      render(<CodeViewer lines={['const a = "b"; // c']} />);
      expect(typeOf('const')).toContain('bl-tok-keyword');
      expect(typeOf('"b"')).toContain('bl-tok-string');
      expect(typeOf('// c')).toContain('bl-tok-comment');
      expect(textOf(1)).toBe('const a = "b"; // c');
    });

    it('finds comments that start on earlier lines', () => {
      render(<CodeViewer lines={['/* one', 'two', 'three */ four']} />);
      expect(typeOf('two')).toContain('bl-tok-comment');
      expect(typeOf('three */')).toContain('bl-tok-comment');
    });

    it('says when what is on screen may still change color', async () => {
      let resolve: (tokens: { text: string }[]) => void = () => {};
      const promised = new Promise<{ text: string }[]>((r) => (resolve = r));
      const { unmount } = render(<CodeViewer lines={['later']} highlight={() => promised} />);
      expect(root().dataset.highlighter).toBe('pending');
      await act(async () => { resolve([{ text: 'later' }]); });
      await flushFrames();
      expect(root().dataset.highlighter).toBe('custom');
      unmount();
      const { unmount: again } = render(<CodeViewer lines={['a']} />);
      expect(root().dataset.highlighter).toBe('lexer');
      again();
      render(<CodeViewer lines={['a']} highlight={null} />);
      expect(root().dataset.highlighter).toBe('none');
    });

    it('turns off with null', () => {
      render(<CodeViewer lines={['const a = 1']} highlight={null} />);
      expect(document.querySelector('.bl-tok')).toBeNull();
      expect(textOf(1)).toBe('const a = 1');
    });

    it('takes a highlighter, and draws what the line says, not what the tokens say', () => {
      const highlight = vi.fn((text: string, index: number) => [{ text: text.slice(0, 2), type: 'keyword' as const }, { text: 'XX', className: `line-${index}` }]);
      render(<CodeViewer lines={['abcdef']} highlight={highlight} />);
      expect(highlight.mock.calls[0][0]).toBe('abcdef');
      expect(highlight.mock.calls[0][1]).toBe(0);
      expect(textOf(1)).toBe('abcdef');
      expect(document.querySelector('.line-0')?.textContent).toBe('cd');
    });

    it('shows plain text until a promise answers', async () => {
      let resolve: (tokens: { text: string; type: 'string' }[]) => void = () => {};
      const promised = new Promise<{ text: string; type: 'string' }[]>((r) => (resolve = r));
      render(<CodeViewer lines={['later']} highlight={() => promised} />);
      expect(textOf(1)).toBe('later');
      expect(document.querySelector('.bl-tok')).toBeNull();
      await act(async () => { resolve([{ text: 'later', type: 'string' }]); });
      await flushFrames();
      expect(typeOf('later')).toContain('bl-tok-string');
    });

    it('stays plain when a highlighter fails, without troubling the page', async () => {
      render(<CodeViewer lines={['later']} highlight={() => Promise.reject(new Error('WebGPU unavailable'))} />);
      await flushFrames();
      expect(textOf(1)).toBe('later');
    });

    it('gives a highlighter only the window of a long line', () => {
      const highlight = vi.fn((text: string) => [{ text }]);
      const line = 'x'.repeat(1 << 20);
      render(<CodeViewer lines={[line]} highlight={highlight} />);
      expect(Math.max(...highlight.mock.calls.map(([text]) => text.length))).toBeLessThan(1000);
    });
  });

  describe('characters', () => {
    it('draws tabs as spaces to the next stop, and copies them as tabs', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={['a\tb']} tabSize={4} highlight={null} />);
      expect(textOf(1)).toBe('a   b');
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText()).toBe('a\tb');
    });

    it('holds wide characters to two cells', () => {
      render(<CodeViewer lines={['a漢b']} highlight={null} />);
      const box = [...document.querySelectorAll<HTMLElement>('[data-slot="code-viewer-text"] span')].find((el) => el.textContent === '漢');
      expect(box?.style.width).toContain('* 2');
    });

    it('puts a click on the right side of a wide character', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={['a漢b']} />);
      const code = document.querySelector('[data-slot="code-viewer-code"]') as HTMLElement;
      const at = (cell: number) => ({ clientX: PADDING + cell * CELL, clientY: LINE / 2, pointerId: 1, pointerType: 'mouse', button: 0 });
      fireEvent.pointerDown(code, at(1));
      fireEvent.pointerMove(code, at(3));
      fireEvent.pointerUp(code, at(3));
      expect(ref.current?.getSelectionText()).toBe('漢');
    });
  });

  describe('wrapping', () => {
    it('gives a long line several rows, and the gutter only the first', () => {
      const ref = createRef<CodeViewerHandle>();
      // 800 px, less the gutter and padding, at 8 px a cell.
      render(<CodeViewer ref={ref} lines={['x'.repeat(1000), 'short']} wrap />);
      const rows = document.querySelectorAll('[data-slot="code-viewer-line"][data-line="1"]');
      expect(rows.length).toBeGreaterThan(5);
      expect(document.querySelectorAll('[data-slot="code-viewer-gutter-row"][data-line="1"]').length).toBe(1);
      const joined = [...rows].map((row) => row.textContent).join('');
      expect(joined.length).toBeLessThanOrEqual(1000);
      expect(root().className).toContain('overflow-x-hidden');
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText().length).toBe(1006);
    });

    it('still only renders what is on screen of a very long line', () => {
      render(<CodeViewer lines={['x'.repeat(1 << 20)]} wrap />);
      expect(domText().length).toBeLessThan(5000);
      expect(document.querySelectorAll('[data-slot="code-viewer-line"]').length).toBeLessThan(40);
    });
  });

  describe('keyboard', () => {
    const gutters: CodeViewerGutter[] = [
      { id: 'a', width: 20, render: () => 'A', onPress: () => {}, label: (n) => `a ${n}` },
      { id: 'b', width: 20, render: () => 'B', onPress: () => {}, label: (n) => `b ${n}` },
    ];
    const controls = () => [...document.querySelectorAll<HTMLElement>('[data-slot="code-viewer"] button')];

    it('has one tab stop among all the buttons', () => {
      render(<CodeViewer lines={numbered(50)} gutters={gutters} onLineNumberPress={() => {}} />);
      const stops = controls().filter((el) => el.getAttribute('tabindex') !== '-1');
      expect(controls().length).toBeGreaterThan(40);
      expect(stops.length).toBe(1);
    });

    it('moves with the arrow keys, down a gutter and along a line', () => {
      render(<CodeViewer lines={numbered(50)} gutters={gutters} />);
      const a1 = screen.getByRole('button', { name: 'a 1' });
      act(() => a1.focus());
      fireEvent.keyDown(a1, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'a 2' }));
      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'b 2' }));
      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'b 1' }));
      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(a1);
      // The tab stop went with the focus.
      expect(a1.getAttribute('tabindex')).toBe('0');
    });

    it('keeps the row with focus when the view scrolls away from it', () => {
      render(<CodeViewer lines={numbered(10_000)} gutters={gutters} />);
      const a1 = screen.getByRole('button', { name: 'a 1' });
      act(() => a1.focus());
      scrollTo({ top: 5000 * LINE });
      expect(a1.isConnected).toBe(true);
      expect(document.activeElement).toBe(a1);
      expect(lineNumbers()).toContain(5001);
    });

    it('leaves keys in a host popover alone', () => {
      function Host() {
        const [typed, setTyped] = useState('');
        return (
          <CodeViewer lines={numbered(5)} gutters={[{ id: 'p', width: 20, render: () => <input aria-label="Box" value={typed} onChange={(e) => setTyped(e.target.value)} /> }]} />
        );
      }
      render(<Host />);
      const box = screen.getAllByLabelText('Box')[0];
      fireEvent.keyDown(box, { key: 'a', metaKey: true });
      expect(document.querySelector('[data-slot="code-viewer-selection"]')).toBeNull();
    });
  });

  describe('content', () => {
    it('reads getLine again only when the content changes', () => {
      const first = vi.fn(generated);
      const { rerender } = render(<CodeViewer lineCount={100} getLine={first} contentKey="a" highlight={null} />);
      const second = vi.fn((i: number) => `other ${i}`);
      rerender(<CodeViewer lineCount={100} getLine={second} contentKey="a" highlight={null} />);
      expect(textOf(1)).toBe('line 1');
      rerender(<CodeViewer lineCount={100} getLine={second} contentKey="b" highlight={null} />);
      expect(textOf(1)).toBe('other 0');
    });

    it('with no key, a new getLine is new content', () => {
      const { rerender } = render(<CodeViewer lineCount={100} getLine={generated} highlight={null} />);
      expect(textOf(1)).toBe('line 1');
      rerender(<CodeViewer lineCount={100} getLine={(i) => `other ${i}`} highlight={null} />);
      expect(textOf(1)).toBe('other 0');
    });

    it('works in StrictMode', () => {
      const ref = createRef<CodeViewerHandle>();
      const { unmount } = render(<StrictMode><CodeViewer ref={ref} lines={numbered(100)} currentLine={50} /></StrictMode>);
      expect(lineNumbers()).toContain(50);
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText().split('\n').length).toBe(100);
      unmount();
    });

    it('copes with no lines at all', () => {
      const ref = createRef<CodeViewerHandle>();
      render(<CodeViewer ref={ref} lines={[]} />);
      act(() => {
        ref.current?.scrollToLine(5);
        ref.current?.selectAll();
      });
      expect(ref.current?.getSelectionText()).toBe('');
      expect(document.querySelectorAll('[data-slot="code-viewer-line"]').length).toBe(0);
    });
  });
});
