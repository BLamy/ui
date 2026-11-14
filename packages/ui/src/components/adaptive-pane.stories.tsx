import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { AdaptivePane, type AdaptivePanePresentation } from '@/components/ui/adaptive-pane';
import { Phone } from '../stories/frame';

const meta: Meta<typeof AdaptivePane> = {
  title: 'Organisms/AdaptivePane',
  component: AdaptivePane,
};
export default meta;
type Story = StoryObj<typeof AdaptivePane>;

const MODES: AdaptivePanePresentation[] = ['column', 'drawer', 'cover', 'hidden'];

function Demo() {
  const [mode, setMode] = useState<AdaptivePanePresentation>('column');
  const [open, setOpen] = useState(true);
  return (
    <Phone w={720} h={460}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <AdaptivePane
          presentation={mode}
          open={open}
          onOpenChange={setOpen}
          columnWidth={220}
          drawerWidth={260}
          zIndex={20}
          columnStyle={{ borderRight: '1px solid var(--border)' }}
        >
          <div style={{ height: '100%', padding: 16, boxSizing: 'border-box', background: 'var(--card)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Pane</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Same children in every presentation: {mode}</div>
            {mode === 'cover' ? <button onClick={() => setMode('column')} style={{ marginTop: 12 }}>Restore</button> : null}
          </div>
        </AdaptivePane>
        <div style={{ flex: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Segmented aria-label="Presentation" value={mode} onValueChange={(v) => { setMode(v as AdaptivePanePresentation); setOpen(true); }}>
            {MODES.map((m) => <SegmentedItem key={m} value={m}>{m}</SegmentedItem>)}
          </Segmented>
          <div style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>The host picks the presentation from its width; this story lets you pick it directly.</div>
        </div>
      </div>
    </Phone>
  );
}

export const Modes: Story = { render: () => <Demo /> };

/** The separator drags the width (arrows, Home and End too; Enter or a double-click resets); a drawer also swipes
 *  shut toward its edge and, with `swipeToOpen`, swipes open from the left edge. */
function ResizableDemo() {
  const [mode, setMode] = useState<AdaptivePanePresentation>('column');
  const [open, setOpen] = useState(true);
  return (
    <Phone w={720} h={460}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <AdaptivePane presentation={mode} open={open} onOpenChange={setOpen} swipeToOpen resizable
          columnWidth={220} drawerWidth={260} zIndex={20} columnStyle={{ borderRight: '1px solid var(--border)' }}>
          <div style={{ height: '100%', padding: 16, boxSizing: 'border-box', background: 'var(--card)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Pane</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Drag the edge to resize ({mode}).</div>
          </div>
        </AdaptivePane>
        <div style={{ flex: 1, minWidth: 0, padding: 20 }}>
          <Segmented aria-label="Presentation" value={mode} onValueChange={(v) => { setMode(v as AdaptivePanePresentation); setOpen(true); }}>
            {['column', 'drawer'].map((m) => <SegmentedItem key={m} value={m}>{m}</SegmentedItem>)}
          </Segmented>
        </div>
      </div>
    </Phone>
  );
}

export const Resizable: Story = { render: () => <ResizableDemo /> };
