import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { EdgeDrawer } from '@/components/ui/edge-drawer';
import { Phone } from '../stories/frame';

const meta: Meta<typeof EdgeDrawer> = {
  title: 'Molecules/EdgeDrawer',
  component: EdgeDrawer,
};
export default meta;
type Story = StoryObj<typeof EdgeDrawer>;

const panel = (label: string) => (
  <div style={{ height: '100%', padding: 18, boxSizing: 'border-box', background: 'var(--card)', color: 'var(--foreground)' }}>
    <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>{label}</div>
    <div style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>Headless: the children are the whole panel. Tap the scrim to close.</div>
  </div>
);

function Demo({ side }: { side: 'left' | 'right' }) {
  const [open, setOpen] = useState(true);
  return (
    <Phone w={640} h={460}>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <Button size="pill" onPress={() => setOpen(true)} className="w-[200px]">{`Open ${side} drawer`}</Button>
      </div>
      <EdgeDrawer side={side} open={open} onClose={() => setOpen(false)} width={280} maxWidth="84%">
        {panel(side === 'left' ? 'Navigation' : 'Inspector')}
      </EdgeDrawer>
    </Phone>
  );
}

export const Left: Story = { render: () => <Demo side="left" /> };
export const Right: Story = { render: () => <Demo side="right" /> };
