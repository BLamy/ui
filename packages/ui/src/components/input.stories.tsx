import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';
import { Textarea } from './textarea';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
  args: { placeholder: 'Name', size: 'default' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { 'aria-label': 'Name' } };

const states = (
  <>
    <Input aria-label="Empty" placeholder="Placeholder" />
    <Input aria-label="Filled" defaultValue="Brett Lamy" />
    <Input aria-label="Small" size="sm" placeholder="Small" />
    <Input aria-label="Large" size="lg" placeholder="Large" />
    <Input aria-label="Disabled" disabled defaultValue="Disabled" />
    <Textarea aria-label="Notes" placeholder="Notes" />
  </>
);

export const States: Story = { render: () => states };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => states };
export const TextareaField: Story = { render: () => <Textarea aria-label="Message" defaultValue={'Hey! Are we still on for Friday?\nI can bring the slides.'} /> };
