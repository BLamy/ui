import type { Meta, StoryObj } from '@storybook/react-vite';
import { Progress } from '@/components/ui/progress';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Progress> = {
  title: 'Molecules/Progress',
  component: Progress,
  args: { value: 60, 'aria-label': 'Upload', size: 'default', tone: 'default' },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    tone: { control: 'inline-radio', options: ['default', 'success', 'destructive'] },
  },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {};

const all = (
  <div className="flex flex-col gap-6">
    <Progress label="Uploading 12 photos" showValue value={38} />
    <Progress label="Backup complete" showValue value={100} tone="success" size="sm" />
    <Progress label="Storage almost full" showValue value={92} tone="destructive" size="lg" />
    <Progress label="Preparing…" isIndeterminate />
  </div>
);

export const Variants: Story = { render: () => all };
export const Indeterminate: Story = { args: { isIndeterminate: true, value: undefined } };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => all };
