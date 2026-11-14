// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '@ui-sdk/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PGliteProvider } from '@/lib/pglite';
import { SqlConsole, SqlConsoleEditor, SqlConsoleHeader, SqlConsoleResults } from '@/components/ui/sql-console';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
vi.setConfig({ testTimeout: 30_000 });

afterEach(async () => {
  cleanup();
  vi.mocked(announce).mockClear();
  // the provider closes its database a tick after unmounting
  await new Promise((r) => setTimeout(r, 20));
});

const wait = { timeout: 20_000 };
const area = () => screen.getByRole('textbox', { name: 'SQL' }) as HTMLTextAreaElement;
const runKeys = () => fireEvent.keyDown(area(), { key: 'Enter', ctrlKey: true });
vi.mock('@ui-sdk/core', async (original) => ({ ...(await original<typeof import('@ui-sdk/core')>()), announce: vi.fn() }));
// Button labels morph with framer-motion, whose canceled animations reject under happy-dom.
vi.mock('@/components/ui/text-morph', () => ({ TextMorph: ({ children }: { children: string }) => children }));
/** Everything handed to UI SDK's `announce()` so far. */
const announced = () => vi.mocked(announce).mock.calls.map(([text]) => text).join(' | ');
const ready = () => waitFor(() => expect(document.querySelector('[data-slot=sql-console]')?.getAttribute('data-status')).toBe('ready'), wait);

describe('SqlConsole', () => {
  it('announces the start, then runs a script into one named result table per statement', async () => {
    const onRun = vi.fn();
    render(
      <PGliteProvider>
        <SqlConsole timing={false} onRun={onRun} defaultValue="select 1 as one; select 2 as two;" />
      </PGliteProvider>,
    );
    // The visible line is not a live region mounted with its text: the start is announced instead.
    expect(document.querySelector('[data-slot=sql-console] [role=status]')).toBeNull();
    expect(screen.getByText(/Starting PostgreSQL/)).toBeTruthy();
    expect(announced()).toMatch(/Starting PostgreSQL/);
    await ready();
    expect(area().disabled).toBe(false);
    runKeys();
    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1), wait);
    expect(onRun.mock.calls[0][1].error).toBeUndefined();
    const results = document.querySelector<HTMLElement>('[data-slot=sql-console-results]')!;
    expect(within(results).getByLabelText('Result 1')).toBeTruthy();
    expect(within(results).getByLabelText('Result 2')).toBeTruthy();
    await waitFor(() => expect(announced()).toMatch(/2 results/));
  });

  it('puts the schema beside the editor by its own width, not the viewport', async () => {
    const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    let w = 420;
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => w });
    try {
      const { rerender } = render(<PGliteProvider><SqlConsole /></PGliteProvider>);
      const root = document.querySelector<HTMLElement>('[data-slot=sql-console]');
      expect(root?.getAttribute('data-size-class')).toBe('compact');
      expect(root?.className).not.toMatch(/(^|\s)md:/);
      // Two columns only with a sidebar to put in the first one.
      expect(root?.className).toContain('data-[size-class=medium]:has-[>[data-slot=sql-console-sidebar]]:grid');
      w = 800;
      rerender(<PGliteProvider><SqlConsole key="wide" /></PGliteProvider>);
      expect(document.querySelector('[data-slot=sql-console]')?.getAttribute('data-size-class')).toBe('medium');
    } finally {
      if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
    }
  });

  it('shows a failed query as an alert with the line, caret and SQLSTATE, and says a script applied nothing', async () => {
    render(
      <PGliteProvider>
        <SqlConsole defaultValue={'create table t (id int);\nselect nope from t;'}>
          <SqlConsoleHeader>{false}</SqlConsoleHeader>
          <SqlConsoleEditor />
          <SqlConsoleResults />
        </SqlConsole>
      </PGliteProvider>,
    );
    await ready();
    runKeys();
    const alert = await screen.findByRole('alert', {}, wait);
    expect(alert.textContent).toMatch(/Query failed/);
    expect(alert.textContent).toMatch(/SQLSTATE 42703/);
    expect(alert.textContent).toMatch(/LINE 2: select nope from t;/);
    expect(alert.textContent).toMatch(/none of its 2 statements were applied/);
    // Composed without a sidebar, it is one column whatever its width.
    expect(document.querySelector('[data-slot=sql-console-sidebar]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Database' })).toBeNull();
  });

  it('shows a result as a DataTable with its summary, typed headers and numbers at the end', async () => {
    render(
      <PGliteProvider>
        <SqlConsole timing={false} defaultValue="select 7 as n, 'seven' as word, null as nothing" />
      </PGliteProvider>,
    );
    await ready();
    runKeys();
    const grid = await screen.findByRole('grid', { name: 'Result 1' }, wait);
    expect(grid.closest('[data-slot=data-table]')?.querySelector('[data-slot=sql-console-summary]')?.textContent).toBe('1 row');
    const headers = within(grid).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['int4 n', 'word text', 'nothing text']);
    expect(headers[0].className).toContain('justify-end');
    expect(grid.querySelector('[data-kind=null]')?.textContent).toBe('NULL');
    await waitFor(() => expect(announced()).toMatch(/1 row/));
  });

  it('keeps run history in the sidebar tabs and puts a history entry back in the editor', async () => {
    render(
      <PGliteProvider>
        <SqlConsole timing={false} defaultValue="select 42 as answer" />
      </PGliteProvider>,
    );
    await ready();
    const tabs = screen.getByRole('tablist', { name: 'Sidebar' });
    expect(within(tabs).getByRole('tab', { name: 'Schema' }).getAttribute('aria-selected')).toBe('true');
    runKeys();
    await waitFor(() => expect(within(tabs).getByRole('tab', { name: 'History (1)' })).toBeTruthy(), wait);
    fireEvent.input(area(), { target: { value: 'select 0' } });
    fireEvent.click(within(tabs).getByRole('tab', { name: 'History (1)' }));
    // The history is a DataTable: a row presses.
    const entry = await within(screen.getByRole('grid', { name: 'History' })).findByText('select 42 as answer');
    fireEvent.click(entry);
    expect(area().value).toBe('select 42 as answer');
  });
});
