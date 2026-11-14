// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from '@ui-sdk/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PGliteProvider } from '@/lib/pglite';
import { SqlConsole } from '@/components/ui/sql-console';

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
/** Everything handed to UI SDK's `announce()` so far. */
const announced = () => vi.mocked(announce).mock.calls.map(([text]) => text).join(' | ');
const ready = () => waitFor(() => expect(document.querySelector('[data-slot=sql-console]')?.getAttribute('data-status')).toBe('ready'), wait);

describe('SqlConsole', () => {
  it('announces the start, then runs a script into one named result table per statement', async () => {
    const onRun = vi.fn();
    render(
      <PGliteProvider>
        <SqlConsole transfer={false} timing={false} onRun={onRun} defaultValue="select 1 as one; select 2 as two;" />
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
      const { rerender } = render(<PGliteProvider><SqlConsole transfer={false} /></PGliteProvider>);
      const root = document.querySelector<HTMLElement>('[data-slot=sql-console]');
      expect(root?.getAttribute('data-size-class')).toBe('compact');
      expect(root?.className).not.toMatch(/(^|\s)md:/);
      expect(root?.className).toContain('data-[size-class=medium]:grid');
      w = 800;
      rerender(<PGliteProvider><SqlConsole transfer={false} key="wide" /></PGliteProvider>);
      expect(document.querySelector('[data-slot=sql-console]')?.getAttribute('data-size-class')).toBe('medium');
    } finally {
      if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
    }
  });

  it('shows a failed query as an alert with the line, caret and SQLSTATE, and says a script applied nothing', async () => {
    render(
      <PGliteProvider>
        <SqlConsole transfer={false} sidebar={false} defaultValue={'create table t (id int);\nselect nope from t;'} />
      </PGliteProvider>,
    );
    await ready();
    runKeys();
    const alert = await screen.findByRole('alert', {}, wait);
    expect(alert.textContent).toMatch(/Query failed/);
    expect(alert.textContent).toMatch(/SQLSTATE 42703/);
    expect(alert.textContent).toMatch(/LINE 2: select nope from t;/);
    expect(alert.textContent).toMatch(/none of its 2 statements were applied/);
  });

  it('keeps run history in the sidebar tabs and puts a history entry back in the editor', async () => {
    render(
      <PGliteProvider>
        <SqlConsole transfer={false} timing={false} defaultValue="select 42 as answer" />
      </PGliteProvider>,
    );
    await ready();
    const tabs = screen.getByRole('tablist', { name: 'Sidebar' });
    expect(within(tabs).getByRole('tab', { name: 'Schema' }).getAttribute('aria-selected')).toBe('true');
    runKeys();
    await waitFor(() => expect(within(tabs).getByRole('tab', { name: 'History (1)' })).toBeTruthy(), wait);
    fireEvent.input(area(), { target: { value: 'select 0' } });
    fireEvent.click(within(tabs).getByRole('tab', { name: 'History (1)' }));
    const entry = await screen.findByRole('button', { name: 'select 42 as answer' });
    fireEvent.click(entry);
    expect(area().value).toBe('select 42 as answer');
  });
});
