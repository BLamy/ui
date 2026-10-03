import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { parseColor, type Color } from 'react-aria-components';
import { ColorField, ColorFieldGroup, ColorFieldInput, ColorFieldSwatch, ColorSwatch } from '@/components/ui/color-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldDescription, FieldError } from '@/components/ui/text-field';
import { Caption, Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ColorField> = {
  title: 'Molecules/ColorField',
  component: ColorField,
  decorators: [(Story) => <Panel w={340}><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ColorField>;

export const Default: Story = {
  render: (args) => (
    <ColorField {...args} defaultValue="#7f5af0">
      <Label variant="field">Accent</Label>
      <ColorFieldGroup>
        <ColorFieldSwatch />
        <ColorFieldInput />
      </ColorFieldGroup>
      <FieldDescription>A hex color, with or without the #.</FieldDescription>
    </ColorField>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <ColorField {...args}>
      <Label variant="field">Accent</Label>
      <ColorFieldGroup>
        <ColorFieldSwatch />
        <ColorFieldInput placeholder="#RRGGBB" />
      </ColorFieldGroup>
    </ColorField>
  ),
};

export const PlainInput: Story = {
  name: 'With the plain Input',
  render: (args) => (
    <ColorField {...args} defaultValue="#30d158">
      <Label variant="field">Accent</Label>
      <Input />
    </ColorField>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <ColorField key={s} {...args} aria-label={s} defaultValue="#ff9f0a">
          <ColorFieldGroup size={s}><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
        </ColorField>
      ))}
    </>
  ),
};

export const Channel: Story = {
  render: (args) => (
    <ColorField {...args} colorSpace="hsl" channel="hue" defaultValue="#7f5af0">
      <Label variant="field">Hue</Label>
      <Input />
    </ColorField>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <ColorField {...args} isInvalid defaultValue="#7f5af0">
      <Label variant="field">Accent</Label>
      <ColorFieldGroup><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
      <FieldError>Pick a darker color.</FieldError>
    </ColorField>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <ColorField {...args} isDisabled defaultValue="#7f5af0">
      <Label variant="field">Accent</Label>
      <ColorFieldGroup><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
    </ColorField>
  ),
};

export const Controlled: Story = {
  render: (args) => {
    const [color, setColor] = useState<Color | null>(parseColor('#0a84ff'));
    return (
      <>
        <ColorField {...args} value={color} onChange={setColor}>
          <Label variant="field">Accent</Label>
          <ColorFieldGroup><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
        </ColorField>
        <Caption>{color ? color.toString('hsl') : 'No color'}</Caption>
      </>
    );
  },
};

export const Swatches: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {['#ff453a', '#ff9f0a', '#30d158', '#0a84ff', '#bf5af2'].map((c) => <ColorSwatch key={c} color={c} className="size-8" />)}
      <ColorSwatch color="rgba(10, 132, 255, 0.4)" className="size-8" />
    </div>
  ),
};

export const Dark: Story = {
  decorators: [(Story) => <Panel w={340} dark><Story /></Panel>],
  render: (args) => (
    <ColorField {...args} defaultValue="#7f5af0">
      <Label variant="field">Accent</Label>
      <ColorFieldGroup><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
    </ColorField>
  ),
};
