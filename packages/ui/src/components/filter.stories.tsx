import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterBar, FilterChip } from '@/components/ui/filter';
import type { Filter, FilterField } from '@/lib/filter';
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
  decorators: [(Story) => <Pad w={760}><div style={{ minHeight: 200 }}><Story /></div></Pad>],
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

/** One of every kind, with the match all / any menu. */
export const AllKinds: Story = { args: { fields, defaultValue: many, showMatch: true } };

/** Chips on their own, and the read-only preview chip the natural-language box draws. */
export const Chips: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {many.map((f) => <FilterChip key={f.id} filter={f} field={fields.find((x) => x.id === f.field)} onChange={() => undefined} onRemove={() => undefined} />)}
      <FilterChip readOnly tone="preview" size="sm" filter={many[0]} field={fields[0]} />
    </div>
  ),
};
