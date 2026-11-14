import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from '@/components/ui/tab-bar';
import { Phone } from '../stories/frame';

const meta: Meta<typeof TabBar> = {
  title: 'Molecules/TabBar',
  component: TabBar,
  decorators: [(Story) => <Phone w={390} h={300}><Story /></Phone>],
};
export default meta;
type Story = StoryObj<typeof TabBar>;

const items = [
  { value: 'contacts', title: 'Contacts', icon: 'person' },
  { value: 'recents', title: 'Recents', icon: 'clock' },
  { value: 'settings', title: 'Settings', icon: 'sliders' },
];

export const Interactive: Story = {
  render: () => {
    const [tab, setTab] = useState('contacts');
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--muted-foreground)' }}>
          Selected: {tab}
        </div>
        <TabBar items={items} value={tab} onValueChange={setTab} />
      </>
    );
  },
};

export const TwoTabs: Story = {
  render: () => {
    const [tab, setTab] = useState('contacts');
    return <TabBar items={items.slice(0, 2)} value={tab} onValueChange={setTab} />;
  },
};
