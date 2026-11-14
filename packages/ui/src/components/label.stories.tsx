import type { Meta, StoryObj } from '@storybook/react-vite';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Label> = {
  title: 'Atoms/Label',
  component: Label,
  args: { children: 'Display name', variant: 'default' },
  argTypes: { variant: { control: 'inline-radio', options: ['default', 'field', 'control'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const WithField: Story = {
  render: (args) => (
    <div className="flex flex-col gap-1.5">
      <Label {...args} htmlFor="label-story-name" />
      <Input id="label-story-name" defaultValue="Brett" />
    </div>
  ),
  args: { variant: 'field' },
};

export const WrappingAControl: Story = {
  render: (args) => (
    <Label {...args}>
      <Checkbox defaultChecked />
      Remember me
    </Label>
  ),
  args: { variant: 'control', children: undefined },
};
