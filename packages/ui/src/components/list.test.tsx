// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createListRowController, List, ListRow, ListSection } from './list';

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
});
afterEach(cleanup);

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('List', () => {
  it('is a list of rows; a row with onClick is a button named by its title and subtitle', () => {
    const onClick = vi.fn();
    const { getByRole, getAllByRole } = render(
      <List>
        <ListSection title="General">
          <ListRow key="a" title="About" description="Version 6" onClick={onClick} accessory="chevron" />
          <ListRow key="b" title="Plain" />
        </ListSection>
      </List>,
    );
    expect(getByRole('list')).toBeTruthy();
    expect(getAllByRole('listitem')).toHaveLength(2);
    const button = getByRole('button', { name: 'About Version 6' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marks the selected row as current', () => {
    const { getByRole } = render(<ListRow title="Inbox" current onClick={() => {}} />);
    expect(getByRole('button', { name: 'Inbox' }).getAttribute('aria-current')).toBe('true');
  });

  it('opens swipe actions from the keyboard, runs one, and Escape closes them', async () => {
    const onAction = vi.fn();
    const { getByRole, container } = render(
      <ListRow title="Message" onClick={() => {}} trailingActions={[{ label: 'Archive', onAction }]} />,
    );
    const row = getByRole('button', { name: 'Message' });
    const actions = container.querySelector('[data-slot=list-row-actions]')!;
    // happy-dom has no layout: give the actions the width a browser would.
    actions.getBoundingClientRect = () => ({ width: 88, height: 44, top: 0, left: 0, right: 88, bottom: 44, x: 0, y: 0, toJSON: () => ({}) });
    expect(actions.hasAttribute('inert')).toBe(true);
    act(() => row.focus());
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    await flush();
    const archive = getByRole('button', { name: 'Archive' });
    expect(actions.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(archive);
    fireEvent.keyDown(archive, { key: 'Escape' });
    await flush();
    expect(actions.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(row);
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    await flush();
    fireEvent.click(getByRole('button', { name: 'Archive' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ reason: 'action-press' }));
  });

  it('with actions on both sides, Left opens the trailing strip and Right the leading one', async () => {
    const { getByRole, container } = render(
      <ListRow title="Message" onClick={() => {}}
        leadingActions={[{ label: 'Unread', onAction: () => {} }]}
        trailingActions={[{ label: 'Archive', onAction: () => {} }, { label: 'More', onAction: () => {} }]} />,
    );
    const root = container.querySelector<HTMLElement>('[data-slot=list-row]')!;
    const strip = (side: string) => container.querySelector<HTMLElement>(`[data-slot=list-row-actions][data-side=${side}]`)!;
    // Each strip is its own part: a browser would measure them apart, 74 and 148 wide.
    for (const [side, width] of [['start', 74], ['end', 148]] as const) {
      strip(side).getBoundingClientRect = () => ({ width, height: 44, top: 0, left: 0, right: width, bottom: 44, x: 0, y: 0, toJSON: () => ({}) });
    }
    // The root takes focus as the actions close (and hands it to the row's button), so it must be focusable.
    expect(root.getAttribute('tabindex')).toBe('-1');
    const row = getByRole('button', { name: 'Message' });
    act(() => row.focus());
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    await flush();
    expect(root.getAttribute('data-swipe')).toBe('end');
    expect(root.style.getPropertyValue('--swipe-x')).toBe('-148px');
    expect(strip('end').hasAttribute('inert')).toBe(false);
    expect(strip('start').hasAttribute('inert')).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await flush();
    expect(document.activeElement).toBe(row);
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    await flush();
    expect(root.getAttribute('data-swipe')).toBe('start');
    expect(root.style.getPropertyValue('--swipe-x')).toBe('74px');
    expect(document.activeElement).toBe(getByRole('button', { name: 'Unread' }));
  });

  it('runs a destructive action with the Delete key once the row has slid away and collapsed (its exit)', async () => {
    const onDelete = vi.fn();
    const { getByRole, container } = render(<ListRow title="Draft" onClick={() => {}} trailingActions={[{ label: 'Delete', destructive: true, onAction: onDelete }]} />);
    const root = container.querySelector<HTMLElement>('[data-slot=list-row]')!;
    Object.defineProperty(root, 'offsetHeight', { configurable: true, value: 44 });
    // happy-dom runs no transitions: stand in for the collapse that a browser would be running.
    let collapse = () => {};
    const finished = new Promise<void>((resolve) => { collapse = resolve; });
    root.getAnimations = () => [{ finished, transitionProperty: 'height' } as unknown as Animation];
    const row = getByRole('button', { name: 'Draft' });
    act(() => row.focus());
    fireEvent.keyDown(row, { key: 'Delete' });
    // Slid off and collapsing from its measured height, on UI SDK's exit attributes.
    expect(root.hasAttribute('data-removing')).toBe(true);
    expect(root.style.getPropertyValue('--list-row-h')).toBe('44px');
    expect(root.hasAttribute('data-ending-style')).toBe(true);
    expect(root.inert).toBe(true);
    expect(onDelete).not.toHaveBeenCalled();
    await act(async () => { collapse(); await finished; });
    await flush();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps one row open at a time, across lists and however it opened', async () => {
    const a = createListRowController();
    const { getByRole, container } = render(
      <>
        <List><ListSection><ListRow key="a" title="A" onClick={() => {}} controller={a} trailingActions={[{ label: 'Flag A', onAction: () => {} }]} /></ListSection></List>
        <List><ListSection><ListRow key="b" title="B" onClick={() => {}} trailingActions={[{ label: 'Flag B', onAction: () => {} }]} /></ListSection></List>
      </>,
    );
    const [actionsA, actionsB] = container.querySelectorAll<HTMLElement>('[data-slot=list-row-actions]');
    for (const el of [actionsA, actionsB]) {
      el.getBoundingClientRect = () => ({ width: 88, height: 44, top: 0, left: 0, right: 88, bottom: 44, x: 0, y: 0, toJSON: () => ({}) });
    }
    act(() => { a.show('trailing'); });
    await flush();
    expect(actionsA.hasAttribute('inert')).toBe(false);
    const b = getByRole('button', { name: 'B' });
    act(() => b.focus());
    fireEvent.keyDown(b, { key: 'ArrowLeft' });
    await flush();
    expect(actionsB.hasAttribute('inert')).toBe(false);
    expect(actionsA.hasAttribute('inert')).toBe(true);
    // The controller opening A again closes B.
    act(() => { a.show('trailing'); });
    await flush();
    expect(actionsA.hasAttribute('inert')).toBe(false);
    expect(actionsB.hasAttribute('inert')).toBe(true);
  });

  it('a row with a preview is its hover card trigger and stays a button', () => {
    const { getByRole, container } = render(<ListRow title="Ada" onClick={() => {}} preview={<p>Engineer</p>} />);
    expect(getByRole('button', { name: 'Ada' })).toBeTruthy();
    expect(container.querySelector('[data-slot=list-row]')!.getAttribute('data-slot')).toBe('list-row');
  });

  it('a row without onClick but with actions is a focusable group', () => {
    const { getByRole } = render(<ListRow title="Flagged" trailingActions={[{ label: 'Unflag', onAction: () => {} }]} />);
    const group = getByRole('group', { name: 'Flagged' });
    expect(group.getAttribute('tabindex')).toBe('0');
  });

  it('pressing a control row flips its switch', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ListRow title="Wi-Fi" accessory={<input type="checkbox" role="switch" aria-label="Wi-Fi" onChange={onChange} />} />,
    );
    fireEvent.click(container.querySelector('[data-slot=list-row-body]')!);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('an animated section collapses a removed row out (data-ending-style) before it goes', async () => {
    const rows = (keys: string[]) => <ListSection animate>{keys.map((k) => <ListRow key={k} title={k} />)}</ListSection>;
    const { rerender, getAllByRole, container } = render(rows(['Alpha', 'Bravo', 'Charlie']));
    const ending: string[] = [];
    const watch = new MutationObserver((records) => records.forEach((r) => {
      const el = r.target as HTMLElement;
      if (r.oldValue === null) ending.push(el.textContent ?? '');
    }));
    watch.observe(container, { subtree: true, attributes: true, attributeFilter: ['data-ending-style'], attributeOldValue: true });
    rerender(rows(['Alpha', 'Charlie']));
    await flush();
    await flush();
    watch.disconnect();
    expect(ending).toContain('Bravo');
    expect(getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Alpha', 'Charlie']);
    rerender(rows(['Alpha', 'Delta', 'Charlie']));
    expect(getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Alpha', 'Delta', 'Charlie']);
  });

  it('names a section list by its title and passes ref and DOM props through', () => {
    let listEl: HTMLDivElement | null = null;
    let rowEl: HTMLDivElement | null = null;
    const { getByRole, container } = render(
      <List variant="inset" id="settings" aria-label="Settings" ref={(el) => { listEl = el; }}>
        <ListSection title="Network" data-testid="network">
          <ListRow key="w" title="Wi-Fi" data-row="wifi" ref={(el) => { rowEl = el; }} />
        </ListSection>
      </List>,
    );
    expect(getByRole('list', { name: 'Network' })).toBeTruthy();
    const list = container.querySelector<HTMLElement>('[data-slot=list]')!;
    expect(list).toBe(listEl);
    expect(list.id).toBe('settings');
    expect(list.getAttribute('aria-label')).toBe('Settings');
    expect(list.getAttribute('data-variant')).toBe('inset');
    expect(container.querySelector('[data-testid=network]')).toBeTruthy();
    expect(rowEl).toBe(container.querySelector('[data-row=wifi]'));
  });

  it('shows the empty state when no section has rows; null shows nothing', () => {
    const { container, rerender, getByText } = render(<List><ListSection title="Results">{[]}</ListSection></List>);
    expect(getByText('No items')).toBeTruthy();
    expect(container.querySelector('[data-slot=list]')!.hasAttribute('data-empty')).toBe(true);
    rerender(<List emptyState={<p>No results for “zz”</p>}>{null}</List>);
    expect(getByText('No results for “zz”')).toBeTruthy();
    rerender(<List emptyState={null}><ListSection>{[]}</ListSection></List>);
    expect(container.querySelector('[data-slot=list]')!.textContent).toBe('');
    rerender(<List><ListSection><ListRow key="a" title="Alpha" /></ListSection></List>);
    expect(container.querySelector('[data-slot=list]')!.hasAttribute('data-empty')).toBe(false);
  });

  it('a disabled row is a disabled button that does not swipe or run its actions', async () => {
    const onClick = vi.fn();
    const onAction = vi.fn();
    const { getByRole, container } = render(
      <ListRow title="Private Relay" disabled onClick={onClick} trailingActions={[{ label: 'Delete', destructive: true, onAction }]} />,
    );
    const button = getByRole('button', { name: 'Private Relay' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(container.querySelector('[data-slot=list-row]')!.hasAttribute('data-disabled')).toBe(true);
    expect(container.querySelector('[data-slot=list-row-actions]')).toBeNull();
    expect(button.hasAttribute('aria-keyshortcuts')).toBe(false);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('in edit mode a row reports its check as pressed and does not swipe', () => {
    const { getByRole, container, rerender } = render(
      <ListRow title="Inbox" editing checked onClick={() => {}} trailingActions={[{ label: 'Archive', onAction: () => {} }]} />,
    );
    expect(getByRole('button', { name: 'Inbox' }).getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-slot=list-row-actions]')).toBeNull();
    rerender(<ListRow title="Inbox" checked onClick={() => {}} />);
    expect(getByRole('button', { name: 'Inbox' }).hasAttribute('aria-pressed')).toBe(false);
  });

  it('density sets the row height', () => {
    const { container } = render(<List density="compact"><ListSection><ListRow key="a" title="Alpha" /></ListSection></List>);
    expect(container.querySelector('[data-slot=list-row-content]')!.className).toContain('min-h-9');
  });

  it('reorders with a grip from the keyboard and reports the new order', async () => {
    const onOrderChange = vi.fn();
    function Rows() {
      const [rows, setRows] = useState(['Alpha', 'Bravo', 'Charlie']);
      return (
        <ListSection onOrderChange={(order, details) => { onOrderChange(order, details); setRows(order); }}>
          {rows.map((r) => <ListRow key={r} title={r} />)}
        </ListSection>
      );
    }
    const { getByRole, getAllByRole } = render(<Rows />);
    expect(getByRole('list').getAttribute('aria-roledescription')).toBe('sortable list');
    const grip = getByRole('button', { name: 'Reorder Alpha' });
    act(() => grip.focus());
    fireEvent.keyDown(grip, { key: ' ' });
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    fireEvent.keyDown(grip, { key: ' ' });
    await flush();
    expect(onOrderChange).toHaveBeenCalledWith(['Bravo', 'Alpha', 'Charlie'], expect.objectContaining({ reason: 'move-key', from: 0, to: 1 }));
    expect(getAllByRole('listitem').map((li) => li.textContent?.replace(/Drag.*$/, ''))).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });
});
