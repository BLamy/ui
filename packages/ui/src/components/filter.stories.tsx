import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterBar, FilterChip, FilterClear, FilterList, FilterMatch, FilterMenu, FilterToolbar, FilterValueEditor } from '@/components/ui/filter';
import type { Filter, FilterField, FilterValue } from '@/lib/filter-model';
import { popoverSurface } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { Pad } from '../stories/frame';

const fields: FilterField[] = [
  { id: 'status', label: 'Status', icon: 'circle', kind: 'select', options: [
    { value: 'open', label: 'Open', color: 'var(--primary)', count: 5 }, { value: 'wip', label: 'In progress', color: 'var(--destructive)', count: 3 }, { value: 'done', label: 'Done', count: 4 },
  ] },
  { id: 'labels', label: 'Labels', icon: 'tag', kind: 'multiselect', options: [{ value: 'bug', label: 'Bug' }, { value: 'ui', label: 'UI' }, { value: 'docs', label: 'Docs' }] },
  { id: 'created', label: 'Created', icon: 'calendar', kind: 'date' },
  { id: 'points', label: 'Points', icon: 'chart-bar', kind: 'number' },
  { id: 'title', label: 'Title', icon: 'textformat', kind: 'text' },
  { id: 'blocked', label: 'Blocked', icon: 'exclamation-circle', kind: 'boolean' },
];

const meta: Meta<typeof FilterBar> = {
  title: 'Molecules/Filter',
  component: FilterBar,
  // Tall enough for the Filter menu and the value popovers to open inside the frame (the layer host).
  decorators: [(Story) => <Pad w={760}><div className="min-h-[480px]"><Story /></div></Pad>],
};
export default meta;
type Story = StoryObj<typeof FilterBar>;

/** The Filter button, one chip, Clear all. Each part of a chip is its own button. */
export const Default: Story = {
  args: { fields, defaultValue: [{ id: 'a', field: 'status', operator: 'is_any_of', value: ['open', 'wip'] }] },
};

export const Empty: Story = { args: { fields } };

const many: Filter[] = [
  { id: 'a', field: 'status', operator: 'is', value: ['open'] },
  { id: 'b', field: 'labels', operator: 'includes_all', value: ['bug', 'ui'] },
  { id: 'c', field: 'created', operator: 'in_the_last', value: { type: 'relative', amount: 2, unit: 'week' } },
  { id: 'd', field: 'points', operator: 'gte', value: 3 },
  { id: 'e', field: 'title', operator: 'not_contains', value: 'wip' },
  { id: 'f', field: 'blocked', operator: 'is', value: false },
];

/** One of every kind, composed with the match all / any menu (it shows from two filters on). */
export const AllKinds: Story = {
  render: (args) => (
    <FilterBar {...args}>
      <FilterToolbar>
        <FilterMenu shortcut="f" />
        <FilterList />
        <FilterMatch />
        <FilterClear />
      </FilterToolbar>
    </FilterBar>
  ),
  args: { fields, defaultValue: many },
};

/** The Filter menu open: the searchable list of fields not yet filtered. Held open (`open`) for review, so a click
    elsewhere doesn't close it. */
export const MenuOpen: Story = {
  render: (args) => (
    <FilterBar {...args}>
      <FilterToolbar>
        <FilterMenu open />
        <FilterList />
        <FilterClear />
      </FilterToolbar>
    </FilterBar>
  ),
  args: { fields, defaultValue: [{ id: 'a', field: 'status', operator: 'is_any_of', value: ['open', 'wip'] }] },
};

/** A value editor on its own, on the popup surface it opens on. */
function Editor({ field, value }: { field: FilterField; value?: FilterValue }) {
  return (
    <div className={cn(popoverSurface, 'relative w-64 overflow-hidden')}>
      <FilterValueEditor field={field} value={value} operator={field.kind === 'date' && value && typeof value === 'object' && 'type' in value && value.type === 'relative' ? 'in_the_last' : undefined} onValueChange={() => undefined} />
    </div>
  );
}

/** A select's values: checkbox rows (with marks and counts) behind a search that keeps focus. */
export const SelectEditor: Story = { render: () => <Editor field={fields[0]} value={['open']} /> };

/** A date: the presets and a date input; and the "in the last" span. */
export const DateEditor: Story = {
  render: () => (
    <div className="flex items-start gap-4">
      <Editor field={fields[2]} value={{ type: 'preset', preset: 'today' }} />
      <Editor field={fields[2]} value={{ type: 'relative', amount: 2, unit: 'week' }} />
    </div>
  ),
};

/** A number (and, the same box, text): applied on Enter, the button or blur. */
export const NumberEditor: Story = { render: () => <Editor field={fields[3]} value={3} /> };

/** Yes / No. */
export const BooleanEditor: Story = { render: () => <Editor field={fields[5]} value={false} /> };

export const Dark: Story = {
  decorators: [(Story) => <Pad w={760} dark><div className="min-h-[200px]"><Story /></div></Pad>],
  args: { fields, defaultValue: many.slice(0, 3) },
};

/** Chips on their own, and the read-only preview chip the natural-language box draws. */
export const Chips: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {many.map((f) => <FilterChip key={f.id} filter={f} field={fields.find((x) => x.id === f.field)} onValueChange={() => undefined} onRemove={() => undefined} />)}
      <FilterChip readOnly variant="preview" size="sm" filter={many[0]} field={fields[0]} />
    </div>
  ),
};
