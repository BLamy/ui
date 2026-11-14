import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  ColorPicker, ColorPickerArea, ColorPickerContent, ColorPickerSlider, ColorPickerSwatches, ColorPickerSwatchItem, ColorPickerTrigger,
} from '@/components/ui/color-picker';
import { Popover } from '@/components/ui/popover';
import { Caption, Panel } from '../stories/primitive-frame';

const swatches = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2'];

const meta: Meta<typeof ColorPicker> = {
  title: 'Molecules/ColorPicker',
  component: ColorPicker,
  decorators: [(Story) => <Panel w={340}><div className="h-[440px]"><Story /></div></Panel>],
};
export default meta;
type Story = StoryObj<typeof ColorPicker>;

export const Default: Story = {
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#7f5af0" {...args}>
      <Popover>
        <ColorPickerTrigger />
        <ColorPickerContent swatches={swatches} />
      </Popover>
    </ColorPicker>
  ),
};

export const Open: Story = {
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#7f5af0" {...args}>
      <Popover defaultOpen>
        <ColorPickerTrigger />
        <ColorPickerContent swatches={swatches} />
      </Popover>
    </ColorPicker>
  ),
};

export const WithOpacity: Story = {
  name: 'With opacity',
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="hsla(262, 83%, 66%, 0.6)" {...args}>
      <Popover defaultOpen>
        <ColorPickerTrigger />
        <ColorPickerContent alpha />
      </Popover>
    </ColorPicker>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#ff9f0a" className="flex flex-col gap-3" {...args}>
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <Popover key={s}>
          <ColorPickerTrigger size={s} aria-label={`Color, ${s}`} />
          <ColorPickerContent />
        </Popover>
      ))}
    </ColorPicker>
  ),
};

/** The parts on their own, in a panel: no popover. */
export const Composed: Story = {
  render: (args) => {
    const [color, setColor] = useState('#0a84ff');
    return (
      <ColorPicker aria-label="Accent" className="flex flex-col gap-3" {...args} value={color} onValueChange={setColor}>
        <ColorPickerArea className="h-36 w-full" />
        <ColorPickerSlider channel="hue" label="Hue" showValue />
        <ColorPickerSlider channel="alpha" label="Opacity" showValue />
        <Caption>Presets</Caption>
        <ColorPickerSwatches aria-label="Presets">
          {swatches.map((c) => <ColorPickerSwatchItem key={c} value={c} />)}
        </ColorPickerSwatches>
        <Caption>{color}</Caption>
      </ColorPicker>
    );
  },
};

export const Dark: Story = {
  decorators: [(Story) => <Panel w={340} dark><div className="h-[440px]"><Story /></div></Panel>],
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#7f5af0" {...args}>
      <Popover defaultOpen>
        <ColorPickerTrigger />
        <ColorPickerContent swatches={swatches} />
      </Popover>
    </ColorPicker>
  ),
};
