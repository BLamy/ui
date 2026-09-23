import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider } from './slider';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Slider> = {
  title: 'Atoms/Slider',
  component: Slider,
  args: { defaultValue: 40, 'aria-label': 'Volume' },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {};

export const Labeled: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Slider label="Brightness" showValue defaultValue={0.64} formatOptions={{ style: 'percent' }} minValue={0} maxValue={1} step={0.01} />
      <Slider label="Text size" showValue defaultValue={3} minValue={1} maxValue={7} step={1} />
      <Slider label="Price range" showValue defaultValue={[20, 80]} formatOptions={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} />
      <Slider label="Disabled" defaultValue={30} isDisabled />
    </div>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => (
    <div className="flex flex-col gap-6">
      <Slider label="Brightness" showValue defaultValue={0.64} formatOptions={{ style: 'percent' }} minValue={0} maxValue={1} step={0.01} />
      <Slider label="Price range" showValue defaultValue={[20, 80]} />
    </div>
  ),
};
