import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { formatColor, parseColor } from '@ui-sdk/core/color';
import {
  ColorInput, ColorPicker, ColorPickerArea, ColorPickerChannelInput, ColorPickerContent, ColorPickerField, ColorPickerInput,
  ColorPickerSlider, ColorPickerSwatch, ColorPickerSwatches, ColorPickerSwatchItem, ColorPickerTrigger, ColorSwatch,
} from '@/components/ui/color-picker';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Popover } from '@/components/ui/popover';
import { SizeClassProvider } from '@/lib/container';
import { Caption, Panel, Screen } from '../stories/primitive-frame';

const swatches = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2'];

const meta: Meta<typeof ColorPicker> = {
  title: 'Molecules/ColorPicker',
  component: ColorPicker,
  decorators: [(Story, { parameters }) => (parameters.bare ? <Story /> : <Panel w={340}><div className="h-[440px]"><Story /></div></Panel>)],
};
export default meta;
type Story = StoryObj<typeof ColorPicker>;

export const Default: Story = {
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#7f5af0" {...args}>
      <ColorPickerTrigger />
      <ColorPickerContent swatches={swatches} />
    </ColorPicker>
  ),
};

export const Open: Story = {
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#7f5af0" defaultOpen {...args}>
      <ColorPickerTrigger />
      <ColorPickerContent swatches={swatches} />
    </ColorPicker>
  ),
};

export const WithOpacity: Story = {
  name: 'With opacity',
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="hsla(262, 83%, 66%, 0.6)" format="hsl" defaultOpen {...args}>
      <ColorPickerTrigger />
      <ColorPickerContent alpha />
    </ColorPicker>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#ff9f0a" className="flex flex-col gap-3" {...args}>
      {(['sm', 'default', 'lg'] as const).map((s) => (
        // One popup per trigger: each opens its own.
        <Popover key={s}>
          <ColorPickerTrigger size={s} aria-label={`Color, ${s}`} />
          <ColorPickerContent />
        </Popover>
      ))}
    </ColorPicker>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Field disabled>
      <FieldLabel>Accent</FieldLabel>
      <ColorPicker defaultValue="#7f5af0" {...args}>
        <ColorPickerTrigger />
        <ColorPickerContent />
      </ColorPicker>
    </Field>
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
        <ColorPickerField size="sm">
          <ColorPickerSwatch />
          <ColorPickerInput aria-label="Hex" />
        </ColorPickerField>
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
  parameters: { bare: true },
  decorators: [(Story) => <Panel w={340} dark><div className="h-[440px]"><Story /></div></Panel>],
  render: (args) => (
    <ColorPicker aria-label="Accent" defaultValue="#7f5af0" defaultOpen {...args}>
      <ColorPickerTrigger />
      <ColorPickerContent swatches={swatches} />
    </ColorPicker>
  ),
};

/** `presentation="auto"` in a compact (phone) container: the popup is a bottom sheet. */
export const Phone: Story = {
  parameters: { bare: true },
  render: (args) => (
    <Screen h={640}>
      <SizeClassProvider value="compact">
        <Field>
          <FieldLabel>Accent</FieldLabel>
          <ColorPicker defaultValue="#30d158" presentation="auto" {...args}>
            <ColorPickerTrigger />
            <ColorPickerContent swatches={swatches} />
          </ColorPicker>
        </Field>
      </SizeClassProvider>
    </Screen>
  ),
};

/* ── ColorInput: the typed field on one line ── */

export const Input: Story = {
  name: 'ColorInput',
  render: () => (
    <Field>
      <FieldLabel>Accent</FieldLabel>
      <ColorInput defaultValue="#7f5af0" />
      <FieldDescription>Any CSS color: a hex, a name, hsl() or oklch().</FieldDescription>
    </Field>
  ),
};

export const InputWithoutSwatch: Story = {
  name: 'ColorInput · without a swatch',
  render: () => (
    <Field>
      <FieldLabel>Accent</FieldLabel>
      <ColorInput defaultValue="#30d158">
        <ColorPickerInput placeholder="#RRGGBB" />
      </ColorInput>
    </Field>
  ),
};

export const InputSizes: Story = {
  name: 'ColorInput · sizes',
  render: () => (
    <div className="grid gap-3">
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <ColorInput key={s} aria-label={s} defaultValue="#ff9f0a" size={s} />
      ))}
    </div>
  ),
};

export const InputChannels: Story = {
  name: 'ColorInput · channels',
  render: () => (
    <Field>
      <FieldLabel>Hue</FieldLabel>
      <ColorInput space="hsl" defaultValue="#7f5af0">
        <ColorPickerSwatch />
        <ColorPickerChannelInput channel="hue" />
      </ColorInput>
    </Field>
  ),
};

export const InputInvalid: Story = {
  name: 'ColorInput · invalid',
  render: () => (
    <Field invalid>
      <FieldLabel>Accent</FieldLabel>
      <ColorInput defaultValue="#7f5af0" />
      <FieldError match>Pick a darker color.</FieldError>
    </Field>
  ),
};

export const InputDisabled: Story = {
  name: 'ColorInput · disabled',
  render: () => (
    <Field disabled>
      <FieldLabel>Accent</FieldLabel>
      <ColorInput defaultValue="#7f5af0" />
    </Field>
  ),
};

export const InputControlled: Story = {
  name: 'ColorInput · controlled',
  render: () => {
    const [color, setColor] = useState('#0a84ff');
    const parsed = parseColor(color);
    return (
      <div className="grid gap-3">
        <Field>
          <FieldLabel>Accent</FieldLabel>
          <ColorInput value={color} onValueChange={setColor} />
        </Field>
        <Caption>{parsed ? formatColor(parsed, 'hsl') : color}</Caption>
      </div>
    );
  },
};

export const InputDark: Story = {
  name: 'ColorInput · dark',
  parameters: { bare: true },
  decorators: [(Story) => <Panel w={340} dark><Story /></Panel>],
  render: () => (
    <Field>
      <FieldLabel>Accent</FieldLabel>
      <ColorInput defaultValue="#7f5af0" />
    </Field>
  ),
};

export const Swatches: Story = {
  name: 'ColorSwatch',
  render: () => (
    <div className="flex items-center gap-2">
      {swatches.map((c) => <ColorSwatch key={c} color={c} className="size-8" />)}
      <ColorSwatch color="rgba(10, 132, 255, 0.4)" className="size-8" />
    </div>
  ),
};
