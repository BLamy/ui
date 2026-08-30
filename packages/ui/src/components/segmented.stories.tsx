import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Segmented } from './segmented';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Segmented> = {
  title: 'Atoms/Segmented',
  component: Segmented,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Segmented>;

function Demo({ options }: { options: { id: string; label: string }[] }) {
  const [v, setV] = useState(options[0].id);
  return <Segmented options={options} value={v} onChange={setV} aria-label="Demo segmented" />;
}

export const TwoOptions: Story = {
  render: () => <Demo options={[{ id: 'plain', label: 'Plain' }, { id: 'grouped', label: 'Grouped' }]} />,
};

export const ThreeOptions: Story = {
  render: () => <Demo options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }]} />,
};
