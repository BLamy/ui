import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Segmented> = {
  title: 'Atoms/Segmented',
  component: Segmented,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Segmented>;

function Demo({ options, disabled }: { options: { value: string; label: string; disabled?: boolean }[]; disabled?: boolean }) {
  const [value, setValue] = useState<string | null>(options[0].value);
  return (
    <Segmented value={value} onValueChange={setValue} disabled={disabled} aria-label="Demo segmented">
      {options.map((option) => (
        <SegmentedItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SegmentedItem>
      ))}
    </Segmented>
  );
}

export const TwoOptions: Story = {
  render: () => <Demo options={[{ value: 'plain', label: 'Plain' }, { value: 'grouped', label: 'Grouped' }]} />,
};

export const ThreeOptions: Story = {
  render: () => <Demo options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />,
};

/** A disabled segment is skipped by the arrow keys; a disabled control dims as a whole. */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Demo options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }, { value: 'lifetime', label: 'Lifetime', disabled: true }]} />
      <Demo disabled options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
    </div>
  ),
};
