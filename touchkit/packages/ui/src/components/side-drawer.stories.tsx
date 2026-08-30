import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PillButton } from './pill-button';
import { SideDrawer } from './side-drawer';
import { Phone } from '../stories/frame';

const meta: Meta<typeof SideDrawer> = {
  title: 'Organisms/SideDrawer',
  component: SideDrawer,
};
export default meta;
type Story = StoryObj<typeof SideDrawer>;

const content = (
  <div style={{ padding: '4px 14px 18px' }}>
    {['Outgoing call · 2 min', 'iMessage · "see you at 6"', 'FaceTime · 12 min', 'Mail · Re: schedule'].map((t, i) => (
      <div key={i} style={{ padding: '10px 2px', fontSize: 14, boxShadow: i < 3 ? 'inset 0 -1px 0 var(--tk-sep)' : 'none' }}>{t}</div>
    ))}
    <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--tk-label3)', lineHeight: 1.5 }}>
      Same panel, three hosts — fixed column, overlay sheet, or pushed page.
    </div>
  </div>
);

export const Fixed: Story = {
  render: function FixedStory() {
    const [open, setOpen] = useState(true);
    return (
      <Phone w={760} h={520}>
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, position: 'relative', background: 'var(--tk-bg2)', display: 'grid', placeItems: 'center', minWidth: 0 }}>
            <PillButton label={open ? 'Close drawer' : 'Open drawer'} onPress={() => setOpen((v) => !v)} style={{ width: 180 }} />
          </div>
          <SideDrawer mode="fixed" open={open} onClose={() => setOpen(false)} title="Activity" width={318}>
            {content}
          </SideDrawer>
        </div>
      </Phone>
    );
  },
};

export const Overlay: Story = {
  render: function OverlayStory() {
    const [open, setOpen] = useState(true);
    return (
      <Phone w={640} h={520}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <PillButton label="Open overlay" onPress={() => setOpen(true)} style={{ width: 180 }} />
        </div>
        <SideDrawer mode="overlay" open={open} onClose={() => setOpen(false)} title="Activity" width={340}>
          {content}
        </SideDrawer>
      </Phone>
    );
  },
};
