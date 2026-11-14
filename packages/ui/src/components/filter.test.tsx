// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FilterBar, FilterChip, FilterMenu, FilterToolbar, useFilters, type FilterChangeDetails } from '@/components/ui/filter';
import type { Filter, FilterField } from '@/lib/filter-model';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
// What the bar hands UI SDK's announcer, per test (the real one still runs). The page has one live region, which a late
// announcement from another test (or another component, like the menu's "No results") can overwrite.
const said = vi.hoisted(() => [] as string[]);
vi.mock('@ui-sdk/core', async (load) => {
  const core = await load<typeof import('@ui-sdk/core')>();
  return { ...core, announce: (text: string, options?: Parameters<typeof core.announce>[1]) => { said.push(text); core.announce(text, options); } };
});
afterEach(() => {
  cleanup();
  said.length = 0;
});

const fields: FilterField[] = [
  { id: 'status', label: 'Status', icon: 'circle', kind: 'select', options: [
    { value: 'open', label: 'Open', color: 'var(--primary)' }, { value: 'done', label: 'Done' }, { value: 'wip', label: 'In progress', count: 4 },
  ] },
  { id: 'labels', label: 'Labels', kind: 'multiselect', options: [{ value: 'bug', label: 'Bug' }, { value: 'ui', label: 'UI' }] },
  { id: 'created', label: 'Created', kind: 'date' },
  { id: 'points', label: 'Points', kind: 'number' },
  { id: 'title', label: 'Title', kind: 'text' },
  { id: 'urgent', label: 'Urgent', kind: 'boolean' },
];
const seed = (): Filter[] => [{ id: 'f1', field: 'status', operator: 'is_any_of', value: ['open', 'wip'] }];

/** The tests drive the real components with the events a pointer or keyboard would produce. */
const press = (el: Element) => fireEvent.click(el);
const key = (el: Element, k: string) => { fireEvent.keyDown(el, { key: k }); fireEvent.keyUp(el, { key: k }); };

function Harness({ initial = seed(), onChange, ...rest }: { initial?: Filter[]; onChange?: (f: Filter[], details: FilterChangeDetails) => void; hotkey?: string }) {
  const [filters, setFilters] = useState(initial);
  return <FilterBar fields={fields} value={filters} onValueChange={(f, details) => { setFilters(f); onChange?.(f, details); }} {...rest} />;
}

const chip = (name: RegExp | string) => screen.getByRole('group', { name });
/** Waits until the bar has asked UI SDK's announcer to say `text`. */
const announced = (text: string) => waitFor(() => expect(said.join('\n')).toContain(text), { timeout: 2000 });
/** UI SDK change details with this reason: the event behind it, who caused it, and cancel(). */
const details = (reason: string, more: Record<string, unknown> = {}) =>
  expect.objectContaining({ reason, source: expect.any(String), cancel: expect.any(Function), canceled: false, ...more });
const focused = () => {
  if (!document.activeElement) throw new Error('nothing has focus');
  return document.activeElement;
};

describe('FilterBar', () => {
  it('draws each filter as a labelled group of buttons inside a toolbar', () => {
    render(<Harness />);
    expect(screen.getByRole('toolbar', { name: 'Filters' })).toBeTruthy();
    const group = chip('Status is any of Open, In progress');
    expect(within(group).getByRole('button', { name: 'Status operator: is any of' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Status value: Open, In progress' })).toBeTruthy();
    expect(within(group).getByRole('button', { name: 'Remove filter: Status is any of Open, In progress' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Active filters' }).querySelectorAll('li')).toHaveLength(1);
  });

  it('adds a filter through the menu: field, then values, live', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
    press(screen.getByRole('button', { name: /^Filter/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add filter' });
    // the field list is searchable
    const search = within(dialog).getByRole('combobox', { name: 'Filter by' });
    fireEvent.input(search, { target: { value: 'lab' } });
    await waitFor(() => expect(within(dialog).queryByRole('option', { name: 'Status' })).toBeNull());
    fireEvent.input(search, { target: { value: '' } });
    press(await within(dialog).findByRole('option', { name: 'Status' }));
    // values: checkbox rows with counts
    const list = await screen.findByRole('listbox', { name: 'Status' });
    press(within(list).getByRole('option', { name: /^Open/ }));
    await waitFor(() => expect(chip('Status is Open')).toBeTruthy());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ field: 'status', operator: 'is', value: ['open'] })], details('add'));
    press(within(list).getByRole('option', { name: /^In progress/ }));
    await waitFor(() => expect(chip('Status is any of Open, In progress')).toBeTruthy());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ operator: 'is_any_of', value: ['open', 'wip'] })], details('update'));
    await announced('Filter changed: Status is any of Open, In progress');
    // unticking everything takes the filter away again
    press(within(list).getByRole('option', { name: /^Open/ }));
    press(within(list).getByRole('option', { name: /^In progress/ }));
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Status/ })).toBeNull());
  });

  it('adds nothing when the menu closes without a value', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    press(screen.getByRole('button', { name: /^Filter/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add filter' });
    press(await within(dialog).findByRole('option', { name: 'Status' }));
    await screen.findByRole('listbox', { name: 'Status' });
    key(document.activeElement ?? document.body, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers a field once, and Created / Points / Title / Urgent each with their own editor', async () => {
    render(<Harness />);
    press(screen.getByRole('button', { name: /^Filter/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add filter' });
    expect(within(dialog).queryByRole('option', { name: 'Status' })).toBeNull();
    press(within(dialog).getByRole('option', { name: 'Points' }));
    const box = await screen.findByRole('spinbutton', { name: 'Points number' });
    fireEvent.input(box, { target: { value: '8' } });
    key(box, 'Enter');
    await waitFor(() => expect(chip('Points = 8')).toBeTruthy());
  });

  it('changes the operator from its own menu', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    press(screen.getByRole('button', { name: 'Status operator: is any of' }));
    const menu = await screen.findByRole('menu', { name: 'Status operator: is any of' });
    expect(within(menu).getAllByRole('menuitemradio').map((i) => i.textContent)).toEqual(['is', 'is not', 'is any of', 'is none of']);
    press(within(menu).getByRole('menuitemradio', { name: 'is none of' }));
    await waitFor(() => expect(chip('Status is none of Open, In progress')).toBeTruthy());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ operator: 'is_none_of', value: ['open', 'wip'] })], details('update'));
  });

  it('edits the values in place: the same searchable picker, with the current ones ticked', async () => {
    render(<Harness />);
    press(screen.getByRole('button', { name: 'Status value: Open, In progress' }));
    const list = await screen.findByRole('listbox', { name: 'Status' });
    const opts = within(list).getAllByRole('option');
    expect(opts.map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'true']);
    press(within(list).getByRole('option', { name: /^Done/ }));
    await waitFor(() => expect(chip('Status is any of Open, Done, In progress')).toBeTruthy());
    press(within(list).getByRole('option', { name: /^Open/ }));
    press(within(list).getByRole('option', { name: /^Done/ }));
    await waitFor(() => expect(chip('Status is In progress')).toBeTruthy()); // one value reads as "is"
  });

  it('removes a chip with ×, and with Backspace or Delete on any of its parts, moving focus on', async () => {
    const onChange = vi.fn();
    const two: Filter[] = [...seed(), { id: 'f2', field: 'points', operator: 'gt', value: 3 }];
    render(<Harness initial={two} onChange={onChange} />);
    const value = screen.getByRole('button', { name: 'Status value: Open, In progress' });
    value.focus();
    key(value, 'Backspace');
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Status/ })).toBeNull());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'f2' })], details('remove', { event: expect.any(KeyboardEvent) }));
    await announced('Filter removed: Status is any of Open, In progress');
    // focus went to the neighbour chip, not to <body>
    expect(chip('Points > 3').contains(document.activeElement)).toBe(true);
    key(focused(), 'Delete');
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull());
    // …and with nothing left, to the Filter button
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Filter/ }));
  });

  it('drives the value list from its search: arrows highlight, Enter ticks, Escape empties then closes, Backspace goes back', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    press(screen.getByRole('button', { name: /^Filter/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add filter' });
    const fieldSearch = within(dialog).getByRole('combobox', { name: 'Filter by' });
    fireEvent.input(fieldSearch, { target: { value: 'lab' } });
    key(fieldSearch, 'Enter');
    const list = await screen.findByRole('listbox', { name: 'Labels' });
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    const search = screen.getByRole('combobox', { name: 'Search labels' });
    await waitFor(() => expect(document.activeElement).toBe(search));
    key(search, 'ArrowDown');
    key(search, 'Enter');
    await waitFor(() => expect(chip('Labels includes Bug')).toBeTruthy());
    expect(within(list).getByRole('option', { name: /^Bug/ }).getAttribute('aria-selected')).toBe('true');
    // Escape with text empties the search and keeps the popover
    fireEvent.input(search, { target: { value: 'u' } });
    key(search, 'Escape');
    expect(search).toHaveProperty('value', '');
    expect(screen.getByRole('dialog', { name: 'Labels filter' })).toBeTruthy();
    // Backspace in the empty search goes back to the fields
    key(search, 'Backspace');
    await screen.findByRole('combobox', { name: 'Filter by' });
  });

  it('says no result count for a field list that is gone: picked from before typing paused, or closed', async () => {
    // UI SDK's polite region (the one every announcement shares), as it changes.
    const heard: string[] = [];
    const observer = new MutationObserver(() => {
      const text = document.querySelector('[data-ui-sdk-announcer=""]')?.textContent?.trim();
      if (text) heard.push(text);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    try {
      render(<Harness initial={[]} />);
      press(screen.getByRole('button', { name: /^Filter/ }));
      const dialog = await screen.findByRole('dialog', { name: 'Add filter' });
      const fieldSearch = within(dialog).getByRole('combobox', { name: 'Filter by' });
      // Picked within the pause UI SDK waits before counting: the value list replaces the field list.
      fireEvent.input(fieldSearch, { target: { value: 'lab' } });
      key(fieldSearch, 'Enter');
      await screen.findByRole('listbox', { name: 'Labels' });
      await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
      expect(heard).not.toContain('No results');
      expect(heard.some((t) => /result/.test(t))).toBe(false);
      // Still on screen, the list's count is said once typing pauses.
      key(screen.getByRole('combobox', { name: 'Search labels' }), 'Backspace');
      const back = await screen.findByRole('combobox', { name: 'Filter by' });
      fireEvent.input(back, { target: { value: 'zzz' } });
      await waitFor(() => expect(heard).toContain('No results'), { timeout: 2000 });
    } finally {
      observer.disconnect();
    }
  });

  it('Backspace inside an open picker edits its search instead of removing the chip', async () => {
    render(<Harness />);
    press(screen.getByRole('button', { name: 'Status value: Open, In progress' }));
    const search = await screen.findByRole('combobox', { name: 'Search status' });
    key(search, 'Backspace');
    expect(chip('Status is any of Open, In progress')).toBeTruthy();
  });

  it('clears everything, and says so', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[...seed(), { id: 'f2', field: 'points', operator: 'gt', value: 3 }]} onChange={onChange} />);
    press(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull());
    expect(onChange).toHaveBeenLastCalledWith([], details('clear'));
    await announced('All 2 filters cleared');
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });

  it('is uncontrolled with defaultValue, and shows the match menu from two filters on', async () => {
    const seen = vi.fn();
    render(
      <FilterBar fields={fields} defaultValue={[...seed(), { id: 'f2', field: 'points', operator: 'gt', value: 3 }]} showMatch onMatchChange={seen} />,
    );
    press(screen.getByRole('button', { name: 'Match mode: all filters' }));
    press(await screen.findByRole('menuitemradio', { name: 'Match any filter' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Match mode: any filter' })).toBeTruthy());
    expect(seen).toHaveBeenCalledWith('any', details('item-press'));
  });

  it('refuses a change whose details are canceled, uncontrolled: the chip stays and nothing is announced', async () => {
    const refuse = vi.fn((_: Filter[], d: FilterChangeDetails) => { if (d.reason === 'remove') d.cancel(); });
    render(<FilterBar fields={fields} defaultValue={seed()} onValueChange={refuse} />);
    press(screen.getByRole('button', { name: 'Remove filter: Status is any of Open, In progress' }));
    expect(refuse).toHaveBeenCalledWith([], expect.objectContaining({ reason: 'remove', canceled: true, event: expect.any(MouseEvent) }));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(chip('Status is any of Open, In progress')).toBeTruthy();
    // Clear all is refused the same way only when the consumer says so: here it goes through.
    press(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull());
    expect(refuse).toHaveBeenLastCalledWith([], details('clear', { event: expect.any(MouseEvent) }));
  });

  it('a controlled bar that refuses a remove says nothing, keeps focus, and the next edit starts from what it shows', async () => {
    const two: Filter[] = [...seed(), { id: 'f2', field: 'title', operator: 'contains', value: 'x' }];
    const calls: string[][] = [];
    function Refuses() {
      const [filters, setFilters] = useState(two);
      // The first change is refused by not passing it back; later ones go through.
      return <FilterBar fields={fields} value={filters} onValueChange={(next) => { calls.push(next.map((f) => f.id)); if (calls.length > 1) setFilters(next); }} />;
    }
    render(<Refuses />);
    const remove = screen.getByRole('button', { name: 'Remove filter: Status is any of Open, In progress' });
    act(() => remove.focus());
    press(remove);
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    expect(chip('Status is any of Open, In progress')).toBeTruthy();
    expect(said.join('\n')).not.toContain('Filter removed');
    expect(document.activeElement).toBe(remove);
    press(screen.getByRole('button', { name: /^Remove filter: Title/ }));
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Title/ })).toBeNull());
    // f1 is still there: the second remove started from the filters the bar shows, not from the refused list.
    expect(calls).toEqual([['f2'], ['f1']]);
    expect(chip('Status is any of Open, In progress')).toBeTruthy();
    await announced('Filter removed: Title contains');
  });

  it('hands focus to the same part of the next chip, else the previous one, when a focused chip leaves', async () => {
    const three: Filter[] = [
      ...seed(),
      { id: 'f2', field: 'points', operator: 'gt', value: 3 },
      { id: 'f3', field: 'title', operator: 'contains', value: 'x' },
    ];
    render(<Harness initial={three} />);
    const pointsRemove = screen.getByRole('button', { name: 'Remove filter: Points > 3' });
    act(() => pointsRemove.focus());
    press(pointsRemove);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Points > 3' })).toBeNull());
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Remove filter: Title/ }));
    // The last chip's value button, removed with Delete: focus goes back to the previous chip's value button.
    const titleValue = screen.getByRole('button', { name: /^Title value/ });
    act(() => titleValue.focus());
    key(titleValue, 'Delete');
    await waitFor(() => expect(screen.queryByRole('group', { name: /^Title/ })).toBeNull());
    await act(async () => { await Promise.resolve(); });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Status value: Open, In progress' }));
  });

  // fireEvent's events are untrusted, so UI SDK (and the bar, which reads them the same way) report them as
  // `programmatic`: the event itself shows which interaction the details came from.
  it("passes the value list's own details on: the key that ticked an option is the change's event", async () => {
    const onChange = vi.fn();
    render(<Harness initial={[]} onChange={onChange} />);
    press(screen.getByRole('button', { name: /^Filter/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add filter' });
    press(await within(dialog).findByRole('option', { name: 'Labels' }));
    const search = await screen.findByRole('combobox', { name: 'Search labels' });
    key(search, 'ArrowDown');
    key(search, 'Enter');
    await waitFor(() => expect(chip('Labels includes Bug')).toBeTruthy());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ field: 'labels', value: ['bug'] })], details('add', { source: 'programmatic', event: expect.any(KeyboardEvent) }));
  });

  it('opens the menu from the hotkey, but not while typing', async () => {
    render(<><input aria-label="note" /><Harness initial={[]} hotkey="f" /></>);
    const note = screen.getByRole('textbox', { name: 'note' });
    note.focus();
    fireEvent.keyDown(note, { key: 'f' });
    expect(screen.queryByRole('dialog')).toBeNull();
    (note as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: 'f' });
    await screen.findByRole('dialog', { name: 'Add filter' });
    // Escape empties the field search first, then closes
    const search = screen.getByRole('combobox', { name: 'Filter by' });
    await waitFor(() => expect(document.activeElement).toBe(search));
    fireEvent.input(search, { target: { value: 'sta' } });
    key(search, 'Escape');
    expect(search).toHaveProperty('value', '');
    expect(screen.getByRole('dialog', { name: 'Add filter' })).toBeTruthy();
    key(search, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('FilterBar hotkey and other layers', () => {
  it('stays quiet while a modal dialog is open, and while a menu has focus', async () => {
    render(
      <>
        <Harness initial={[]} hotkey="f" />
        <Dialog>
          <DialogTrigger>Open dialog</DialogTrigger>
          <DialogContent aria-label="Settings"><button type="button">Inside</button></DialogContent>
        </Dialog>
        <DropdownMenu>
          <DropdownMenuTrigger>More</DropdownMenuTrigger>
          <DropdownMenuContent><DropdownMenuItem>Forward</DropdownMenuItem><DropdownMenuItem>Flag</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </>,
    );
    press(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    const inside = within(dialog).getByRole('button', { name: 'Inside' });
    inside.focus();
    fireEvent.keyDown(inside, { key: 'f' });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.queryByRole('dialog', { name: 'Add filter' })).toBeNull();
    key(inside, 'Escape');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull());

    press(screen.getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('menu');
    const item = within(menu).getByRole('menuitem', { name: 'Forward' });
    item.focus();
    fireEvent.keyDown(item, { key: 'f' });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(screen.queryByRole('dialog', { name: 'Add filter' })).toBeNull();
  });
});

describe('FilterChip standalone', () => {
  it('works with your own state and no bar', async () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();
    const filter: Filter = { id: 'x', field: 'urgent', operator: 'is', value: true };
    render(<FilterChip filter={filter} field={fields[5]} onChange={onChange} onRemove={onRemove} />);
    expect(chip('Urgent is Yes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /operator/ })).toBeNull(); // boolean has the one operator: plain text
    press(screen.getByRole('button', { name: 'Urgent value: Yes' }));
    press(await screen.findByRole('option', { name: 'No' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: false }), expect.objectContaining({ event: expect.any(Event) }));
    press(screen.getByRole('button', { name: 'Remove filter: Urgent is Yes' }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('renders plain text with readOnly', () => {
    render(<FilterChip readOnly filter={{ id: 'x', field: 'points', operator: 'gte', value: 3 }} field={fields[3]} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(chip('Points ≥ 3').textContent).toBe('Points≥3');
  });

  it('edits a date: presets, a picked day, and a span for "in the last"', async () => {
    const onChange = vi.fn();
    render(<FilterChip filter={{ id: 'd', field: 'created', operator: 'is', value: { type: 'preset', preset: 'today' } }} field={fields[2]} onChange={onChange} onRemove={() => undefined} />);
    press(screen.getByRole('button', { name: 'Created value: Today' }));
    press(await screen.findByRole('option', { name: 'Last 7 days' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: { type: 'preset', preset: 'last_7_days' } }), expect.objectContaining({ source: expect.any(String) }));
    cleanup();
    render(<FilterChip filter={{ id: 'd', field: 'created', operator: 'in_the_last', value: { type: 'relative', amount: 7, unit: 'day' } }} field={fields[2]} onChange={onChange} onRemove={() => undefined} />);
    press(screen.getByRole('button', { name: 'Created value: 7 days' }));
    const amount = await screen.findByRole('spinbutton', { name: 'How many' });
    fireEvent.input(amount, { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: { type: 'relative', amount: 3, unit: 'day' } }), expect.anything());
  });
});

describe('FilterMenu standalone', () => {
  function Standalone({ onChange }: { onChange: (f: Filter[], details: FilterChangeDetails) => void }) {
    const state = useFilters({ onValueChange: onChange });
    return <FilterMenu fields={fields} state={state} render={<Button />}>Add</FilterMenu>;
  }
  it('adds to the state it is given, from a custom trigger', async () => {
    const onChange = vi.fn();
    render(<Standalone onChange={onChange} />);
    press(screen.getByRole('button', { name: 'Add' }));
    press(await screen.findByRole('option', { name: 'Title' }));
    const box = await screen.findByRole('textbox', { name: 'Title text' });
    fireEvent.input(box, { target: { value: 'crash' } });
    key(box, 'Enter');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ field: 'title', operator: 'contains', value: 'crash' })], details('add')));
  });
});

describe('FilterToolbar', () => {
  it('moves across its buttons with the arrow keys (one tab stop, UI SDK Toolbar)', () => {
    render(<Harness initial={[...seed(), { id: 'f2', field: 'points', operator: 'gt', value: 3 }]} />);
    const toolbar = screen.getByRole('toolbar');
    const trigger = within(toolbar).getByRole('button', { name: /^Filter/ });
    trigger.focus();
    act(() => { fireEvent.keyDown(trigger, { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(within(toolbar).getByRole('button', { name: 'Status operator: is any of' }));
    act(() => { fireEvent.keyDown(focused(), { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(within(toolbar).getByRole('button', { name: 'Status value: Open, In progress' }));
    act(() => { fireEvent.keyDown(focused(), { key: 'ArrowRight' }); });
    expect(document.activeElement).toBe(within(toolbar).getAllByRole('button', { name: /^Remove filter/ })[0]);
    // (←, Home and End are covered against a real browser in tools/e2e/filter.e2e.mjs: happy-dom's TreeWalker walks backwards wrongly.)
  });

  it('takes children to compose its own row', () => {
    render(<FilterBar fields={fields} defaultValue={seed()}><FilterToolbar aria-label="Mine"><span>hello</span></FilterToolbar></FilterBar>);
    expect(screen.getByRole('toolbar', { name: 'Mine' }).textContent).toContain('hello');
  });
});
