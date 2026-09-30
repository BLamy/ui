import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { SideDrawer } from '@/components/ui/side-drawer';
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
      <div key={i} style={{ padding: '10px 2px', fontSize: 14, boxShadow: i < 3 ? 'inset 0 -1px 0 var(--border)' : 'none' }}>{t}</div>
    ))}
    <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--tertiary-foreground, color-mix(in oklab, var(--muted-foreground) 60%, transparent))', lineHeight: 1.5 }}>
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
          <div style={{ flex: 1, position: 'relative', background: 'var(--muted)', display: 'grid', placeItems: 'center', minWidth: 0 }}>
            <Button size="pill" onPress={() => setOpen((v) => !v)} className="w-[180px]">{open ? 'Close drawer' : 'Open drawer'}</Button>
          </div>
          <SideDrawer mode="fixed" open={open} onClose={() => setOpen(false)} title="Activity" width={318}>
            {content}
          </SideDrawer>
        </div>
      </Phone>
    );
  },
};

/* ── Compact: the overlay as a pushed page ──
   Below `compactBreakpoint` (520px) the overlay takes the whole host and is pushed like a NavigationStack screen:
   the page before it parallaxes and dims, the bar has a back button, and an edge swipe pops it. */
function CompactPage({ onOpen }: { onOpen: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, padding: '64px 20px 20px', background: 'var(--background)', color: 'var(--foreground)' }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>Maya Lindqvist</div>
      <div style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: '6px 0 22px' }}>Product design · Stockholm</div>
      <Button size="pill" onPress={onOpen} className="w-[180px]">Show activity</Button>
    </div>
  );
}

function CompactStory({ initial, dark }: { initial: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <Phone w={390} h={720} dark={dark}>
      <CompactPage onOpen={() => setOpen(true)} />
      <SideDrawer mode="overlay" open={open} onClose={() => setOpen(false)} title="Activity" backLabel="Maya">
        {content}
      </SideDrawer>
    </Phone>
  );
}

/** A phone-width host: the drawer is a pushed page with a back button (tap it, press Esc, or swipe from the left
    edge to pop it). */
export const CompactPush: Story = { render: () => <CompactStory initial /> };

export const CompactPushDark: Story = { render: () => <CompactStory initial dark /> };

/** Closed: tap "Show activity" to push it; the page slides left under a dim, exactly as NavigationStack pushes. */
export const CompactPushClosed: Story = { render: () => <CompactStory initial={false} /> };

export const Overlay: Story = {
  render: function OverlayStory() {
    const [open, setOpen] = useState(true);
    return (
      <Phone w={640} h={520}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <Button size="pill" onPress={() => setOpen(true)} className="w-[180px]">Open overlay</Button>
        </div>
        <SideDrawer mode="overlay" open={open} onClose={() => setOpen(false)} title="Activity" width={340}>
          {content}
        </SideDrawer>
      </Phone>
    );
  },
};
