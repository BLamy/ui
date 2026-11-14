import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { formatColor, parseColor } from '@ui-sdk/core/color';
import { ColorField, ColorFieldChannelInput, ColorFieldInput, ColorFieldSwatch, ColorSwatch } from '@/components/ui/color-field';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
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
    <Field>
      <FieldLabel variant="field">Accent</FieldLabel>
      <ColorField defaultValue="#7f5af0" {...args} />
      <FieldDescription>Any CSS color: a hex, a name, hsl() or oklch().</FieldDescription>
    </Field>
  ),
};

export const PlainInput: Story = {
  name: 'Without a swatch',
  render: (args) => (
    <Field>
      <FieldLabel variant="field">Accent</FieldLabel>
      <ColorField defaultValue="#30d158" {...args}>
        <ColorFieldInput placeholder="#RRGGBB" />
      </ColorField>
    </Field>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <>
      {(['sm', 'default', 'lg'] as const).map((s) => (
        <ColorField key={s} aria-label={s} defaultValue="#ff9f0a" {...args} size={s} />
      ))}
    </>
  ),
};

export const Channel: Story = {
  render: (args) => (
    <Field>
      <FieldLabel variant="field">Hue</FieldLabel>
      <ColorField space="hsl" defaultValue="#7f5af0" {...args}>
        <ColorFieldSwatch />
        <ColorFieldChannelInput channel="hue" />
      </ColorField>
    </Field>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <Field invalid>
      <FieldLabel variant="field">Accent</FieldLabel>
      <ColorField defaultValue="#7f5af0" {...args} />
      <FieldError match>Pick a darker color.</FieldError>
    </Field>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <Field disabled>
      <FieldLabel variant="field">Accent</FieldLabel>
      <ColorField defaultValue="#7f5af0" {...args} />
    </Field>
  ),
};

export const Controlled: Story = {
  render: (args) => {
    const [color, setColor] = useState('#0a84ff');
    const parsed = parseColor(color);
    return (
      <>
        <Field>
          <FieldLabel variant="field">Accent</FieldLabel>
          <ColorField {...args} value={color} onValueChange={setColor} />
        </Field>
        <Caption>{parsed ? formatColor(parsed, 'hsl') : color}</Caption>
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
    <Field>
      <FieldLabel variant="field">Accent</FieldLabel>
      <ColorField defaultValue="#7f5af0" {...args} />
    </Field>
  ),
};
