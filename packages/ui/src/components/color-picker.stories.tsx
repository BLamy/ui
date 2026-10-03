import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { parseColor, type Color } from 'react-aria-components';
import {
  ColorArea, ColorPicker, ColorPickerContent, ColorPickerTrigger, ColorSlider, ColorSwatchPicker, ColorSwatchPickerItem,
} from '@/components/ui/color-picker';
import { Label } from '@/components/ui/label';
import { PopoverTrigger } from '@/components/ui/popover';
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
  render: () => (
    <ColorPicker defaultValue="#7f5af0">
      <PopoverTrigger>
        <ColorPickerTrigger />
        <ColorPickerContent swatches={swatches} />
      </PopoverTrigger>
    </ColorPicker>
  ),
};

export const Open: Story = {
  render: () => (
    <ColorPicker defaultValue="#7f5af0">
      <PopoverTrigger defaultOpen>
        <ColorPickerTrigger />
        <ColorPickerContent swatches={swatches} />
      </PopoverTrigger>
    </ColorPicker>
  ),
};

export const WithOpacity: Story = {
  name: 'With opacity',
  render: () => (
    <ColorPicker defaultValue="hsla(262, 83%, 66%, 0.6)">
      <PopoverTrigger defaultOpen>
        <ColorPickerTrigger />
        <ColorPickerContent alpha />
      </PopoverTrigger>
    </ColorPicker>
  ),
};

export const Sizes: Story = {
  render: () => (
    <ColorPicker defaultValue="#ff9f0a">
      <div className="flex flex-col gap-3">
        {(['sm', 'default', 'lg'] as const).map((s) => (
          <PopoverTrigger key={s}>
            <ColorPickerTrigger size={s} aria-label={`Color, ${s}`} />
            <ColorPickerContent />
          </PopoverTrigger>
        ))}
      </div>
    </ColorPicker>
  ),
};

/** The parts on their own, in a panel: no popover. */
export const Composed: Story = {
  render: () => {
    const [color, setColor] = useState<Color>(parseColor('#0a84ff'));
    return (
      <ColorPicker value={color} onChange={setColor}>
        <div className="flex flex-col gap-3">
          <ColorArea className="h-36 w-full" />
          <ColorSlider colorSpace="hsb" channel="hue" label="Hue" showValue />
          <ColorSlider channel="alpha" label="Opacity" showValue />
          <Label variant="field">Presets</Label>
          <ColorSwatchPicker aria-label="Presets">
            {swatches.map((c) => <ColorSwatchPickerItem key={c} color={c} />)}
          </ColorSwatchPicker>
          <Caption>{color.toString('hex')}</Caption>
        </div>
      </ColorPicker>
    );
  },
};

export const Dark: Story = {
  decorators: [(Story) => <Panel w={340} dark><div className="h-[440px]"><Story /></div></Panel>],
  render: () => (
    <ColorPicker defaultValue="#7f5af0">
      <PopoverTrigger defaultOpen>
        <ColorPickerTrigger />
        <ColorPickerContent swatches={swatches} />
      </PopoverTrigger>
    </ColorPicker>
  ),
};
