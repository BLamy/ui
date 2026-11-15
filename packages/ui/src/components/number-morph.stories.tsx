import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { NumberMorph } from '@/components/ui/number-morph';
import { Pad } from '../stories/frame';

const meta: Meta<typeof NumberMorph> = {
  title: 'Atoms/NumberMorph',
  component: NumberMorph,
  args: { value: 1234.5 },
  decorators: [(Story, { parameters }) => <Pad w={420} appearance={parameters.dark ? 'dark' : 'light'}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof NumberMorph>;

function Roll({ format, locale, start = 1234.5 }: { format?: Intl.NumberFormatOptions; locale?: string; start?: number }) {
  const [v, setV] = useState(start);
  return (
    <div className="flex flex-col items-start gap-4">
      <div className="text-[40px] font-bold tracking-tight"><NumberMorph value={v} format={format} locale={locale} /></div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setV((x) => x * 10 + 7)}>×10 + 7</Button>
        <Button size="sm" variant="secondary" onClick={() => setV((x) => Math.floor(x / 10))}>÷10</Button>
        <Button size="sm" variant="secondary" onClick={() => setV((x) => x + 1)}>+1</Button>
        <Button size="sm" variant="secondary" onClick={() => setV((x) => -x)}>±</Button>
      </div>
    </div>
  );
}

/** Digits roll by place (up when rising, down when falling); separators slide as digits arrive. */
export const Currency: Story = { render: () => <Roll format={{ style: 'currency', currency: 'USD' }} /> };
/** A negative value and a minus sign that scales in and out. */
export const Negative: Story = { render: () => <Roll start={-42} /> };
/** Compact notation: 1.2K → 12K → 123K. */
export const Compact: Story = { render: () => <Roll format={{ notation: 'compact' }} start={1234} /> };
/** Another locale: German grouping and decimal separators. */
export const Locale: Story = { render: () => <Roll locale="de-DE" format={{ style: 'currency', currency: 'EUR' }} /> };
export const Dark: Story = { parameters: { dark: true }, render: () => <Roll format={{ style: 'currency', currency: 'USD' }} /> };
