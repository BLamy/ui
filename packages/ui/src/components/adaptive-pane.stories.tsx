import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Segmented } from './segmented';
import { AdaptivePane, type AdaptivePaneMode } from './adaptive-pane';
import { Phone } from '../stories/frame';

const meta: Meta<typeof AdaptivePane> = {
  title: 'Organisms/AdaptivePane',
  component: AdaptivePane,
};
export default meta;
type Story = StoryObj<typeof AdaptivePane>;

const MODES: AdaptivePaneMode[] = ['column', 'drawer', 'cover', 'hidden'];

function Demo() {
  const [mode, setMode] = useState<AdaptivePaneMode>('column');
  const [open, setOpen] = useState(true);
  return (
    <Phone w={720} h={460}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <AdaptivePane
          mode={mode}
          open={open}
          onClose={() => setOpen(false)}
          columnWidth={220}
          drawerWidth={260}
          zIndex={20}
          columnStyle={{ borderRight: '1px solid var(--tk-sep)' }}
        >
          <div style={{ height: '100%', padding: 16, boxSizing: 'border-box', background: 'var(--tk-card)' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Pane</div>
            <div style={{ fontSize: 13, color: 'var(--tk-label2)' }}>Same children in every mode: {mode}</div>
            {mode === 'cover' ? <button onClick={() => setMode('column')} style={{ marginTop: 12 }}>Restore</button> : null}
          </div>
        </AdaptivePane>
        <div style={{ flex: 1, minWidth: 0, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Segmented options={MODES.map((m) => ({ id: m, label: m }))} value={mode} onChange={(v) => { setMode(v as AdaptivePaneMode); setOpen(true); }} />
          <div style={{ fontSize: 14, color: 'var(--tk-label2)', lineHeight: 1.5 }}>The host picks the mode from its width; this story lets you pick it directly.</div>
        </div>
      </div>
    </Phone>
  );
}

export const Modes: Story = { render: () => <Demo /> };
