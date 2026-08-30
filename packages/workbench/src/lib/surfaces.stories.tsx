import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SurfacePanel, SurfaceTabBar, type SurfaceKind } from './surfaces';
import { WorkbenchTheme } from './theme';
import '../styles.css';

const meta: Meta<typeof SurfacePanel> = {
  title: 'Organisms/SurfacePanel',
  component: SurfacePanel,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof SurfacePanel>;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <WorkbenchTheme style={{ minHeight: 520, padding: 24, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 380, height: 460, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)' }}>{children}</div>
    </WorkbenchTheme>
  );
}

function PanelDemo({ initial }: { initial: SurfaceKind | null }) {
  const [kind, setKind] = useState<SurfaceKind | null>(initial);
  const [full, setFull] = useState(false);
  return <SurfacePanel kind={kind} onOpen={setKind} onClose={() => setKind(null)} full={full} onFull={setFull} />;
}

export const EmptyPicker: Story = { render: () => <Frame><PanelDemo initial={null} /></Frame> };
export const Browser: Story = { render: () => <Frame><PanelDemo initial="browser" /></Frame> };
export const Terminal: Story = { render: () => <Frame><PanelDemo initial="terminal" /></Frame> };
export const Files: Story = { render: () => <Frame><PanelDemo initial="files" /></Frame> };
export const Diff: Story = { render: () => <Frame><PanelDemo initial="diff" /></Frame> };
export const Agents: Story = { render: () => <Frame><PanelDemo initial="agents" /></Frame> };

/* fullscreen mode toggled on — the expand button becomes "restore" and highlights */
function FullDemo() {
  const [kind, setKind] = useState<SurfaceKind | null>('browser');
  const [full, setFull] = useState(true);
  return <SurfacePanel kind={kind} onOpen={setKind} onClose={() => setKind(null)} full={full} onFull={setFull} />;
}
export const Fullscreen: Story = { render: () => <Frame><FullDemo /></Frame> };

/* compact presentation — the fullscreen toggle is hidden; close returns to the Chat tab */
function CompactDemo() {
  const [kind, setKind] = useState<SurfaceKind | null>('diff');
  return <SurfacePanel kind={kind} compact onOpen={setKind} onClose={() => setKind(null)} />;
}
export const Compact: Story = { render: () => <Frame><CompactDemo /></Frame> };

function TabBarDemo() {
  const [active, setActive] = useState('chat');
  return (
    <WorkbenchTheme style={{ minHeight: 200, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 390, border: '1px solid var(--wb-sep)', borderRadius: 12, overflow: 'hidden' }}>
        <SurfaceTabBar active={active} onPick={setActive} />
      </div>
    </WorkbenchTheme>
  );
}
export const TabBar: Story = { render: () => <TabBarDemo /> };
