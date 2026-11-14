import type { Meta, StoryObj } from '@storybook/react-vite';
import { Listbox, ListboxGroup, ListboxGroupLabel, ListboxItem } from '@/components/ui/list-box';
import { Icon } from '@/lib/icon';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Listbox> = {
  title: 'Molecules/Listbox',
  component: Listbox,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Listbox>;

const ringtones = ['Reflection', 'Apex', 'Beacon', 'Bulletin', 'Chimes'];

export const SingleSelection: Story = {
  render: () => (
    <Listbox aria-label="Ringtone" defaultValue="Reflection">
      {ringtones.map((r) => <ListboxItem key={r} value={r}>{r}</ListboxItem>)}
    </Listbox>
  ),
};

const people = (
  <Listbox aria-label="Share with" multiple defaultValue={['ana', 'kim']}>
    <ListboxItem value="ana" label="Ana" icon={<Icon name="person" size={28} />} description="ana@example.com">Ana Torres</ListboxItem>
    <ListboxItem value="kim" label="Kim" icon={<Icon name="person" size={28} />} description="kim@example.com">Kim Park</ListboxItem>
    <ListboxItem value="lee" label="Lee" icon={<Icon name="person" size={28} />} description="lee@example.com">Lee Chen</ListboxItem>
  </Listbox>
);

export const MultipleWithDetails: Story = { render: () => people };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => people };

/** The compact variant Select and Combobox draw in their popups, with groups. */
export const PopupWithGroups: Story = {
  render: () => (
    <Listbox aria-label="Timezone" variant="popup" defaultValue="cet" className="rounded-panel bg-card">
      <ListboxGroup>
        <ListboxGroupLabel>Americas</ListboxGroupLabel>
        <ListboxItem value="pt">Pacific Time</ListboxItem>
        <ListboxItem value="et">Eastern Time</ListboxItem>
      </ListboxGroup>
      <ListboxGroup>
        <ListboxGroupLabel>Europe</ListboxGroupLabel>
        <ListboxItem value="cet">Central European Time</ListboxItem>
      </ListboxGroup>
    </Listbox>
  ),
};

/** Options as data. */
export const FromData: Story = {
  render: () => <Listbox aria-label="Ringtone" defaultValue="Apex" items={ringtones} />,
};
