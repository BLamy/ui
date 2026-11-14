import type { Meta, StoryObj } from '@storybook/react-vite';
import { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue } from '@/components/ui/progress';
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
    <Progress label="Preparing…" />
  </div>
);

export const Variants: Story = { render: () => all };
/** No `value`: how far along is unknown, so the bar slides. */
export const Indeterminate: Story = { args: { value: undefined } };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => all };

/** The parts, placed by hand, and a `format` of its own for the value. */
export const Composed: Story = {
  render: () => (
    <Progress value={3} max={12} format={(value) => `${value} of 12 files`}>
      <ProgressLabel>Copying files</ProgressLabel>
      <ProgressTrack size="lg" className="col-span-2"><ProgressIndicator tone="success" /></ProgressTrack>
      <ProgressValue className="col-span-2" />
    </Progress>
  ),
};
