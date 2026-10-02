// @vitest-environment happy-dom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FilterBar, FilterToolbar } from '@/components/ui/filter';
import { FilterInput } from '@/components/ui/filter-input';
import type { Filter, FilterField } from '@/lib/filter';

afterEach(cleanup);

const fields: FilterField[] = [
  { id: 'status', label: 'Status', kind: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'done', label: 'Done' }, { value: 'wip', label: 'In progress' }] },
  { id: 'priority', label: 'Priority', kind: 'select', options: [{ value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'low', label: 'Low' }] },
  { id: 'assignee', label: 'Assignee', kind: 'select', options: [{ value: 'alice', label: 'Alice' }, { value: 'bob', label: 'Bob' }] },
  { id: 'points', label: 'Points', kind: 'number' },
];
const NOW = new Date(2026, 0, 14, 15, 30);
const query = { debounce: 0, now: NOW };

function Harness({ onChange }: { onChange?: (f: Filter[]) => void }) {
  const [filters, setFilters] = useState<Filter[]>([]);
  return (
    <FilterBar fields={fields} value={filters} onValueChange={(f) => { setFilters(f); onChange?.(f); }}>
      <FilterInput query={query} />
      <FilterToolbar />
    </FilterBar>
  );
}

const box = () => screen.getByRole('textbox', { name: 'Describe the filters you want' });
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });
const preview = () => document.querySelector('[data-slot=filter-input-preview]');
const spoken = () => document.querySelector('[data-slot=filter-input] [role=status]')?.textContent ?? '';

describe('FilterInput', () => {
  it('shows what it understood as chips before anything is applied', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(preview()).toBeNull();
    type('priority urgent assigned to bob');
    await waitFor(() => expect(preview()?.textContent).toContain('Will apply'));
    expect(within(preview() as HTMLElement).getAllByRole('group', { hidden: true }).map((g) => g.getAttribute('aria-label'))).toEqual(['Priority is Urgent', 'Assignee is Bob']);
    expect(spoken()).toContain('2 filters understood: Priority is Urgent; Assignee is Bob');
    expect(spoken()).toContain('Press Enter to apply');
    expect(onChange).not.toHaveBeenCalled(); // never applied silently
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
  });

  it('applies on Enter, empties the box, and the chips become ordinary filters', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type('status open');
    await waitFor(() => expect(spoken()).toContain('1 filter understood: Status is Open'));
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('group', { name: 'Status is Open' })).toBeTruthy());
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ field: 'status', operator: 'is', value: ['open'] })]);
    expect((box() as HTMLInputElement).value).toBe('');
    expect(preview()).toBeNull();
    expect(document.querySelector('[data-slot=filter-announcer]')?.textContent).toContain('Filter applied: Status is Open');
    // …and they edit like any other
    fireEvent.click(screen.getByRole('button', { name: 'Status operator: is' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'is not' }));
    await waitFor(() => expect(screen.getByRole('group', { name: 'Status is not Open' })).toBeTruthy());
  });

  it('merges into the filters already there: a field it names is replaced, the rest kept', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type('status open');
    await waitFor(() => expect(spoken()).toContain('Status is Open'));
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('group', { name: 'Status is Open' })).toBeTruthy());
    type('status done and priority high');
    await waitFor(() => expect(spoken()).toContain('Status is Done'));
    fireEvent.keyDown(box(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('group', { name: 'Status is Done' })).toBeTruthy());
    expect(screen.queryByRole('group', { name: 'Status is Open' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Priority is High' })).toBeTruthy();
  });

  it('applies the first Enter only once the preview has caught up with the typing', async () => {
    const onChange = vi.fn();
    render(<FilterBar fields={fields} onValueChange={onChange}><FilterInput query={{ debounce: 5000, now: NOW }} /></FilterBar>);
    type('status open');
    fireEvent.keyDown(box(), { key: 'Enter' }); // debounce has not fired: this only brings the preview up
    await waitFor(() => expect(spoken()).toContain('Status is Open'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('says what it dropped, and applies nothing when it understood nothing', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type('qwerty zxcvb');
    await waitFor(() => expect(preview()?.textContent).toContain('Nothing understood yet'));
    expect(preview()?.textContent).toContain('Ignored');
    expect(spoken()).toContain('No filter understood');
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(spoken()).toContain('Nothing to apply');
    expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports a value it could not place, and a word it did not use', async () => {
    render(<Harness />);
    type('priority banana');
    await waitFor(() => expect(preview()?.textContent).toContain('Ignored'));
    expect(preview()?.querySelector('[title]')?.getAttribute('title')).toContain('Priority');
  });

  it('Escape clears the box, and the Apply button applies too', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type('points over 3');
    await waitFor(() => expect(spoken()).toContain('Points > 3'));
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect((box() as HTMLInputElement).value).toBe('');
    type('points over 3');
    await waitFor(() => expect((screen.getByRole('button', { name: 'Apply' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ field: 'points', operator: 'gt', value: 3 })]);
  });

  it('works without a FilterBar: onApply gets the filters and the fields come from props', async () => {
    const onApply = vi.fn();
    render(<FilterInput fields={fields} onApply={onApply} query={query} />);
    type('priority high');
    await waitFor(() => expect(spoken()).toContain('Priority is High'));
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onApply).toHaveBeenCalledWith([expect.objectContaining({ field: 'priority', value: ['high'] })]);
  });

  it('states its limits where the user can read them', () => {
    render(<FilterInput fields={fields} onApply={() => undefined} />);
    const hint = document.querySelector('[data-slot=filter-input] p')?.textContent ?? '';
    expect(hint).toMatch(/Experimental/);
    expect(hint).toMatch(/“and”/);
    expect(hint).toMatch(/Check the preview/);
  });
});
