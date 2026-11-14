// @vitest-environment happy-dom
import { StrictMode, createRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CodeEditor, type CodeEditorGutter, type CodeEditorHandle } from '@/components/ui/code-editor';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

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

  it('in the page renderer, the tab stop is a region with the editor\'s name, and the root carries none', () => {
    render(<CodeEditor readOnly value="npm i x" aria-label="Install command" />);
    const pre = document.querySelector('pre[data-slot="code-editor-content"]') as HTMLElement;
    expect(pre).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Install command' })).toBe(pre);
    expect(pre.tabIndex).toBe(0);
    expect(document.querySelector('[data-slot="code-editor"]')!.hasAttribute('aria-label')).toBe(false);
    cleanup();
    render(<CodeEditor readOnly value="x" title="setup.sh" />);
    expect(screen.getByRole('region', { name: 'setup.sh' })).toBeTruthy();
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
      { id: 'dot', width: 16, render: () => '•', onClick: vi.fn(), clickable: (n) => n % 2 === 0, label: (n) => `Toggle ${n}` },
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
      const onClick = vi.fn();
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} gutters={[{ ...gutters[1], onClick }]} />);
      const two = screen.getByRole('button', { name: 'Toggle 2' });
      fireEvent.click(two);
      expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }), expect.objectContaining({ line: 2, source: expect.any(String) }));
      expect(screen.queryByRole('button', { name: 'Toggle 3' })).toBeNull();
    });

    it('line numbers are buttons only when they do something', () => {
      const onLineNumberClick = vi.fn();
      const { unmount } = render(<CodeEditor readOnly variant="ghost" lines={numbered(3)} />);
      expect(screen.queryByRole('button')).toBeNull();
      unmount();
      render(<CodeEditor readOnly variant="ghost" lines={numbered(3)} lineNumbers={{ onClick: onLineNumberClick, clickable: (n) => n !== 2, label: (n) => `Jump to ${n}` }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Jump to 3' }));
      expect(onLineNumberClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }), expect.objectContaining({ line: 3 }));
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
      const onClick = vi.fn();
      const { unmount } = render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} markers={[{ line: 2, column: 3, label: 'Site at 3', onClick }, { line: 2, column: 1, label: 'Site at 1', active: true, onClick }]} />);
      const three = screen.getByRole('button', { name: 'Site at 3' });
      expect(parseFloat(three.style.left)).toBe(PADDING + 3 * CELL);
      fireEvent.click(three);
      expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ type: 'click' }), expect.objectContaining({ line: 2, marker: expect.objectContaining({ column: 3 }) }));
      expect(screen.getByRole('button', { name: 'Site at 1' }).getAttribute('aria-pressed')).toBe('true');
      unmount();
      render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} markers={(n) => (n === 4 ? [{ column: 2, label: 'Only here' }] : undefined)} />);
      expect(lineEl(4)?.querySelectorAll('[data-code-editor-cell="marker"]').length).toBe(1);
      expect(lineEl(3)?.querySelectorAll('[data-code-editor-cell="marker"]').length).toBe(0);
    });

    it('on a long line, only the ones in the part that is rendered are in the DOM', () => {
      const marks = Array.from({ length: 50_000 }, (_, i) => ({ column: i * 20, label: `At ${i * 20}`, onClick: () => {} }));
      render(<CodeEditor readOnly variant="ghost" lines={['x'.repeat(1_000_000)]} markers={(n) => (n === 1 ? marks : undefined)} />);
      expect(document.querySelectorAll('[data-code-editor-cell="marker"]').length).toBeLessThan(40);
      scrollTo({ left: 800_000 * CELL });
      const labels = [...document.querySelectorAll('[data-code-editor-cell="marker"]')].map((el) => el.getAttribute('aria-label'));
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
      const { rerender } = render(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} revealLine={{ line: 500, align: 'start' }} />);
      expect(root().scrollTop).toBe(499 * LINE);
      root().scrollTop = 0;
      // The same target again, as a new object: not a change.
      rerender(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} revealLine={{ line: 500, align: 'start' }} />);
      expect(root().scrollTop).toBe(0);
      rerender(<CodeEditor readOnly variant="ghost" lines={numbered(10_000)} revealLine={700} />);
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
    // `buttons` is what a held mouse reports: UI SDK's `bindDrag` ends a drag on a move without it.
    const at = (row: number, column: number) => ({ clientX: PADDING + column * CELL, clientY: row * LINE + LINE / 2, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 });

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
      expect(onSelectionChange).toHaveBeenLastCalledWith({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 2 } }, expect.objectContaining({ reason: 'imperative', source: 'programmatic' }));
      rerender(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(4)} onSelectionChange={onSelectionChange} />);
      expect(ref.current?.getSelection()).toBeNull();
      expect(onSelectionChange).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: 'imperative' }));
    });

    it('a press on a marker or gutter button starts no selection', () => {
      const ref = createRef<CodeEditorHandle>();
      render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(3)} markers={[{ line: 1, column: 0, label: 'Mark', onClick: () => {} }]} />);
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
      const at = (cell: number) => ({ clientX: PADDING + cell * CELL, clientY: LINE / 2, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 });
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
      { id: 'a', width: 20, render: () => 'A', onClick: () => {}, label: (n) => `a ${n}` },
      { id: 'b', width: 20, render: () => 'B', onClick: () => {}, label: (n) => `b ${n}` },
    ];
    const controls = () => [...document.querySelectorAll<HTMLElement>('[data-slot="code-editor-content"] button')];

    it('has one tab stop among all the buttons', () => {
      render(<CodeEditor readOnly variant="ghost" lines={numbered(50)} gutters={gutters} lineNumbers={{ onClick: () => {} }} />);
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
      <CodeEditor readOnly value="a" revealLine={1} />,
      <CodeEditor readOnly value="a" highlight={() => null} />,
      <CodeEditor readOnly value="a" onCopyText={() => {}} />,
      <CodeEditor readOnly value="a" onSelectionChange={() => {}} />,
      <CodeEditor readOnly value="a" lineNumbers={{ onClick: () => {} }} />,
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
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ from: { line: 1, column: 1 }, to: { line: 1, column: 1 }, newTo: { line: 1, column: 2 }, text: 'X', removed: '', reason: 'input-change' }));
    expect(ref.current?.getValue()).toBe('aXb');
  });

  it('an edit canceled in onEdit is taken back and never reaches onValueChange', async () => {
    const ref = createRef<CodeEditorHandle>();
    const onValueChange = vi.fn();
    render(<CodeEditor ref={ref} defaultValue="ab" onEdit={(details) => details.cancel()} onValueChange={onValueChange} />);
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 1 }, focus: { line: 1, column: 1 } }));
    await type('X');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(ref.current?.getValue()).toBe('ab');
  });

  it('takes back from a controlled host what it gave, without parsing it again', async () => {
    const split = vi.spyOn(String.prototype, 'split');
    const seen: string[] = [];
    function Host() {
      const [value, setValue] = useState('start\nsecond');
      return <CodeEditor value={value} onValueChange={(next) => { seen.push(next); setValue(next); }} />;
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
    const { rerender } = render(<CodeEditor ref={ref} value={'one\ntwo'} onValueChange={noop} />);
    act(() => ref.current?.setSelection({ anchor: { line: 2, column: 2 }, focus: { line: 2, column: 2 } }));
    rerender(<CodeEditor ref={ref} value={'zero\none\ntwo'} onValueChange={noop} />);
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
    expect(onEdit.mock.calls[0][0]).toMatchObject({ from: { line: 1, column: 1 }, to: { line: 1, column: 3 }, text: 'he', reason: 'input-change' });
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
    const left = () => parseFloat((document.querySelector('[data-code-editor-cell="marker"]') as HTMLElement).style.left);
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
    expect(lineEl(2)?.querySelector('[data-code-editor-cell="marker"]')).not.toBeNull();
    act(() => ref.current?.setSelection({ anchor: { line: 1, column: 3 }, focus: { line: 1, column: 3 } }));
    await type('', 'insertLineBreak');
    // The numbers are the host's, so line 2 is whatever's on line 2 now.
    expect(textOf(2)).toBe('');
    expect(lineEl(2)?.querySelector('[data-code-editor-cell="marker"]')).not.toBeNull();
    expect(textOf(3)).toBe('two');
    expect(lineEl(3)?.querySelector('[data-code-editor-cell="marker"]')).toBeNull();
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

/* ── Gestures on UI SDK's behaviors: `bindDrag` follows a selection drag, `bindHold` tells a finger's tap from its long press ── */

describe('pointer gestures', () => {
  const codeLayer = () => document.querySelector('[data-slot="code-editor-code"]') as HTMLElement;
  const at = (row: number, column: number, pointerType = 'mouse') =>
    ({ clientX: PADDING + column * CELL, clientY: row * LINE + LINE / 2, pointerId: 1, pointerType, isPrimary: true, button: 0, buttons: 1 });
  const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

  it('follows a drag with pointer capture, and selects as it goes', () => {
    const capture = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: capture });
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['const a = 1;', 'const b = 2;']} />);
    fireEvent.pointerDown(codeLayer(), at(0, 0));
    expect(capture).toHaveBeenCalledWith(1);
    expect(capture.mock.contexts[0]).toBe(codeLayer());
    fireEvent.pointerMove(document, at(1, 5));
    fireEvent.pointerUp(document, at(1, 5));
    expect(ref.current?.getSelectionText()).toBe('const a = 1;\nconst');
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).setPointerCapture;
  });

  it('scrolls when a drag goes past the bottom of the view, and selects what comes in', async () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor readOnly variant="ghost" ref={ref} lines={numbered(2000)} />);
    fireEvent.pointerDown(codeLayer(), at(1, 0));
    fireEvent.pointerMove(document, { ...at(0, 0), clientY: HEIGHT + 60 });
    await wait(80);
    expect(root().scrollTop).toBeGreaterThan(400);
    fireEvent.pointerUp(document, { ...at(0, 0), clientY: HEIGHT + 60 });
    const selection = ref.current?.getSelection();
    expect(selection?.anchor.line).toBe(2);
    expect(selection?.focus.line).toBeGreaterThan(HEIGHT / LINE + 20);
    const top = root().scrollTop;
    await wait(40);
    expect(root().scrollTop).toBe(top);
  });

  it('a tap with a finger puts the caret there', async () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} variant="ghost" defaultValue={'const a = 1;\nconst b = 2;'} />);
    fireEvent.pointerDown(codeLayer(), at(1, 4, 'touch'));
    fireEvent.pointerUp(document, at(1, 4, 'touch'));
    expect(ref.current?.getSelection()).toEqual({ anchor: { line: 2, column: 4 }, focus: { line: 2, column: 4 } });
    expect(document.activeElement).toBe(editorInput());
  });

  it('a finger that moves first is a pan, not a tap', async () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} variant="ghost" defaultValue={'const a = 1;\nconst b = 2;'} />);
    fireEvent.pointerDown(codeLayer(), at(1, 4, 'touch'));
    fireEvent.pointerMove(document, { ...at(1, 4, 'touch'), clientY: LINE * 1.5 + 30 });
    fireEvent.pointerUp(document, { ...at(1, 4, 'touch'), clientY: LINE * 1.5 + 30 });
    expect(ref.current?.getSelection()).toEqual({ anchor: { line: 1, column: 0 }, focus: { line: 1, column: 0 } });
  });

  it('a long press selects the word, and dragging from it selects more', async () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['const alpha = 1;', 'const beta = 2;']} />);
    fireEvent.pointerDown(codeLayer(), at(0, 7, 'touch'));
    await wait(520);
    expect(ref.current?.getSelectionText()).toBe('alpha');
    fireEvent.pointerMove(document, at(1, 8, 'touch'));
    fireEvent.pointerUp(document, at(1, 8, 'touch'));
    expect(ref.current?.getSelectionText()).toBe('alpha = 1;\nconst beta');
  });
});

/* ── The gutter buttons and markers: one roving tab stop (lib/code-editor-primitive.ts) over every line, shown or not ── */

describe('controls', () => {
  const focused = () => document.activeElement?.getAttribute('aria-label');
  const key = (name: string) => act(() => { fireEvent.keyDown(document.activeElement as Element, { key: name }); });

  it('goes down a gutter to a line that is not rendered yet, and brings it in', async () => {
    const gutters: CodeEditorGutter[] = [{ id: 'bp', width: 16, render: () => null, onClick: () => {}, clickable: (n) => n === 1 || n === 4000, label: (n) => `bp ${n}` }];
    render(<CodeEditor readOnly variant="ghost" lines={numbered(5000)} gutters={gutters} />);
    act(() => screen.getByRole('button', { name: 'bp 1' }).focus());
    await key('ArrowDown');
    await flushFrames();
    expect(lineNumbers()).toContain(4000);
    expect(focused()).toBe('bp 4000');
    await key('ArrowUp');
    await flushFrames();
    expect(focused()).toBe('bp 1');
    // At the first one, the key stays the gutter's.
    const up = fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowUp' });
    expect(up).toBe(false);
  });

  it('Home and End go to the ends of a line, markers included', () => {
    const gutters: CodeEditorGutter[] = [
      { id: 'a', width: 20, render: () => 'A', onClick: () => {}, label: (n) => `a ${n}` },
      { id: 'b', width: 20, render: () => 'B', onClick: () => {}, label: (n) => `b ${n}` },
    ];
    render(<CodeEditor readOnly variant="ghost" lines={numbered(5)} gutters={gutters} markers={[{ line: 2, column: 1, label: 'm1', onClick: () => {} }, { line: 2, column: 4, label: 'm4', onClick: () => {} }]} />);
    act(() => screen.getByRole('button', { name: 'b 2' }).focus());
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
    expect(focused()).toBe('m4');
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' });
    expect(focused()).toBe('m1');
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
    expect(focused()).toBe('a 2');
  });

  it('goes down from a marker to the nearest one on the next line that has any', () => {
    render(<CodeEditor readOnly variant="ghost" lines={numbered(6)} markers={[
      { line: 1, column: 8, label: 'one at 8', onClick: () => {} },
      { line: 3, column: 1, label: 'three at 1', onClick: () => {} },
      { line: 3, column: 7, label: 'three at 7', onClick: () => {} },
    ]} />);
    act(() => screen.getByRole('button', { name: 'one at 8' }).focus());
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
    expect(focused()).toBe('three at 7');
  });

  it('takes in a control a cell holds, and keeps one tab stop with it', async () => {
    const gutters: CodeEditorGutter[] = [{
      id: 'pop',
      width: 30,
      render: (n) => (n % 100 === 1 ? <button type="button">{`pop ${n}`}</button> : null),
      focusable: (n) => n % 100 === 1,
    }, { id: 'bp', width: 16, render: () => null, onClick: () => {}, label: (n) => `bp ${n}` }];
    render(<CodeEditor readOnly variant="ghost" lines={numbered(500)} gutters={gutters} />);
    await flushFrames();
    const stops = [...document.querySelectorAll('[data-slot="code-editor-content"] button')].filter((el) => el.getAttribute('tabindex') === '0');
    expect(stops.length).toBe(1);
    act(() => screen.getByRole('button', { name: 'pop 1' }).focus());
    await key('ArrowRight');
    expect(focused()).toBe('bp 1');
    await key('ArrowLeft');
    expect(document.activeElement?.textContent).toBe('pop 1');
    await key('ArrowDown');
    await flushFrames();
    expect(document.activeElement?.textContent).toBe('pop 101');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
  });

  it('takes in a control that appears in a cell already on screen, and lets go of one that leaves', async () => {
    let toggle: (n: number) => void = () => {};
    function Host() {
      const [set, setSet] = useState<number[]>([1]);
      toggle = (n) => setSet((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
      const gutters: CodeEditorGutter[] = [{
        id: 'pop',
        width: 30,
        render: (n) => (set.includes(n) ? <button type="button">{`pop ${n}`}</button> : null),
        focusable: (n) => set.includes(n),
      }];
      return <CodeEditor readOnly variant="ghost" lines={numbered(50)} gutters={gutters} />;
    }
    render(<Host />);
    await flushFrames();
    act(() => toggle(3));
    await flushFrames();
    // One Tab stop still: the new control is in the group, not a second stop.
    expect(screen.getByRole('button', { name: 'pop 3' }).getAttribute('tabindex')).toBe('-1');
    act(() => screen.getByRole('button', { name: 'pop 1' }).focus());
    await key('ArrowDown');
    expect(document.activeElement?.textContent).toBe('pop 3');
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
    act(() => toggle(1));
    await flushFrames();
    await key('ArrowUp');
    expect(document.activeElement?.textContent).toBe('pop 3');
  });

  it('reports a press on a gutter button with UI SDK details and the line', () => {
    const onClick = vi.fn();
    render(<CodeEditor readOnly variant="ghost" lines={numbered(3)} gutters={[{ id: 'bp', width: 16, render: () => null, onClick, label: (n) => `bp ${n}` }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'bp 2' }));
    const [event, details] = onClick.mock.calls[0];
    expect(event.type).toBe('click');
    expect(details).toEqual({ source: expect.any(String), line: 2 });
  });
});

/* ── Changes, as UI SDK reports them: `(value, details)` with a reason, the event, a source and `cancel()` ── */

describe('change details', () => {
  const type = async (text: string) => {
    await act(async () => {
      editorInput()?.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, cancelable: true, bubbles: true }));
    });
  };
  const input = async (inputType: string) => {
    await act(async () => {
      editorInput()?.dispatchEvent(new InputEvent('beforeinput', { inputType, cancelable: true, bubbles: true }));
    });
  };

  it('gives each edit its reason and the event behind it', async () => {
    const onValueChange = vi.fn();
    render(<CodeEditor defaultValue="ab" onValueChange={onValueChange} />);
    await type('X');
    await input('deleteContentBackward');
    await input('historyUndo');
    const reasons = onValueChange.mock.calls.map(([, details]) => details.reason);
    expect(reasons).toEqual(['input-change', 'delete', 'undo']);
    const [value, details] = onValueChange.mock.calls[0];
    expect(value).toBe('Xab');
    expect(details.event.type).toBe('beforeinput');
    expect(details.source).toBe('programmatic');
    expect(details.canceled).toBe(false);
  });

  it('takes an edit back when the host cancels it, in an editor that holds its own text', async () => {
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} defaultValue="ab" onEdit={(details) => { if (details.text === 'X') details.cancel(); }} />);
    await type('X');
    expect(ref.current?.getValue()).toBe('ab');
    expect(ref.current?.getSelection()?.focus).toEqual({ line: 1, column: 0 });
    await type('Y');
    expect(ref.current?.getValue()).toBe('Yab');
    // Nothing of the canceled edit is left to undo.
    await input('historyUndo');
    expect(ref.current?.getValue()).toBe('ab');
  });

  it('a canceled undo leaves the text, and the history where it was', async () => {
    const ref = createRef<CodeEditorHandle>();
    let refuse = true;
    render(<CodeEditor ref={ref} defaultValue="ab" onEdit={(details) => { if (details.reason === 'undo' && refuse) details.cancel(); }} />);
    await type('X');
    await input('historyUndo');
    expect(ref.current?.getValue()).toBe('Xab');
    refuse = false;
    await input('historyUndo');
    expect(ref.current?.getValue()).toBe('ab');
    await input('historyRedo');
    expect(ref.current?.getValue()).toBe('Xab');
  });

  it('says why the selection moved, and a host can keep it where it is', () => {
    const ref = createRef<CodeEditorHandle>();
    const reasons: string[] = [];
    let refuse = false;
    render(<CodeEditor readOnly variant="ghost" ref={ref} lines={['const a = 1;', 'const b = 2;']} onSelectionChange={(_selection, details) => {
      reasons.push(details.reason);
      if (refuse) details.cancel();
    }} />);
    const code = document.querySelector('[data-slot="code-editor-code"]') as HTMLElement;
    const at = (column: number) => ({ clientX: PADDING + column * CELL, clientY: LINE / 2, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1 });
    fireEvent.pointerDown(code, at(0));
    fireEvent.pointerMove(document, at(4));
    fireEvent.pointerUp(document, at(4));
    fireEvent.keyDown(root(), { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(root(), { key: 'a', ctrlKey: true });
    fireEvent.keyDown(root(), { key: 'Escape' });
    expect(reasons).toEqual(['drag', 'caret-move', 'select-all', 'escape-key']);
    refuse = true;
    fireEvent.keyDown(root(), { key: 'a', ctrlKey: true });
    expect(ref.current?.getSelection()).toBeNull();
  });

  it('says it copied, through UI SDK’s announcer', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    render(<CodeEditor readOnly value="copy me" showCopy engine="fallback" />);
    expect(document.querySelector('[data-slot="code-editor"] [role="status"]')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy code' })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(document.body.textContent).toContain('Copied to clipboard');
  });
});
