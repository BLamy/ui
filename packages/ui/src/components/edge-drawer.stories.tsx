import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PillButton } from './pill-button';
import { EdgeDrawer } from './edge-drawer';
import { Phone } from '../stories/frame';

const meta: Meta<typeof EdgeDrawer> = {
  title: 'Molecules/EdgeDrawer',
  component: EdgeDrawer,
};
export default meta;
type Story = StoryObj<typeof EdgeDrawer>;

const panel = (label: string) => (
  <div style={{ height: '100%', padding: 18, boxSizing: 'border-box', background: 'var(--tk-card)', color: 'var(--tk-label)' }}>
    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{label}</div>
    <div style={{ fontSize: 14, color: 'var(--tk-label2)', lineHeight: 1.5 }}>Headless: the children are the whole panel. Tap the scrim to close.</div>
  </div>
);

function Demo({ side }: { side: 'left' | 'right' }) {
  const [open, setOpen] = useState(true);
  return (
    <Phone w={640} h={460}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <PillButton label={`Open ${side} drawer`} onPress={() => setOpen(true)} style={{ width: 200 }} />
      </div>
      <EdgeDrawer side={side} open={open} onClose={() => setOpen(false)} width={280} maxWidth="84%">
        {panel(side === 'left' ? 'Navigation' : 'Inspector')}
      </EdgeDrawer>
    </Phone>
  );
}

export const Left: Story = { render: () => <Demo side="left" /> };
export const Right: Story = { render: () => <Demo side="right" /> };
