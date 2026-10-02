// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { FilterBar, FilterChip, FilterMenu, FilterToolbar, useFilters } from '@/components/ui/filter';
import type { Filter, FilterField } from '@/lib/filter';

afterEach(cleanup);

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

function Harness({ initial = seed(), onChange, ...rest }: { initial?: Filter[]; onChange?: (f: Filter[]) => void; hotkey?: string }) {
  const [filters, setFilters] = useState(initial);
  return <FilterBar fields={fields} value={filters} onValueChange={(f) => { setFilters(f); onChange?.(f); }} {...rest} />;
}

const chip = (name: RegExp | string) => screen.getByRole('group', { name });
const live = () => document.querySelector('[data-slot=filter-announcer]')?.textContent ?? '';
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
    const search = within(dialog).getByRole('searchbox', { name: 'Filter by' });
    fireEvent.change(search, { target: { value: 'lab' } });
    await waitFor(() => expect(within(dialog).queryByRole('option', { name: 'Status' })).toBeNull());
    fireEvent.change(search, { target: { value: '' } });
    press(await within(dialog).findByRole('option', { name: 'Status' }));
    // values: checkbox rows with counts
    const list = await screen.findByRole('listbox', { name: 'Status' });
    press(within(list).getByRole('option', { name: /^Open/ }));
    await waitFor(() => expect(chip('Status is Open')).toBeTruthy());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ field: 'status', operator: 'is', value: ['open'] })]);
    press(within(list).getByRole('option', { name: /^In progress/ }));
    await waitFor(() => expect(chip('Status is any of Open, In progress')).toBeTruthy());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ operator: 'is_any_of', value: ['open', 'wip'] })]);
    expect(live()).toContain('Filter changed: Status is any of Open, In progress');
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
    fireEvent.change(box, { target: { value: '8' } });
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
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ operator: 'is_none_of', value: ['open', 'wip'] })]);
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
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: 'f2' })]);
    expect(live()).toContain('Filter removed: Status is any of Open, In progress');
    // focus went to the neighbour chip, not to <body>
    expect(chip('Points > 3').contains(document.activeElement)).toBe(true);
    key(focused(), 'Delete');
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull());
    // …and with nothing left, to the Filter button
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Filter/ }));
  });

  it('Backspace inside an open picker edits its search instead of removing the chip', async () => {
    render(<Harness />);
    press(screen.getByRole('button', { name: 'Status value: Open, In progress' }));
    const search = await screen.findByRole('searchbox', { name: 'Search status' });
    key(search, 'Backspace');
    expect(chip('Status is any of Open, In progress')).toBeTruthy();
  });

  it('clears everything, and says so', async () => {
    const onChange = vi.fn();
    render(<Harness initial={[...seed(), { id: 'f2', field: 'points', operator: 'gt', value: 3 }]} onChange={onChange} />);
    press(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull());
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(live()).toContain('All 2 filters cleared');
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
    expect(seen).toHaveBeenCalledWith('any');
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
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: false }));
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
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: { type: 'preset', preset: 'last_7_days' } }));
    cleanup();
    render(<FilterChip filter={{ id: 'd', field: 'created', operator: 'in_the_last', value: { type: 'relative', amount: 7, unit: 'day' } }} field={fields[2]} onChange={onChange} onRemove={() => undefined} />);
    press(screen.getByRole('button', { name: 'Created value: 7 days' }));
    const amount = await screen.findByRole('spinbutton', { name: 'How many' });
    fireEvent.change(amount, { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: { type: 'relative', amount: 3, unit: 'day' } }));
  });
});

describe('FilterMenu standalone', () => {
  function Standalone({ onChange }: { onChange: (f: Filter[]) => void }) {
    const state = useFilters({ onValueChange: onChange });
    return <FilterMenu fields={fields} state={state}><Button>Add</Button></FilterMenu>;
  }
  it('adds to the state it is given, from a custom trigger', async () => {
    const onChange = vi.fn();
    render(<Standalone onChange={onChange} />);
    press(screen.getByRole('button', { name: 'Add' }));
    press(await screen.findByRole('option', { name: 'Title' }));
    const box = await screen.findByRole('textbox', { name: 'Title text' });
    fireEvent.change(box, { target: { value: 'crash' } });
    key(box, 'Enter');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ field: 'title', operator: 'contains', value: 'crash' })]));
  });
});

describe('FilterToolbar', () => {
  it('moves across its buttons with the arrow keys (one tab stop, react-aria Toolbar)', () => {
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
