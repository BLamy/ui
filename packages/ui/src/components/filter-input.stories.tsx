import type { Meta, StoryObj } from '@storybook/react-vite';
import { FilterBar, FilterToolbar } from '@/components/ui/filter';
import { FilterInput } from '@/components/ui/filter-input';
import type { FilterField } from '@/lib/filter-model';
import { Pad } from '../stories/frame';

const fields: FilterField[] = [
  { id: 'status', label: 'Status', kind: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'wip', label: 'In progress' }, { value: 'done', label: 'Done' }] },
  { id: 'priority', label: 'Priority', kind: 'select', options: [{ value: 'urgent', label: 'Urgent', color: 'var(--destructive)' }, { value: 'high', label: 'High' }, { value: 'low', label: 'Low' }] },
  { id: 'points', label: 'Points', kind: 'number' },
];

const meta: Meta<typeof FilterInput> = {
  title: 'Molecules/Filter/FilterInput',
  component: FilterInput,
  decorators: [(Story) => <Pad w={760}><div className="min-h-[200px]"><Story /></div></Pad>],
};
export default meta;
type Story = StoryObj<typeof FilterInput>;

/** A sentence previews as chips before anything is applied; Enter applies them to the bar. The model (~40 KB) loads on first use. */
export const Default: Story = {
  render: () => (
    <FilterBar fields={fields}>
      <FilterInput defaultValue="priority urgent and points over 3" parse={{ reference: new Date(2026, 0, 14) }} />
      <FilterToolbar />
    </FilterBar>
  ),
};

/** Nothing understood: the preview says so and lists what it ignored. */
export const NothingUnderstood: Story = {
  render: () => (
    <FilterBar fields={fields}>
      <FilterInput defaultValue="qwerty zxcvb" />
      <FilterToolbar />
    </FilterBar>
  ),
};

export const Empty: Story = {
  render: () => (
    <FilterBar fields={fields}>
      <FilterInput />
      <FilterToolbar />
    </FilterBar>
  ),
};

/** `description={false}`: no line under the box (an app that explains the model elsewhere). */
export const NoDescription: Story = {
  render: () => (
    <FilterBar fields={fields}>
      <FilterInput description={false} />
      <FilterToolbar />
    </FilterBar>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Pad w={760} dark><div className="min-h-[200px]"><Story /></div></Pad>],
  render: () => (
    <FilterBar fields={fields}>
      <FilterInput defaultValue="priority urgent and points over 3" parse={{ reference: new Date(2026, 0, 14) }} />
      <FilterToolbar />
    </FilterBar>
  ),
};
