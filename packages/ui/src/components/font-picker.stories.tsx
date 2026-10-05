import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FontList, FontPicker, FontStackPicker } from '@/components/ui/font-picker';
import { fontStack, useGoogleFont } from '@/lib/google-fonts';
import { Caption, Panel } from '../stories/primitive-frame';

const meta: Meta<typeof FontPicker> = {
  title: 'Molecules/FontPicker',
  component: FontPicker,
  decorators: [(Story) => <Panel w={360}><div className="h-[460px]"><Story /></div></Panel>],
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
      <FontPicker aria-label="Headline font" value={font} onChange={setFont} onPreview={setPreview} />
      <p className="m-0 text-[28px] leading-tight font-bold" style={{ fontFamily: fontStack(shown) }}>Grow something green</p>
      <Caption>Hover the list: the headline wears each family until you leave it.</Caption>
    </div>
  );
}

export const Default: Story = { render: () => <Previewing /> };

export const List: Story = {
  render: function Render() {
    const [font, setFont] = useState<string | null>('Inter');
    return <FontList value={font} onChange={setFont} className="overflow-hidden rounded-card bg-card shadow-hairline" />;
  },
};

export const Stack: Story = {
  name: 'Font stack',
  render: function Render() {
    const [stack, setStack] = useState<string[]>(['Inter', 'Roboto']);
    return (
      <div className="grid gap-3">
        <FontStackPicker aria-label="Text fonts" value={stack} onChange={setStack} />
        <Caption>{fontStack(stack) ?? 'The system font'}</Caption>
      </div>
    );
  },
};

export const MonospaceStack: Story = {
  name: 'Monospace stack',
  render: function Render() {
    const [stack, setStack] = useState<string[]>([]);
    return <FontStackPicker aria-label="Code fonts" value={stack} onChange={setStack} defaultCategory="monospace" placeholder="System monospace" />;
  },
};
