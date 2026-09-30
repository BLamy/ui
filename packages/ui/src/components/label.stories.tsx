import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TextField } from '@/components/ui/text-field';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Label> = {
  title: 'Atoms/Label',
  component: Label,
  args: { children: 'Display name', variant: 'default' },
  argTypes: { variant: { control: 'inline-radio', options: ['default', 'field'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const WithField: Story = {
  render: (args) => (
    <TextField defaultValue="Brett">
      <Label {...args} />
      <Input />
    </TextField>
  ),
  args: { variant: 'field' },
};
