import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IndexBar } from './index-bar';
import { Phone } from '../stories/frame';

const meta: Meta<typeof IndexBar> = {
  title: 'Molecules/IndexBar',
  component: IndexBar,
  decorators: [(Story) => <Phone w={390} h={560}><Story /></Phone>],
};
export default meta;
type Story = StoryObj<typeof IndexBar>;

function AlphaExample() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--tk-label2)' }}>
        {last ? 'Jumped to ' + last : 'Drag the rail →'}
      </div>
      <IndexBar avail={new Set(['A', 'B', 'C', 'H', 'K', 'S', 'W', 'Z'])} onLetter={setLast} top={12} bottom={12} />
    </>
  );
}

export const AlphaAZ: Story = {
  render: () => <AlphaExample />,
};

function CustomItemsExample() {
  const [last, setLast] = useState<string | null>(null);
  const items = [
    { key: 'm1', label: '', caption: 'Question', preview: 'Why is the build slow on CI but not locally?' },
    { key: 'm2', label: '', caption: 'Decision', preview: 'We will ship the haptics engine behind a flag.' },
    { key: 'm3', label: '●', caption: 'Pinned', preview: 'Design review moved to Thursday 2pm.' },
    { key: 'm4', label: '', preview: 'Can someone rerun the flaky index-bar test?' },
    { key: 'm5', label: '', dim: true, preview: 'Archived: old branch cleanup thread.' },
  ];
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--tk-label2)' }}>
        {last ? 'Jumped to ' + last : 'Hover, drag, or use arrow keys →'}
      </div>
      <IndexBar items={items} onJump={(key) => setLast(key)} top={40} bottom={40} label="Jump to conversation event" />
    </>
  );
}

export const CustomItemsWithPreviews: Story = {
  render: () => <CustomItemsExample />,
};
