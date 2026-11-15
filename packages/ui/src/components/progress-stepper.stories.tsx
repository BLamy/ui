import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ProgressStep, ProgressStepDescription, ProgressStepIcon, ProgressStepLabel, ProgressStepper, ProgressStepTrack,
  type ProgressStepItem,
} from '@/components/ui/progress-stepper';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { Caption, Panel } from '../stories/primitive-frame';

const steps: ProgressStepItem[] = [
  { id: 'cart', label: 'Cart', icon: <Icon name="cart" size={18} sw={2} /> },
  { id: 'address', label: 'Address', icon: <Icon name="house" size={18} sw={2} /> },
  { id: 'payment', label: 'Payment', icon: <Icon name="wallet" size={18} sw={2} /> },
  { id: 'done', label: 'Done', icon: <Icon name="check-circle" size={18} sw={2} /> },
];

const meta: Meta<typeof ProgressStepper> = {
  title: 'Molecules/ProgressStepper',
  component: ProgressStepper,
  args: { steps, current: 1, variant: 'bars', labels: true, animated: true, 'aria-label': 'Checkout' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['bars', 'line'] },
    current: { control: { type: 'range', min: 0, max: steps.length, step: 1 } },
  },
  decorators: [(Story, { parameters }) => <Panel w={parameters.panelWidth ?? 420} dark={parameters.dark}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ProgressStepper>;

/** Bars: a segment under each icon that fills as its step completes. */
export const Bars: Story = {};
/** Line: one line joining the icons. */
export const Line: Story = { args: { variant: 'line' } };
/** Without labels the names are for screen readers only. */
export const NoLabels: Story = { args: { labels: false } };
/** `current={steps.length}`: every step complete, each with its check badge. */
export const AllComplete: Story = { args: { current: steps.length } };
/** Not animated (and under reduced motion): the current segment is a still, partial bar. */
export const Still: Story = { args: { animated: false } };

/** The parts: a description per step and a marker of your own. */
export const Parts: Story = {
  render: () => (
    <ProgressStepper current={2} labels aria-label="Delivery">
      <ProgressStep icon={<Icon name="check-circle" size={20} />} label="Placed" description="12:04" />
      <ProgressStep icon={<Icon name="archivebox" size={20} />} label="Packed" description="12:19" />
      <ProgressStep>
        <ProgressStepIcon><Spinner size={16} /></ProgressStepIcon>
        <ProgressStepTrack />
        <span className="flex min-w-0 max-w-full flex-col items-center">
          <ProgressStepLabel>On the way</ProgressStepLabel>
          <ProgressStepDescription>About 8 min</ProgressStepDescription>
        </span>
      </ProgressStep>
      <ProgressStep icon={<Icon name="house" size={20} />} label="Delivered" />
    </ProgressStepper>
  ),
};

/** Beside a Progress bar: the segments are the same rail, so the two read as one system. */
export const WithProgress: Story = {
  render: (args) => (
    <div className="grid gap-5">
      <ProgressStepper {...args} />
      <Progress label="Uploading receipt" showValue value={45} />
    </div>
  ),
};

export const Dark: Story = {
  parameters: { dark: true },
  render: (args) => (
    <div className="grid gap-6">
      <Caption>Bars</Caption>
      <ProgressStepper {...args} />
      <Caption>Line</Caption>
      <ProgressStepper {...args} variant="line" current={2} />
    </div>
  ),
};

/** A 320px-wide row: labels truncate rather than push the steps apart. */
export const Narrow: Story = {
  parameters: { panelWidth: 320 },
  args: {
    steps: [
      { id: 'a', label: 'Order placed', icon: <Icon name="check-circle" size={18} /> },
      { id: 'b', label: 'Being prepared', icon: <Icon name="archivebox" size={18} /> },
      { id: 'c', label: 'Out for delivery', icon: <Icon name="car" size={18} /> },
      { id: 'd', label: 'Delivered to door', icon: <Icon name="house" size={18} /> },
    ],
    current: 2,
  },
};
