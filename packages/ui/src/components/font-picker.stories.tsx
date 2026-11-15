import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  FontList, FontPicker, FontPickerContent, FontPickerTrigger, FontStackPicker, FontStackPickerContent, FontStackPickerInputGroup,
} from '@/components/ui/font-picker';
import { fontStack, useGoogleFont } from '@/lib/google-fonts';
import { Caption, Panel } from '../stories/primitive-frame';

const meta: Meta<typeof FontPicker> = {
  title: 'Molecules/FontPicker',
  component: FontPicker,
  decorators: [(Story, { parameters }) => <Panel w={360} dark={parameters.dark}><div className="h-[460px]"><Story /></div></Panel>],
};
export default meta;
type Story = StoryObj<typeof FontPicker>;

function Previewing() {
  const [font, setFont] = useState<string | null>('Fraunces');
  const [preview, setPreview] = useState<string | null | undefined>();
  const shown = preview === undefined ? font : preview;
  useGoogleFont(shown);
  return (
    <div className="grid gap-3">
      <FontPicker aria-label="Headline font" value={font} onValueChange={setFont} onPreview={setPreview} />
      <p className="m-0 text-[28px] leading-tight font-bold" style={{ fontFamily: fontStack(shown) }}>Grow something green</p>
      <Caption>Hover the list: the headline wears each family until you leave it.</Caption>
    </div>
  );
}

export const Default: Story = { render: () => <Previewing /> };

export const List: Story = {
  render: function Render() {
    const [font, setFont] = useState<string | null>('Inter');
    return <FontList value={font} onValueChange={setFont} className="overflow-hidden rounded-card bg-card shadow-hairline" />;
  },
};

export const Stack: Story = {
  name: 'Font stack',
  render: function Render() {
    const [stack, setStack] = useState<string[]>(['Inter', 'Roboto']);
    return (
      <div className="grid gap-3">
        <FontStackPicker aria-label="Text fonts" value={stack} onValueChange={setStack} />
        <Caption>{fontStack(stack) ?? 'The system font'}</Caption>
      </div>
    );
  },
};

export const MonospaceStack: Story = {
  name: 'Monospace stack',
  render: function Render() {
    const [stack, setStack] = useState<string[]>([]);
    return <FontStackPicker aria-label="Code fonts" value={stack} onValueChange={setStack} defaultCategory="monospace" placeholder="System monospace" />;
  },
};

export const Open: Story = {
  render: () => <FontPicker aria-label="Headline font" defaultValue="Inter" defaultOpen />,
};

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-3">
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <FontPicker key={size} aria-label={`Font, ${size}`} defaultValue="Merriweather">
          <FontPickerTrigger size={size} />
          <FontPickerContent />
        </FontPicker>
      ))}
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <FontStackPicker key={`stack-${size}`} aria-label={`Stack, ${size}`} defaultValue={['Inter', 'Roboto']}>
          <FontStackPickerInputGroup size={size} />
          <FontStackPickerContent />
        </FontStackPicker>
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-3">
      <FontPicker aria-label="Headline font" defaultValue="Fraunces" disabled />
      <FontStackPicker aria-label="Text fonts" defaultValue={['Inter', 'Roboto']} disabled />
    </div>
  ),
};

export const Dark: Story = {
  parameters: { dark: true },
  render: () => <FontStackPicker aria-label="Text fonts" defaultValue={['Inter', 'Roboto']} defaultOpen />,
};

export const DarkPicker: Story = {
  name: 'Dark · one family',
  parameters: { dark: true },
  render: () => <FontPicker aria-label="Headline font" defaultValue="Fraunces" defaultOpen />,
};

/** In a form: each Field's label names its picker, the description describes it, and a required picker with nothing
    chosen shows the Field's error (submit the empty form to see it). */
export const InAField: Story = {
  render: () => (
    <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
      <Field>
        <FieldLabel>Headline font</FieldLabel>
        <FontPicker name="headline" defaultValue="Fraunces" />
        <FieldDescription>Used for titles and large numbers.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Text fonts</FieldLabel>
        <FontStackPicker name="text" required />
        <FieldError>Choose at least one font.</FieldError>
      </Field>
    </form>
  ),
};
