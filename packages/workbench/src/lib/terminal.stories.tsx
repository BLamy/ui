import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TerminalDock, TermHeader, TermBody } from './terminal';
import { WorkbenchTheme } from './theme';
import { TERM_SEED } from '../demos/workbench-demo';
import '../styles.css';

const meta: Meta<typeof TerminalDock> = {
  title: 'Organisms/TerminalDock',
  component: TerminalDock,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof TerminalDock>;

function DockDemo() {
  const [h, setH] = useState(190);
  return (
    <WorkbenchTheme style={{ height: 480, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', color: 'var(--wb-label3)', fontSize: 13 }}>
        editor area — drag the dock's top edge to resize
      </div>
      <TerminalDock h={h} setH={setH} seed={TERM_SEED} onClose={() => {}} />
    </WorkbenchTheme>
  );
}
export const Dock: Story = { render: () => <DockDemo /> };

export const HeaderAndBody: Story = {
  render: () => (
    <WorkbenchTheme style={{ minHeight: 420, padding: 24, display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: 300, width: 520, borderRadius: 12, overflow: 'hidden', background: '#0C0C10', border: '1px solid var(--wb-sep)' }}>
        <TermHeader onClose={() => {}} />
        <TermBody seed={[{ t: 'help', p: true }, { t: 'available: ls, pwd, echo, whoami, npm run dev, clear' }]} />
      </div>
    </WorkbenchTheme>
  ),
};
