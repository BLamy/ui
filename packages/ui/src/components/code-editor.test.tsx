// @vitest-environment happy-dom
import { StrictMode, createRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CodeEditor, type CodeEditorGutter, type CodeEditorHandle } from '@/components/ui/code-editor';

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

const root = () => document.querySelector('[data-slot="code-editor-content"]') as HTMLElement;
const lineEl = (n: number) => document.querySelector(`[data-slot="code-editor-line"][data-line="${n}"]`) as HTMLElement | null;
const lineNumbers = () => [...document.querySelectorAll<HTMLElement>('[data-slot="code-editor-line"]')].map((el) => Number(el.dataset.line));
const textOf = (n: number) => lineEl(n)?.querySelector('[data-slot="code-editor-text"]')?.textContent ?? '';
const domText = () => [...document.querySelectorAll('[data-slot="code-editor-text"]')].map((t) => t.textContent ?? '').join('');
const flushFrames = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

function scrollTo({ top, left }: { top?: number; left?: number }) {
  const el = root();
  if (top !== undefined) el.scrollTop = top;
  if (left !== undefined) el.scrollLeft = left;
  act(() => { fireEvent.scroll(el); });
}

const numbered = (count: number) => Array.from({ length: count }, (_, i) => `line ${i + 1}`);
const generated = (i: number) => `line ${i + 1}`;

describe('CodeEditor as a source view', () => {
  it('takes className and style last, and has a role, a label and a tab stop', () => {
    render(<CodeEditor readOnly variant="ghost" lines={['a']} className="h-64" style={{ color: 'red' }} aria-label="app.js" />);
    const outer = document.querySelector('[data-slot="code-editor"]') as HTMLElement;
    expect(outer.className).toContain('h-64');
    expect(outer.className).not.toContain('h-full');
    expect(outer.style.color).toBe('red');
    const el = root();
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('app.js');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('renders what is on screen of half a million lines, and asks for no others', () => {
    const getLine = vi.fn(generated);
    render(<CodeEditor readOnly variant="ghost" lineCount={500_000} getLine={getLine} maxLineLength={20} highlight={null} />);
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
    render(<CodeEditor readOnly variant="ghost" lineCount={500_000} getLine={generated} maxLineLength={20} highlight={null} />);
    expect(lineEl(3)?.getAttribute('role')).toBe('listitem');
    expect(lineEl(3)?.getAttribute('aria-posinset')).toBe('3');
    expect(lineEl(3)?.getAttribute('aria-setsize')).toBe('500000');
  });

  it('never puts a megabyte line in the DOM', () => {
    const line = Array.from({ length: 200_000 }, (_, i) => `v${i};`).join('').slice(0, 1 << 20);
    render(<CodeEditor readOnly variant="ghost" lines={['start', line]} />);
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
    const el = lineEl(2)?.querySelector('[data-slot="code-editor-text"]') as HTMLElement;
    expect(Math.abs(parseFloat(el.style.left))).toBeLessThan(100_000);
  });

  it('scrolls the width of the longest line, and past what a browser can size only by scaling', () => {
    const { unmount } = render(<CodeEditor readOnly variant="ghost" lines={['x'.repeat(10_000)]} />);
    const extent = () => document.querySelector('[data-slot="code-editor-extent"]') as HTMLElement;
    expect(parseFloat(extent().style.width)).toBeGreaterThan(10_000 * CELL);
    unmount();
    render(<CodeEditor readOnly variant="ghost" lineCount={3_000_000} getLine={generated} maxLineLength={20} highlight={null} />);
    expect(parseFloat(extent().style.height)).toBe(16_000_000);
    scrollTo({ top: 16_000_000 - HEIGHT });
    expect(lineNumbers().at(-1)).toBe(3_000_000);
  });

  describe('gutters', () => {
    const gutters: CodeEditorGutter[] = [
      { id: 'hits', width: 40, render: (n) => <span data-testid={`hits-${n}`}>{n * 2}</span> },
      { id: 'dot', width: 16, render: () => '•', onPress: vi.fn(), isPressable: (n) => n % 2 === 0, label: (n) => `Toggle ${n}` },
    ];

    it('come in order, with the line numbers next to the code, and keep their place when the code scrolls', () => {
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} gutters={gutters} />);
      const row = document.querySelector('[data-slot="code-editor-gutter-row"][data-line="2"]') as HTMLElement;
      expect([...row.children].map((el) => (el as HTMLElement).dataset.gutter)).toEqual(['hits', 'dot', 'line-number']);
      expect(screen.getByTestId('hits-2').textContent).toBe('4');
      // Only the code's layer moves sideways.
      const code = document.querySelector('[data-slot="code-editor-code"]') as HTMLElement;
      expect(code.contains(row)).toBe(false);
    });

    it('put line numbers first on request, or leave them out', () => {
      const { unmount } = render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} gutters={gutters} lineNumbers="start" />);
      const cells = () => [...(document.querySelector('[data-slot="code-editor-gutter-row"]') as HTMLElement).children].map((el) => (el as HTMLElement).dataset.gutter);
      expect(cells()).toEqual(['line-number', 'hits', 'dot']);
      unmount();
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} gutters={gutters} lineNumbers={false} />);
      expect(cells()).toEqual(['hits', 'dot']);
    });

    it('press through a button on lines that can be pressed, and hold anything', () => {
      const onPress = vi.fn();
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} gutters={[{ ...gutters[1], onPress }]} />);
      const two = screen.getByRole('button', { name: 'Toggle 2' });
      fireEvent.click(two);
      expect(onPress).toHaveBeenCalledWith(2);
      expect(screen.queryByRole('button', { name: 'Toggle 3' })).toBeNull();
    });

    it('line numbers are buttons only when they do something', () => {
      const onLineNumberPress = vi.fn();
      const { unmount } = render(<CodeEditor readOnly variant="ghost" lines={numbered(3)} />);
      expect(screen.queryByRole('button')).toBeNull();
      unmount();
      render(<CodeEditor readOnly variant="ghost" lines={numbered(3)} onLineNumberPress={onLineNumberPress} isLineNumberPressable={(n) => n !== 2} lineNumberLabel={(n) => `Jump to ${n}`} />);
      fireEvent.click(screen.getByRole('button', { name: 'Jump to 3' }));
      expect(onLineNumberPress).toHaveBeenCalledWith(3);
      expect(screen.queryByRole('button', { name: 'Jump to 2' })).toBeNull();
    });

    it('leave nothing for the selection or the copied text', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(3)} gutters={gutters} />);
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText()).toBe('line 1\nline 2\nline 3');
    });
  });

  describe('line state', () => {
    it('shows the current line and its column', () => {
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} currentLine={3} currentColumn={2} />);
      const bands = document.querySelectorAll('[data-slot="code-editor-band"]');
      expect(bands.length).toBe(1);
      expect((bands[0] as HTMLElement).dataset.tint).toBe('current');
      expect((bands[0] as HTMLElement).style.top).toBe(`${2 * LINE}px`);
      const mark = lineEl(3)?.querySelector('[data-slot="code-editor-column"]') as HTMLElement;
      expect(parseFloat(mark.style.left)).toBe(PADDING + 2 * CELL);
      expect(document.querySelector('[data-slot="code-editor-gutter-row"][data-line="3"]')?.hasAttribute('data-current')).toBe(true);
    });

    it('decorates lines by function: bands, classes on the text and on the gutter', () => {
      const decorate = (n: number) => (n === 2 ? { tint: 'danger' as const, textClassName: 'dim', gutterClassName: 'gutter-dim' } : n === 4 ? { className: 'mine' } : null);
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} lineDecoration={decorate} />);
      const bands = [...document.querySelectorAll<HTMLElement>('[data-slot="code-editor-band"]')];
      expect(bands.map((b) => b.dataset.tint)).toEqual(['danger', undefined]);
      expect(bands[1].className).toContain('mine');
      expect(lineEl(2)?.className).toContain('dim');
      expect(document.querySelector('[data-line="2"] [data-gutter="line-number"]')?.className).toContain('gutter-dim');
    });

    it('keeps the current line in view when it changes, and leaves the scroll alone when it already is', () => {
      const { rerender } = render(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} currentLine={5} />);
      expect(root().scrollTop).toBe(0);
      rerender(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} currentLine={8} />);
      expect(root().scrollTop).toBe(0);
      rerender(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} currentLine={5000} />);
      expect(root().scrollTop).toBe(4999 * LINE - HEIGHT / 3);
    });

    it('can leave following along to the host', () => {
      const { rerender } = render(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} currentLine={5} revealCurrentLine={false} />);
      rerender(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} currentLine={5000} revealCurrentLine={false} />);
      expect(root().scrollTop).toBe(0);
    });

    it('brings a current column into view sideways', () => {
      render(<CodeEditor readOnly variant="ghost" lines={['x'.repeat(100_000)]} currentLine={1} currentColumn={50_000} />);
      expect(root().scrollLeft).toBeGreaterThan(49_000 * CELL);
      expect(lineEl(1)?.querySelector('[data-slot="code-editor-column"]')).not.toBeNull();
    });
  });

  describe('markers', () => {
    it('press, at their column, from an array or a function', () => {
      const onPress = vi.fn();
      const { unmount } = render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} markers={[{ line: 2, column: 3, label: 'Site at 3', onPress }, { line: 2, column: 1, label: 'Site at 1', isActive: true, onPress }]} />);
      const three = screen.getByRole('button', { name: 'Site at 3' });
      expect(parseFloat(three.style.left)).toBe(PADDING + 3 * CELL);
      fireEvent.click(three);
      expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ column: 3 }));
      expect(screen.getByRole('button', { name: 'Site at 1' }).getAttribute('aria-pressed')).toBe('true');
      unmount();
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} markers={(n) => (n === 4 ? [{ column: 2, label: 'Only here' }] : undefined)} />);
      expect(lineEl(4)?.querySelectorAll('[data-slot="code-editor-marker"]').length).toBe(1);
      expect(lineEl(3)?.querySelectorAll('[data-slot="code-editor-marker"]').length).toBe(0);
    });

    it('on a long line, only the ones in the part that is rendered are in the DOM', () => {
      const marks = Array.from({ length: 50_000 }, (_, i) => ({ column: i * 20, label: `At ${i * 20}`, onPress: () => {} }));
      render(<CodeEditor readOnly variant="ghost" lines={['x'.repeat(1_000_000)]} markers={(n) => (n === 1 ? marks : undefined)} />);
      expect(document.querySelectorAll('[data-slot="code-editor-marker"]').length).toBeLessThan(40);
      scrollTo({ left: 800_000 * CELL });
      const labels = [...document.querySelectorAll('[data-slot="code-editor-marker"]')].map((el) => el.getAttribute('aria-label'));
      expect(labels.length).toBeGreaterThan(5);
      expect(labels.length).toBeLessThan(40);
      expect(labels).toContain('At 800040');
    });
  });

  describe('scrolling', () => {
    it('goes to a line through the ref, aligned', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(10_000)} />);
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
      const { rerender } = render(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} scrollToLine={{ line: 500, align: 'start' }} />);
      expect(root().scrollTop).toBe(499 * LINE);
      root().scrollTop = 0;
      // The same target again, as a new object: not a change.
      rerender(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} scrollToLine={{ line: 500, align: 'start' }} />);
      expect(root().scrollTop).toBe(0);
      rerender(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} scrollToLine={700} />);
      expect(root().scrollTop).toBe(699 * LINE + LINE / 2 - HEIGHT / 2);
    });

    it('animates on request, unless motion is reduced', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(10_000)} />);
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
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['short', 'x'.repeat(100_000)]} />);
      act(() => ref.current?.scrollToLine(2, { column: 90_000 }));
      expect(root().scrollLeft).toBeGreaterThan(89_000 * CELL);
      act(() => { fireEvent.scroll(root()); });
      act(() => ref.current?.scrollToLine(1));
      expect(root().scrollLeft).toBe(0);
    });
  });

  describe('selection', () => {
    const codeLayer = () => document.querySelector('[data-slot="code-editor-code"]') as HTMLElement;
    const at = (row: number, column: number) => ({ clientX: PADDING + column * CELL, clientY: row * LINE + LINE / 2, pointerId: 1, pointerType: 'mouse', button: 0 });

    it('drags by the grid, whatever is in the DOM', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['const a = 1;', 'const b = 2;', 'const c = 3;']} />);
      fireEvent.pointerDown(codeLayer(), at(0, 6));
      fireEvent.pointerMove(codeLayer(), at(2, 7));
      fireEvent.pointerUp(codeLayer(), at(2, 7));
      expect(ref.current?.getSelectionText()).toBe('a = 1;\nconst b = 2;\nconst c');
      expect(ref.current?.getSelection()).toEqual({ anchor: { line: 1, column: 6 }, focus: { line: 3, column: 7 } });
    });

    it('draws on each line it covers, with a cell for the newline', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['abcd', '', 'efgh']} />);
      act(() => ref.current?.setSelection({ anchor: { line: 1, column: 2 }, focus: { line: 3, column: 1 } }));
      const rects = [...document.querySelectorAll<HTMLElement>('[data-slot="code-editor-selection"]')];
      expect(rects.map((r) => [parseFloat(r.style.left), parseFloat(r.style.width)])).toEqual([
        [PADDING + 2 * CELL, 3 * CELL],
        [PADDING, CELL],
        [PADDING, CELL],
      ]);
    });

    it('copies the source, not the gutters', () => {
      const ref = createRef<CodeEditorHandle>();
      const onCopyText = vi.fn();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['\tone', 'two']} tabSize={4} gutters={[{ id: 'g', width: 20, render: () => 'GUTTER' }]} onCopyText={onCopyText} />);
      act(() => ref.current?.selectAll());
      const setData = vi.fn();
      const handled = !fireEvent.copy(root(), { clipboardData: { setData } });
      expect(setData).toHaveBeenCalledWith('text/plain', '\tone\ntwo');
      expect(handled).toBe(true);
      expect(onCopyText).toHaveBeenCalledWith({ text: '\tone\ntwo', truncated: false });
    });

    it('leaves copying alone with nothing selected', () => {
      render(<CodeEditor readOnly variant="ghost" lines={['one']} />);
      const setData = vi.fn();
      expect(fireEvent.copy(root(), { clipboardData: { setData } })).toBe(true);
      expect(setData).not.toHaveBeenCalled();
    });

    it('selects a line far down, however far it scrolled from where it began', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lineCount={500_000} getLine={generated} maxLineLength={20} highlight={null} />);
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
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(3)} />);
      fireEvent.keyDown(root(), { key: 'a', metaKey: true });
      expect(ref.current?.getSelectionText()).toBe('line 1\nline 2\nline 3');
      fireEvent.keyDown(root(), { key: 'Escape' });
      expect(ref.current?.getSelection()).toBeNull();
    });

    it('extends with shift and the arrow keys, from where the last click landed', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['const a = 1;', 'const b = 2;']} />);
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
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(10)} />);
      fireEvent.keyDown(root(), { key: 'ArrowDown', shiftKey: true });
      expect(ref.current?.getSelectionText()).toBe('line 1\n');
    });

    it('reports changes, and forgets positions when the content changes', () => {
      const ref = createRef<CodeEditorHandle>();
      const onSelectionChange = vi.fn();
      const { rerender } = render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(3)} onSelectionChange={onSelectionChange} />);
      act(() => ref.current?.setSelection({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 2 } }));
      expect(onSelectionChange).toHaveBeenLastCalledWith({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 2 } });
      rerender(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(4)} onSelectionChange={onSelectionChange} />);
      expect(ref.current?.getSelection()).toBeNull();
      expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    });

    it('a press on a marker or gutter button starts no selection', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(3)} markers={[{ line: 1, column: 0, label: 'Mark', onPress: () => {} }]} />);
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Mark' }), at(0, 0));
      fireEvent.pointerMove(codeLayer(), at(1, 3));
      expect(ref.current?.getSelection()).toBeNull();
    });
  });

  describe('highlighting', () => {
    const typeOf = (text: string) => [...document.querySelectorAll('.bl-tok')].find((el) => el.textContent === text)?.className;

    it('labels with the default lexer at once', () => {
      render(<CodeEditor readOnly variant="ghost" lines={['const a = "b"; // c']} />);
      expect(typeOf('const')).toContain('bl-tok-keyword');
      expect(typeOf('"b"')).toContain('bl-tok-string');
      expect(typeOf('// c')).toContain('bl-tok-comment');
      expect(textOf(1)).toBe('const a = "b"; // c');
    });

    it('finds comments that start on earlier lines', () => {
      render(<CodeEditor readOnly variant="ghost" lines={['/* one', 'two', 'three */ four']} />);
      expect(typeOf('two')).toContain('bl-tok-comment');
      expect(typeOf('three */')).toContain('bl-tok-comment');
    });

    it('says when what is on screen may still change color', async () => {
      let resolve: (tokens: { text: string }[]) => void = () => {};
      const promised = new Promise<{ text: string }[]>((r) => (resolve = r));
      const { unmount } = render(<CodeEditor readOnly variant="ghost" lines={['later']} highlight={() => promised} />);
      expect(root().dataset.highlighter).toBe('pending');
      await act(async () => { resolve([{ text: 'later' }]); });
      await flushFrames();
      expect(root().dataset.highlighter).toBe('custom');
      unmount();
      const { unmount: again } = render(<CodeEditor readOnly variant="ghost" lines={['a']} />);
      expect(root().dataset.highlighter).toBe('lexer');
      again();
      render(<CodeEditor readOnly variant="ghost" lines={['a']} highlight={null} />);
      expect(root().dataset.highlighter).toBe('none');
    });

    it('turns off with null', () => {
      render(<CodeEditor readOnly variant="ghost" lines={['const a = 1']} highlight={null} />);
      expect(document.querySelector('.bl-tok')).toBeNull();
      expect(textOf(1)).toBe('const a = 1');
    });

    it('takes a highlighter, and draws what the line says, not what the tokens say', () => {
      const highlight = vi.fn((text: string, index: number) => [{ text: text.slice(0, 2), type: 'keyword' as const }, { text: 'XX', className: `line-${index}` }]);
      render(<CodeEditor readOnly variant="ghost" lines={['abcdef']} highlight={highlight} />);
      expect(highlight.mock.calls[0][0]).toBe('abcdef');
      expect(highlight.mock.calls[0][1]).toBe(0);
      expect(textOf(1)).toBe('abcdef');
      expect(document.querySelector('.line-0')?.textContent).toBe('cd');
    });

    it('shows plain text until a promise answers', async () => {
      let resolve: (tokens: { text: string; type: 'string' }[]) => void = () => {};
      const promised = new Promise<{ text: string; type: 'string' }[]>((r) => (resolve = r));
      render(<CodeEditor readOnly variant="ghost" lines={['later']} highlight={() => promised} />);
      expect(textOf(1)).toBe('later');
      expect(document.querySelector('.bl-tok')).toBeNull();
      await act(async () => { resolve([{ text: 'later', type: 'string' }]); });
      await flushFrames();
      expect(typeOf('later')).toContain('bl-tok-string');
    });

    it('stays plain when a highlighter fails, without troubling the page', async () => {
      render(<CodeEditor readOnly variant="ghost" lines={['later']} highlight={() => Promise.reject(new Error('WebGPU unavailable'))} />);
      await flushFrames();
      expect(textOf(1)).toBe('later');
    });

    it('gives a highlighter only the window of a long line', () => {
      const highlight = vi.fn((text: string) => [{ text }]);
      const line = 'x'.repeat(1 << 20);
      render(<CodeEditor readOnly variant="ghost" lines={[line]} highlight={highlight} />);
      expect(Math.max(...highlight.mock.calls.map(([text]) => text.length))).toBeLessThan(1000);
    });
  });

  describe('characters', () => {
    it('draws tabs as spaces to the next stop, and copies them as tabs', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['a\tb']} tabSize={4} highlight={null} />);
      expect(textOf(1)).toBe('a   b');
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText()).toBe('a\tb');
    });

    it('holds wide characters to two cells', () => {
      render(<CodeEditor readOnly variant="ghost" lines={['a漢b']} highlight={null} />);
      const box = [...document.querySelectorAll<HTMLElement>('[data-slot="code-editor-text"] span')].find((el) => el.textContent === '漢');
      expect(box?.style.width).toContain('* 2');
    });

    it('puts a click on the right side of a wide character', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['a漢b']} />);
      const code = document.querySelector('[data-slot="code-editor-code"]') as HTMLElement;
      const at = (cell: number) => ({ clientX: PADDING + cell * CELL, clientY: LINE / 2, pointerId: 1, pointerType: 'mouse', button: 0 });
      fireEvent.pointerDown(code, at(1));
      fireEvent.pointerMove(code, at(3));
      fireEvent.pointerUp(code, at(3));
      expect(ref.current?.getSelectionText()).toBe('漢');
    });
  });

  describe('wrapping', () => {
    it('gives a long line several rows, and the gutter only the first', () => {
      const ref = createRef<CodeEditorHandle>();
      // 800 px, less the gutter and padding, at 8 px a cell.
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['x'.repeat(1000), 'short']} wrap />);
      const rows = document.querySelectorAll('[data-slot="code-editor-line"][data-line="1"]');
      expect(rows.length).toBeGreaterThan(5);
      expect(document.querySelectorAll('[data-slot="code-editor-gutter-row"][data-line="1"]').length).toBe(1);
      const joined = [...rows].map((row) => row.textContent).join('');
      expect(joined.length).toBeLessThanOrEqual(1000);
      expect(root().className).toContain('overflow-x-hidden');
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText().length).toBe(1006);
    });

    it('still only renders what is on screen of a very long line', () => {
      render(<CodeEditor readOnly variant="ghost" lines={['x'.repeat(1 << 20)]} wrap />);
      expect(domText().length).toBeLessThan(5000);
      expect(document.querySelectorAll('[data-slot="code-editor-line"]').length).toBeLessThan(40);
    });
  });

  describe('keyboard', () => {
    const gutters: CodeEditorGutter[] = [
      { id: 'a', width: 20, render: () => 'A', onPress: () => {}, label: (n) => `a ${n}` },
      { id: 'b', width: 20, render: () => 'B', onPress: () => {}, label: (n) => `b ${n}` },
    ];
    const controls = () => [...document.querySelectorAll<HTMLElement>('[data-slot="code-editor-content"] button')];

    it('has one tab stop among all the buttons', () => {
      render(<CodeEditor readOnly variant="ghost" lines={numbered(50)} gutters={gutters} onLineNumberPress={() => {}} />);
      const stops = controls().filter((el) => el.getAttribute('tabindex') !== '-1');
      expect(controls().length).toBeGreaterThan(40);
      expect(stops.length).toBe(1);
    });

    it('moves with the arrow keys, down a gutter and along a line', () => {
      render(<CodeEditor readOnly variant="ghost" lines={numbered(50)} gutters={gutters} />);
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
      render(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} gutters={gutters} />);
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
          <CodeEditor readOnly variant="ghost" lines={numbered(5)} gutters={[{ id: 'p', width: 20, render: () => <input aria-label="Box" value={typed} onChange={(e) => setTyped(e.target.value)} /> }]} />
        );
      }
      render(<Host />);
      const box = screen.getAllByLabelText('Box')[0];
      fireEvent.keyDown(box, { key: 'a', metaKey: true });
      expect(document.querySelector('[data-slot="code-editor-selection"]')).toBeNull();
    });
  });

  describe('content', () => {
    it('reads getLine again only when the content changes', () => {
      const first = vi.fn(generated);
      const { rerender } = render(<CodeEditor readOnly variant="ghost" lineCount={100} getLine={first} contentKey="a" highlight={null} />);
      const second = vi.fn((i: number) => `other ${i}`);
      rerender(<CodeEditor readOnly variant="ghost" lineCount={100} getLine={second} contentKey="a" highlight={null} />);
      expect(textOf(1)).toBe('line 1');
      rerender(<CodeEditor readOnly variant="ghost" lineCount={100} getLine={second} contentKey="b" highlight={null} />);
      expect(textOf(1)).toBe('other 0');
    });

    it('with no key, a new getLine is new content', () => {
      const { rerender } = render(<CodeEditor readOnly variant="ghost" lineCount={100} getLine={generated} highlight={null} />);
      expect(textOf(1)).toBe('line 1');
      rerender(<CodeEditor readOnly variant="ghost" lineCount={100} getLine={(i) => `other ${i}`} highlight={null} />);
      expect(textOf(1)).toBe('other 0');
    });

    it('works in StrictMode', () => {
      const ref = createRef<CodeEditorHandle>();
      const { unmount } = render(<StrictMode><CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(100)} currentLine={50} /></StrictMode>);
      expect(lineNumbers()).toContain(50);
      act(() => ref.current?.selectAll());
      expect(ref.current?.getSelectionText().split('\n').length).toBe(100);
      unmount();
    });

    it('copes with no lines at all', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={[]} />);
      act(() => {
        ref.current?.scrollToLine(5);
        ref.current?.selectAll();
      });
      expect(ref.current?.getSelectionText()).toBe('');
      expect(document.querySelectorAll('[data-slot="code-editor-line"]').length).toBe(0);
    });
  });
});

/* ── One component, two renderers ── */

const inPage = () => document.querySelector('pre[data-slot="code-editor-content"]');
const windowed = () => document.querySelector('div[data-slot="code-editor-content"]');
const editorInput = () => document.querySelector('[data-slot="code-editor-input"]') as HTMLTextAreaElement | null;

describe('which renderer', () => {
  it('is windowed by default, since it can edit by default', () => {
    render(<CodeEditor defaultValue="const a = 1;" />);
    expect(windowed()).not.toBeNull();
    expect(editorInput()).not.toBeNull();
  });

  it('is in the page for a read-only text', () => {
    render(<CodeEditor readOnly value="const a = 1;" />);
    expect(inPage()?.textContent).toContain('const a = 1;');
    expect(editorInput()).toBeNull();
  });

  it('is windowed for what only that renderer can do', () => {
    const cases = [
      <CodeEditor readOnly lines={['a']} />,
      <CodeEditor readOnly lineCount={1} getLine={() => 'a'} />,
      <CodeEditor readOnly value="a" gutters={[]} />,
      <CodeEditor readOnly value="a" currentLine={1} />,
      <CodeEditor readOnly value="a" markers={[]} />,
      <CodeEditor readOnly value="a" lineDecoration={() => null} />,
      <CodeEditor readOnly value="a" scrollToLine={1} />,
      <CodeEditor readOnly value="a" highlight={() => null} />,
      <CodeEditor readOnly value="a" onCopyText={() => {}} />,
      <CodeEditor readOnly value="a" onSelectionChange={() => {}} />,
      <CodeEditor readOnly value="a" onLineNumberPress={() => {}} />,
    ];
    for (const element of cases) {
      const { unmount } = render(element);
      expect(windowed()).not.toBeNull();
      expect(editorInput()).toBeNull();
      unmount();
    }
  });

  it('stays in the page for what both can do', () => {
    render(<CodeEditor readOnly value="a" lineNumbers startLine={3} highlightLines={[3]} addedLines={[4]} removedLines={[5]} wrap maxHeight={100} lineProps={() => ({ id: 'x' })} engine="fallback" tabSize={4} lineHeight={18} title="t" showCopy />);
    expect(inPage()).not.toBeNull();
  });

  it('goes to the windowed renderer for a text too big for the page, by itself', () => {
    const big = Array.from({ length: 5001 }, (_, i) => `line ${i}`).join('\n');
    const { unmount } = render(<CodeEditor readOnly value={big} engine="fallback" />);
    expect(windowed()).not.toBeNull();
    expect(lineNumbers().length).toBeLessThan(100);
    unmount();
    render(<CodeEditor readOnly value={`a\n${'x'.repeat(40_000)}`} engine="fallback" />);
    expect(windowed()).not.toBeNull();
  });

  it('does as it is told, where it can', () => {
    const { unmount } = render(<CodeEditor readOnly windowed value="a" />);
    expect(windowed()).not.toBeNull();
    unmount();
    const big = Array.from({ length: 5001 }, (_, i) => `line ${i}`).join('\n');
    render(<CodeEditor readOnly windowed={false} value={big} engine="fallback" />);
    expect(inPage()).not.toBeNull();
  });

  it('is always in the page, and read-only, inline', () => {
    render(<p>Call <CodeEditor variant="inline" value="f()" engine="fallback" /> now</p>);
    const code = document.querySelector('code[data-slot="code-editor"]');
    expect(code?.textContent).toBe('f()');
    expect(editorInput()).toBeNull();
    expect(code?.closest('p')).not.toBeNull();
  });

  it('shows line numbers by default in an editor and a source view, and not for a snippet', () => {
    const { unmount } = render(<CodeEditor defaultValue="a" />);
    expect(document.querySelector('[data-gutter="line-number"]')).not.toBeNull();
    unmount();
    const next = render(<CodeEditor readOnly lines={['a']} />);
    expect(document.querySelector('[data-gutter="line-number"]')).not.toBeNull();
    next.unmount();
    render(<CodeEditor readOnly windowed value="a" />);
    expect(document.querySelector('[data-gutter="line-number"]')).toBeNull();
  });
});

describe('both renderers', () => {
  it('use the same token classes', () => {
    const { unmount } = render(<CodeEditor readOnly value="const a = 1;" engine="fallback" />);
    const page = [...document.querySelectorAll('.bl-tok')].map((el) => [el.textContent, el.className]);
    unmount();
    render(<CodeEditor readOnly windowed value="const a = 1;" />);
    const row = [...document.querySelectorAll('.bl-tok')].map((el) => [el.textContent, el.className]);
    expect(page).toEqual([['const', 'bl-tok bl-tok-keyword'], ['=', 'bl-tok bl-tok-operator'], ['1', 'bl-tok bl-tok-number']]);
    expect(row).toEqual(page);
  });

  it('count lines the same, from the same first line, marked the same way', () => {
    const { unmount } = render(<CodeEditor readOnly value={'a\nb\nc\n'} startLine={10} lineNumbers highlightLines={[11]} addedLines={[12]} engine="fallback" />);
    expect([...document.querySelectorAll('.bl-syntax-line')].map((el) => (el as HTMLElement).dataset.line)).toEqual(['10', '11', '12']);
    unmount();
    render(<CodeEditor readOnly windowed value={'a\nb\nc\n'} startLine={10} lineNumbers highlightLines={[11]} addedLines={[12]} />);
    expect(lineNumbers()).toEqual([10, 11, 12]);
    expect([...document.querySelectorAll('[data-mark]')].map((el) => (el as HTMLElement).dataset.mark)).toEqual(['highlight', 'add']);
    expect(document.querySelector('[data-gutter="diff-sign"]')).not.toBeNull();
  });

  it('take lineProps', () => {
    const { unmount } = render(<CodeEditor readOnly value={'a\nb'} lineProps={(n) => ({ id: `L${n}` })} engine="fallback" />);
    expect(document.querySelector('.bl-syntax-line#L2')).not.toBeNull();
    unmount();
    render(<CodeEditor readOnly windowed value={'a\nb'} lineProps={(n) => ({ id: `L${n}`, className: 'mine' })} />);
    expect(document.querySelector('[data-slot="code-editor-line"]#L2')?.className).toContain('mine');
  });

  it('answer the ref the same way', () => {
    const page = createRef<CodeEditorHandle>();
    const { unmount } = render(<CodeEditor ref={page} readOnly value="one" engine="fallback" />);
    expect(page.current?.getValue()).toBe('one');
    unmount();
    const win = createRef<CodeEditorHandle>();
    const next = render(<CodeEditor ref={win} readOnly lines={['one', 'two']} />);
    expect(win.current?.getValue()).toBe('one\ntwo');
    next.unmount();
    const editor = createRef<CodeEditorHandle>();
    const third = render(<CodeEditor ref={editor} defaultValue={'one\r\ntwo\r\n'} />);
    expect(editor.current?.getValue()).toBe('one\r\ntwo\r\n');
    expect(editor.current?.getSelection()).toEqual({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 0 } });
    third.unmount();
    const inline = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={inline} readOnly variant="inline" value="x" engine="fallback" />);
    expect(inline.current?.getValue()).toBe('x');
  });
});

describe('a text in the page', () => {
  it('is rendered on the server, with every character there', async () => {
    const { renderToString } = await import('react-dom/server');
    const html = renderToString(<CodeEditor readOnly value="const a = 1;" language="ts" title="a.ts" engine="fallback" />);
    expect(html).toContain('bl-tok-keyword');
    expect(html).toContain('a.ts');
    const inline = renderToString(<CodeEditor readOnly variant="inline" value="f()" engine="fallback" />);
    expect(inline).toContain('<code');
    expect(inline).toContain('f');
  });

  it('copies the text, from the button', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<CodeEditor readOnly value="copy me" showCopy engine="fallback" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy code' })); });
    expect(writeText).toHaveBeenCalledWith('copy me');
  });
});

describe('an editor', () => {
  const type = async (text: string) => {
    const input = editorInput() as HTMLTextAreaElement;
    await act(async () => {
      input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, cancelable: true, bubbles: true }));
    });
  };

  it('is a labelled textbox with the focus on the real input', () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} defaultValue="a" aria-label="app.js" />);
    const input = editorInput() as HTMLTextAreaElement;
    expect(input.getAttribute('role')).toBe('textbox');
    expect(input.getAttribute('aria-multiline')).toBe('true');
    expect(input.getAttribute('aria-readonly')).toBe('false');
    expect(input.getAttribute('aria-label')).toBe('app.js');
    expect(windowed()?.getAttribute('tabindex')).toBeNull();
    act(() => ref.current?.focus());
    expect(document.activeElement).toBe(input);
  });

  it('reports changes both ways, and only joins the text if something wants it', async () => {
    const ref = createRef<CodeEditorHandle>();
    const onEdit = vi.fn();
    render(<CodeEditor ref={ref} defaultValue="ab" onEdit={onEdit} />);
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 1 }, focus: { line: 1, column: 1 } }));
    await type('X');
    expect(onEdit).toHaveBeenCalledWith({ from: { line: 1, column: 1 }, to: { line: 1, column: 1 }, newTo: { line: 1, column: 2 }, text: 'X', removed: '', origin: 'input' });
    expect(ref.current?.getValue()).toBe('aXb');
  });

  it('takes back from a controlled host what it gave, without parsing it again', async () => {
    const split = vi.spyOn(String.prototype, 'split');
    const seen: string[] = [];
    function Host() {
      const [value, setValue] = useState('start\nsecond');
      return <CodeEditor value={value} onChange={(next) => { seen.push(next); setValue(next); }} />;
    }
    render(<Host />);
    split.mockClear();
    await type('A');
    await type('B');
    expect(seen).toEqual(['Astart\nsecond', 'ABstart\nsecond']);
    expect(split.mock.calls.filter(([separator]) => separator === '\n').length).toBe(0);
    split.mockRestore();
  });

  it('a new value from outside is the edit it amounts to, and moves the caret with the text', async () => {
    const ref = createRef<CodeEditorHandle>();
    const noop = () => {};
    const { rerender } = render(<CodeEditor ref={ref} value={'one\ntwo'} onChange={noop} />);
    act(() => ref.current?.setSelection({ anchor: { line: 2, column: 2 }, focus: { line: 2, column: 2 } }));
    rerender(<CodeEditor ref={ref} value={'zero\none\ntwo'} onChange={noop} />);
    expect(ref.current?.getValue()).toBe('zero\none\ntwo');
    expect(ref.current?.getSelection()?.focus).toEqual({ line: 3, column: 2 });
  });

  it('keeps its text through turning read-only and back, undo and all', async () => {
    const ref = createRef<CodeEditorHandle>();
    const { rerender } = render(<CodeEditor ref={ref} defaultValue="a" />);
    await type('b');
    expect(ref.current?.getValue()).toBe('ba');
    rerender(<CodeEditor ref={ref} readOnly engine="fallback" />);
    expect(inPage()?.textContent).toContain('ba');
    rerender(<CodeEditor ref={ref} />);
    expect(ref.current?.getValue()).toBe('ba');
  });
});

describe('an editor, on what reaches its input', () => {
  const setup = (text: string, onEdit = vi.fn()) => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} defaultValue={text} onEdit={onEdit} />);
    return { ref, onEdit, input: editorInput() as HTMLTextAreaElement };
  };
  const fire = async (input: HTMLTextAreaElement, inputType: string, data: string | null = null) => {
    const event = new InputEvent('beforeinput', { inputType, data, cancelable: true, bubbles: true });
    await act(async () => { input.dispatchEvent(event); });
    return event;
  };

  it('takes every edit a keyboard can only describe, and stops the browser doing it too', async () => {
    const { ref, input } = setup('one two three');
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 13 }, focus: { line: 1, column: 13 } }));
    expect((await fire(input, 'deleteContentBackward')).defaultPrevented).toBe(true);
    expect(ref.current?.getValue()).toBe('one two thre');
    await fire(input, 'deleteWordBackward');
    expect(ref.current?.getValue()).toBe('one two ');
    await fire(input, 'insertLineBreak');
    expect(ref.current?.getValue()).toBe('one two \n');
    await fire(input, 'deleteContentBackward');
    await fire(input, 'deleteSoftLineBackward');
    expect(ref.current?.getValue()).toBe('');
    // The two deletes in a row are one step.
    await fire(input, 'historyUndo');
    expect(ref.current?.getValue()).toBe('one two \n');
    await fire(input, 'historyRedo');
    expect(ref.current?.getValue()).toBe('');
  });

  it('works out an edit it was not told about from what the browser did to the stand-in', async () => {
    const onEdit = vi.fn();
    const { ref, input } = setup('teh cat', onEdit);
    act(() => { ref.current?.setSelection({ anchor: { line: 1, column: 3 }, focus: { line: 1, column: 3 } }); ref.current?.focus(); });
    // A phone's autocorrect, say: it changes the input directly, around the caret, and nothing else says what it did.
    await act(async () => {
      input.value = input.value.replace('teh', 'the');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(ref.current?.getValue()).toBe('the cat');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0][0]).toMatchObject({ from: { line: 1, column: 1 }, to: { line: 1, column: 3 }, text: 'he', origin: 'input' });
  });

  it('takes the stand-in losing its mark as a Backspace, for a keyboard that says no more than that', async () => {
    const { ref, input } = setup('one\ntwo');
    act(() => { ref.current?.setSelection({ anchor: { line: 2, column: 0 }, focus: { line: 2, column: 0 } }); ref.current?.focus(); });
    await act(async () => {
      input.value = input.value.slice(1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(ref.current?.getValue()).toBe('onetwo');
  });

  it('keeps a selection it was given on the text there is', () => {
    const { ref } = setup('abc');
    act(() => ref.current?.setSelection({ anchor: { line: 9, column: 99 }, focus: { line: 9, column: 99 } }));
    expect(ref.current?.getSelection()?.focus).toEqual({ line: 1, column: 3 });
  });

  it('with a selection, the same difference replaces it', async () => {
    const { ref, input } = setup('one two three');
    act(() => { ref.current?.setSelection({ anchor: { line: 1, column: 4 }, focus: { line: 1, column: 7 } }); ref.current?.focus(); });
    await act(async () => {
      input.value = 'X';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(ref.current?.getValue()).toBe('one X three');
  });

  it('keeps what the input stands in for up to date', async () => {
    const { ref, input } = setup('first\nsecond');
    act(() => { ref.current?.setSelection({ anchor: { line: 2, column: 3 }, focus: { line: 2, column: 3 } }); ref.current?.focus(); });
    expect(input.value.endsWith('second')).toBe(true);
    expect(input.selectionStart).toBe(input.value.indexOf('second') + 3);
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 0 }, focus: { line: 2, column: 3 } }));
    expect(input.value).toBe('first\nsec');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('holds only a little of a very long line', async () => {
    const line = 'x'.repeat(1 << 20);
    const { ref, input } = setup(line);
    act(() => { ref.current?.setSelection({ anchor: { line: 1, column: 500_000 }, focus: { line: 1, column: 500_000 } }); ref.current?.focus(); });
    expect(input.value.length).toBeLessThan(1024);
  });

  it('asks nobody to join the text unless they asked for it', async () => {
    const join = vi.spyOn(Array.prototype, 'join');
    const onEdit = vi.fn();
    const { input } = setup(Array.from({ length: 1000 }, (_, i) => `line ${i}`).join('\n'), onEdit);
    join.mockClear();
    await fire(input, 'insertText', 'a');
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(join.mock.instances.filter((list) => Array.isArray(list) && (list as unknown[]).length >= 1000).length).toBe(0);
    join.mockRestore();
  });
});

describe('what is kept by line, through an edit', () => {
  const type = async (data: string, inputType = 'insertText') => {
    const input = editorInput() as HTMLTextAreaElement;
    await act(async () => {
      input.dispatchEvent(new InputEvent('beforeinput', { inputType, data, cancelable: true, bubbles: true }));
    });
  };

  it('a marker keeps its column on the grid when the line changes around it', async () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} variant="ghost" defaultValue={'abcdef\nsecond'} markers={[{ line: 1, column: 4, label: 'here' }]} />);
    const left = () => parseFloat((document.querySelector('[data-slot="code-editor-marker"]') as HTMLElement).style.left);
    const before = left();
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 0 } }));
    // A character two cells wide before the column: the same column is one cell further along.
    await type('漢');
    expect(left()).toBe(before + CELL);
  });

  it('a host\'s lookup by line is asked again for the lines as they are now', async () => {
    const lookup = vi.fn((line: number) => (line === 2 ? [{ column: 0, label: `on ${line}` }] : null));
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} defaultValue={'one\ntwo\nthree'} markers={lookup} />);
    expect(lineEl(2)?.querySelector('[data-slot="code-editor-marker"]')).not.toBeNull();
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 3 }, focus: { line: 1, column: 3 } }));
    await type('', 'insertLineBreak');
    // The numbers are the host's, so line 2 is whatever's on line 2 now.
    expect(textOf(2)).toBe('');
    expect(lineEl(2)?.querySelector('[data-slot="code-editor-marker"]')).not.toBeNull();
    expect(textOf(3)).toBe('two');
    expect(lineEl(3)?.querySelector('[data-slot="code-editor-marker"]')).toBeNull();
  });

  it('a current line and a decoration stay on the numbers they were given', async () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} defaultValue={'one\ntwo\nthree'} currentLine={3} lineDecoration={(line) => (line === 1 ? { tint: 'warning' } : null)} />);
    const bands = () => [...document.querySelectorAll<HTMLElement>('[data-slot="code-editor-band"]')].map((el) => [el.dataset.tint, parseFloat(el.style.top)]);
    const before = bands();
    act(() => ref.current?.setSelection({ anchor: { line: 3, column: 0 }, focus: { line: 3, column: 0 } }));
    await type('x');
    expect(bands()).toEqual(before);
  });

  it('wrapping knows a line got longer, and only moves rows when it has to', async () => {
    const ref = createRef<CodeEditorHandle>();
    // 800 px wide with a gutter, and a cell of 8 px: a little under 100 cells to a row.
    render(<CodeEditor ref={ref} variant="ghost" defaultValue={`${'x'.repeat(10)}\nnext`} wrap lineNumbers={false} />);
    await flushFrames();
    const rows = () => document.querySelectorAll('[data-slot="code-editor-line"][data-line="1"]').length;
    expect(rows()).toBe(1);
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 10 }, focus: { line: 1, column: 10 } }));
    await type('y'.repeat(300));
    expect(rows()).toBeGreaterThan(3);
    await act(async () => {
      (editorInput() as HTMLTextAreaElement).dispatchEvent(new InputEvent('beforeinput', { inputType: 'historyUndo', cancelable: true, bubbles: true }));
    });
    expect(rows()).toBe(1);
    expect(textOf(2)).toBe('next');
  });
});

describe('the old names', () => {
  it('all go through CodeEditor, with their slots, and look the same', async () => {
    const { SyntaxHighlighting, SyntaxHighlightingContent, SyntaxHighlightingHeader, SyntaxHighlightingTitle, SyntaxHighlightingCopyButton, syntaxHighlightingVariants, useSyntaxHighlighting } = await import('@/components/ui/syntax-highlighting');
    const { codeEditorVariants } = await import('@/components/ui/code-editor');
    expect(syntaxHighlightingVariants).toBe(codeEditorVariants);
    let context: ReturnType<typeof useSyntaxHighlighting> = null;
    const Peek = () => {
      context = useSyntaxHighlighting();
      return null;
    };
    render(
      <SyntaxHighlighting code="const a = 1;" language="ts" engine="fallback">
        <SyntaxHighlightingHeader><SyntaxHighlightingTitle>a.ts</SyntaxHighlightingTitle><SyntaxHighlightingCopyButton /><Peek /></SyntaxHighlightingHeader>
        <SyntaxHighlightingContent lineNumbers highlightLines={[1]} />
      </SyntaxHighlighting>,
    );
    expect(document.querySelector('[data-slot="syntax-highlighting"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="syntax-highlighting-header"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="syntax-highlighting-title"]')?.textContent).toBe('a.ts');
    expect(document.querySelector('pre[data-slot="syntax-highlighting-content"]')?.getAttribute('data-line-numbers')).toBe('true');
    expect(document.querySelector('.bl-tok-keyword')?.textContent).toBe('const');
    expect(context).toMatchObject({ code: 'const a = 1;', language: 'ts', variant: 'default' });
  });

  it('inline too', async () => {
    const { SyntaxHighlighting } = await import('@/components/ui/syntax-highlighting');
    render(<SyntaxHighlighting variant="inline" code="f()" engine="fallback" />);
    expect(document.querySelector('code[data-slot="syntax-highlighting"]')?.textContent).toBe('f()');
  });
});
