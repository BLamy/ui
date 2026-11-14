import type { Meta, StoryObj } from '@storybook/react-vite';
import { Slider, SliderControl, SliderIndicator, SliderThumb, SliderTrack, SliderValue } from '@/components/ui/slider';
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
      <Slider label="Brightness" showValue defaultValue={0.64} format={{ style: 'percent' }} min={0} max={1} step={0.01} />
      <Slider label="Text size" showValue defaultValue={3} min={1} max={7} step={1} />
      <Slider label="Price range" showValue defaultValue={[20, 80]} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} thumbLabels={['Lowest price', 'Highest price']} />
      <Slider label="Disabled" defaultValue={30} disabled />
    </div>
  ),
};

/** `tone` for media controls over artwork or dark glass (`onDark`) and light imagery (`onLight`); `size="sm"` is the
    scrubber thumb that grows while dragging. Custom `trackColor` / `fillColor` / `thumbColor` fine-tune any tone. */
export const Tones: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-[18px] p-5" style={{ background: 'linear-gradient(160deg,#5b2a86,#1d1030 70%)' }}>
        <Slider aria-label="Playback position" tone="onDark" size="sm" defaultValue={38} />
        <Slider aria-label="Volume" tone="onDark" defaultValue={70} />
      </div>
      <div className="flex flex-col gap-4 rounded-[18px] p-5" style={{ background: 'linear-gradient(160deg,#fde2c4,#f7c6d9)' }}>
        <Slider aria-label="Warmth" tone="onLight" size="sm" defaultValue={55} />
        <Slider aria-label="Brightness" fillColor="#FF9F0A" trackColor="rgba(255,159,10,.22)" defaultValue={62} />
      </div>
    </div>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel dark><Story /></Panel>],
  render: () => (
    <div className="flex flex-col gap-6">
      <Slider label="Brightness" showValue defaultValue={0.64} format={{ style: 'percent' }} min={0} max={1} step={0.01} />
      <Slider label="Price range" showValue defaultValue={[20, 80]} />
    </div>
  ),
};

/** The parts, placed by hand: the value under the track, and a name for each end of the range. */
export const Composed: Story = {
  render: () => (
    <Slider aria-label="Opening hours" defaultValue={[9, 17]} min={0} max={24} format={(hour) => `${hour}:00`}>
      <SliderControl className="col-span-2">
        <SliderTrack>
          <SliderIndicator />
          <SliderThumb index={0} aria-label="Opens" />
          <SliderThumb index={1} aria-label="Closes" />
        </SliderTrack>
      </SliderControl>
      <SliderValue className="col-span-2 text-center" />
    </Slider>
  ),
};
