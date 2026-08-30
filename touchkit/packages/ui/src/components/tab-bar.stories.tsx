import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TabBar } from './tab-bar';
import { Phone } from '../stories/frame';

const meta: Meta<typeof TabBar> = {
  title: 'Molecules/TabBar',
  component: TabBar,
  decorators: [(Story) => <Phone w={390} h={300}><Story /></Phone>],
};
export default meta;
type Story = StoryObj<typeof TabBar>;

const items = [
  { id: 'contacts', title: 'Contacts', icon: 'person' },
  { id: 'recents', title: 'Recents', icon: 'clock' },
  { id: 'settings', title: 'Settings', icon: 'sliders' },
];

export const Interactive: Story = {
  render: () => {
    const [tab, setTab] = useState('contacts');
    return (
      <>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 15, color: 'var(--tk-label2)' }}>
          Selected: {tab}
        </div>
        <TabBar items={items} selected={tab} onSelect={setTab} />
      </>
    );
  },
};

export const TwoTabs: Story = {
  render: () => {
    const [tab, setTab] = useState('contacts');
    return <TabBar items={items.slice(0, 2)} selected={tab} onSelect={setTab} />;
  },
};
