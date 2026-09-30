import type { Meta, StoryObj } from '@storybook/react-vite';
import { ListBox, ListBoxItem } from '@/components/ui/list-box';
import { Icon } from '@/lib/icon';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ListBox> = {
  title: 'Molecules/ListBox',
  component: ListBox,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ListBox>;

const ringtones = ['Reflection', 'Apex', 'Beacon', 'Bulletin', 'Chimes'];

export const SingleSelection: Story = {
  render: () => (
    <ListBox aria-label="Ringtone" selectionMode="single" defaultSelectedKeys={['Reflection']} disallowEmptySelection>
      {ringtones.map((r) => <ListBoxItem key={r} id={r}>{r}</ListBoxItem>)}
    </ListBox>
  ),
};

const people = (
  <ListBox aria-label="Share with" selectionMode="multiple" defaultSelectedKeys={['ana', 'kim']}>
    <ListBoxItem id="ana" textValue="Ana" icon={<Icon name="person" size={28} />} description="ana@example.com">Ana Torres</ListBoxItem>
    <ListBoxItem id="kim" textValue="Kim" icon={<Icon name="person" size={28} />} description="kim@example.com">Kim Park</ListBoxItem>
    <ListBoxItem id="lee" textValue="Lee" icon={<Icon name="person" size={28} />} description="lee@example.com">Lee Chen</ListBoxItem>
  </ListBox>
);

export const MultipleWithDetails: Story = { render: () => people };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => people };
