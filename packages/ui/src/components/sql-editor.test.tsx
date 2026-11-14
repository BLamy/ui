// @vitest-environment happy-dom
import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPlatform } from '@ui-sdk/core/testing';
import { SqlEditor, SqlEditorFooter, SqlEditorRun, useSqlHistory, type SqlEditorHandle } from '@/components/ui/sql-editor';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const area = () => screen.getByRole('textbox', { name: 'SQL' }) as HTMLTextAreaElement;
const type = (text: string) => fireEvent.input(area(), { target: { value: text } });
// The label morphs between "Run" and "Running…", so the button is found by its place rather than its name.
const runButton = () => document.querySelector('[data-slot=sql-editor-footer] button') as HTMLButtonElement;
// The submit shortcut is ⌘ + Enter on Apple platforms and Ctrl + Enter elsewhere: exactly one of these is it.
const modEnter = () => {
  fireEvent.keyDown(area(), { key: 'Enter', ctrlKey: true });
  fireEvent.keyDown(area(), { key: 'Enter', metaKey: true });
};
const HISTORY = ['select 2', 'select 1'];

describe('SqlEditor', () => {
  it('is a named textarea over a highlighted copy of its text, and reports typing with its reason', () => {
    const onValueChange = vi.fn();
    render(<SqlEditor onValueChange={onValueChange} />);
    expect(area().tagName).toBe('TEXTAREA');
    type('select 1');
    expect(area().value).toBe('select 1');
    expect(onValueChange).toHaveBeenLastCalledWith('select 1', expect.objectContaining({ reason: 'input-change' }));
    expect(document.querySelector('[data-slot=sql-editor-highlight]')?.textContent).toBe('select 1\n');
    expect(document.querySelector('[data-slot=sql-editor-highlight]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('the submit shortcut runs everything, or the selection; Enter alone adds a line', () => {
    const onRun = vi.fn();
    render(<SqlEditor defaultValue="select 1; select 2" onRun={onRun} />);
    fireEvent.keyDown(area(), { key: 'Enter' });
    expect(onRun).not.toHaveBeenCalled();
    modEnter();
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenLastCalledWith('select 1; select 2');
    area().setSelectionRange(0, 8);
    modEnter();
    expect(onRun).toHaveBeenLastCalledWith('select 1');
  });

  it('the Run button runs too, and is disabled with nothing to run, while running, and when disabled', () => {
    const onRun = vi.fn();
    const { rerender } = render(<SqlEditor onRun={onRun} />);
    expect(screen.getByRole('button', { name: 'Run' })).toBe(runButton());
    expect(runButton().disabled).toBe(true);
    type('select 1');
    expect(runButton().disabled).toBe(false);
    fireEvent.click(runButton());
    expect(onRun).toHaveBeenLastCalledWith('select 1');
    rerender(<SqlEditor onRun={onRun} pending />);
    expect(runButton().disabled).toBe(true);
    modEnter();
    expect(onRun).toHaveBeenCalledTimes(1);
    rerender(<SqlEditor onRun={onRun} disabled />);
    expect(area().disabled).toBe(true);
    expect(runButton().disabled).toBe(true);
    expect(document.querySelector('[data-slot=sql-editor]')?.hasAttribute('data-disabled')).toBe(true);
  });

  it('the footer is a part: your controls go before Run, your own footer replaces it, `false` leaves it out', () => {
    const onRun = vi.fn();
    const { rerender } = render(<SqlEditor onRun={onRun} defaultValue="select 1" pending rows={4}><SqlEditorFooter><button type="button">Format</button></SqlEditorFooter></SqlEditor>);
    const root = document.querySelector<HTMLElement>('[data-slot=sql-editor]')!;
    expect(root.hasAttribute('data-pending')).toBe(true);
    expect(root.style.getPropertyValue('--editor-rows')).toBe('4');
    const buttons = [...document.querySelectorAll('[data-slot=sql-editor-footer] button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Format', 'Running…']);
    rerender(<SqlEditor onRun={onRun} defaultValue="select 1"><div><SqlEditorRun>Execute</SqlEditorRun></div></SqlEditor>);
    expect(document.querySelector('[data-slot=sql-editor-footer]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
    expect(onRun).toHaveBeenCalledWith('select 1');
    rerender(<SqlEditor onRun={onRun} defaultValue="select 1">{false}</SqlEditor>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ArrowUp on the first line and ArrowDown on the last step through the history (createInputHistory)', () => {
    const onValueChange = vi.fn();
    render(<SqlEditor history={HISTORY} onValueChange={onValueChange} />);
    type('draft');
    const up = () => fireEvent.keyDown(area(), { key: 'ArrowUp' });
    const down = () => fireEvent.keyDown(area(), { key: 'ArrowDown' });
    area().setSelectionRange(0, 0);
    expect(up()).toBe(false); // claimed: the default (caret move) is prevented
    expect(area().value).toBe('select 2');
    expect(onValueChange).toHaveBeenLastCalledWith('select 2', expect.objectContaining({ reason: 'imperative' }));
    expect(area().selectionStart).toBe('select 2'.length); // the caret goes to the end of the entry
    area().setSelectionRange(0, 0);
    up();
    expect(area().value).toBe('select 1');
    area().setSelectionRange(0, 0);
    expect(up()).toBe(true); // the oldest: nothing older, so the key stays the browser's
    expect(area().value).toBe('select 1');
    down();
    expect(area().value).toBe('select 2');
    down(); // past the newest: the draft comes back
    expect(area().value).toBe('draft');
    expect(down()).toBe(true);
    expect(area().value).toBe('draft');
  });

  it('leaves the arrows alone with a modifier, mid-text, on a read-only editor, and when the step is canceled', () => {
    const onValueChange = vi.fn((_: string, details: { reason: string; cancel: () => void }) => {
      if (details.reason === 'imperative') details.cancel();
    });
    const { rerender } = render(<SqlEditor history={HISTORY} defaultValue={'select 3\nfrom t'} onValueChange={onValueChange} />);
    area().setSelectionRange(0, 0);
    fireEvent.keyDown(area(), { key: 'ArrowUp', altKey: true });
    expect(area().value).toBe('select 3\nfrom t');
    area().setSelectionRange(12, 12); // on the second line: ArrowUp moves the caret
    expect(fireEvent.keyDown(area(), { key: 'ArrowUp' })).toBe(true);
    area().setSelectionRange(0, 0);
    expect(fireEvent.keyDown(area(), { key: 'ArrowUp' })).toBe(true); // canceled by onValueChange
    expect(onValueChange).toHaveBeenLastCalledWith('select 2', expect.objectContaining({ reason: 'imperative', canceled: true }));
    expect(area().value).toBe('select 3\nfrom t');
    rerender(<SqlEditor history={HISTORY} defaultValue={'select 3\nfrom t'} readOnly />);
    area().setSelectionRange(0, 0);
    expect(fireEvent.keyDown(area(), { key: 'ArrowUp' })).toBe(true);
    expect(area().value).toBe('select 3\nfrom t');
  });

  it('the footer spells the run and history keys for the reader’s platform', () => {
    // What is on screen: a keycap's spelled-out words for screen readers (`.sr-only`) are left out.
    const hint = () => {
      const footer = document.querySelector('[data-slot=sql-editor-footer]')?.cloneNode(true) as HTMLElement | undefined;
      footer?.querySelectorAll('.sr-only').forEach((n) => n.remove());
      return (footer?.textContent ?? '').replace(/[\u2066-\u2069]/g, '');
    };
    setPlatform('other');
    const other = render(<SqlEditor history={HISTORY} />);
    expect(hint()).toMatch(/^Ctrl\+Enterruns the selection, or everythingUphistory/);
    other.unmount();
    setPlatform('apple');
    render(<SqlEditor />);
    expect(hint()).toMatch(/^⌘.+runs the selection, or everything/);
    expect(hint()).not.toContain('Up');
    expect(hint()).not.toContain('Ctrl');
    expect(hint()).not.toContain('history');
  });

  it('shows the hint by the footer’s own width (a container query), never the viewport’s', () => {
    render(<SqlEditor />);
    const footer = document.querySelector<HTMLElement>('[data-slot=sql-editor-footer]')!;
    expect(footer.className).toMatch(/(^| )@container\/sql-footer( |$)/);
    const classes = Array.from(footer.querySelectorAll('*')).flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/));
    expect(classes).toContain('@md/sql-footer:inline-flex');
    // No viewport breakpoint (`sm:`, `md:`…) decides what the footer shows.
    expect(classes.filter((c) => /^(sm|md|lg|xl|2xl):/.test(c))).toEqual([]);
  });

  it('is controlled with value, read-only when asked, and insert() writes at the cursor', () => {
    const ref = createRef<SqlEditorHandle>();
    const onValueChange = vi.fn();
    const { rerender } = render(<SqlEditor ref={ref} value="select  from t" onValueChange={onValueChange} />);
    area().setSelectionRange(7, 7);
    act(() => { ref.current?.insert('id'); });
    expect(onValueChange).toHaveBeenLastCalledWith('select id from t', expect.objectContaining({ reason: 'imperative' }));
    rerender(<SqlEditor ref={ref} value="select id from t" onValueChange={onValueChange} readOnly />);
    expect(area().value).toBe('select id from t');
    expect(area().readOnly).toBe(true);
  });
});

describe('useSqlHistory', () => {
  afterEach(() => localStorage.clear());

  it('keeps runs newest first, skips blanks and repeats, and saves them under its key', () => {
    const { result } = renderHook(() => useSqlHistory('sql-test', 3));
    act(() => { result.current.push(' select 1 '); result.current.push('select 2'); result.current.push(''); });
    expect(result.current.entries).toEqual(['select 2', 'select 1']);
    act(() => { result.current.push('select 1'); });
    expect(result.current.entries).toEqual(['select 1', 'select 2']);
    expect(JSON.parse(localStorage.getItem('sql-test') ?? '[]')).toEqual(['select 1', 'select 2']);
    act(() => { result.current.push('select 3'); result.current.push('select 4'); });
    expect(result.current.entries).toEqual(['select 4', 'select 3', 'select 1']);
    act(() => { result.current.clear(); });
    expect(result.current.entries).toEqual([]);
    expect(localStorage.getItem('sql-test')).toBeNull();
  });

  it('reads saved runs after mount, ignores a corrupt value, and follows other tabs', () => {
    localStorage.setItem('sql-test', JSON.stringify(['select 9', 7]));
    const { result } = renderHook(() => useSqlHistory('sql-test'));
    expect(result.current.entries).toEqual(['select 9']);
    act(() => {
      localStorage.setItem('sql-test', JSON.stringify(['select 10', 'select 9']));
      window.dispatchEvent(new StorageEvent('storage', { key: 'sql-test', storageArea: localStorage }));
    });
    expect(result.current.entries).toEqual(['select 10', 'select 9']);
    act(() => {
      localStorage.setItem('sql-test', '{nope');
      window.dispatchEvent(new StorageEvent('storage', { key: 'sql-test', storageArea: localStorage }));
    });
    expect(result.current.entries).toEqual([]);
  });

  it('without a key it keeps runs in memory only', () => {
    const { result } = renderHook(() => useSqlHistory());
    act(() => { result.current.push('select 1'); });
    expect(result.current.entries).toEqual(['select 1']);
    expect(localStorage.length).toBe(0);
  });
});
