import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThreadSidebar } from './thread-sidebar';
import { WorkbenchTheme } from './theme';
import { SEED_THREADS } from '../demos/workbench-demo';
import '../styles.css';

const meta: Meta<typeof ThreadSidebar> = {
  title: 'Organisms/ThreadSidebar',
  component: ThreadSidebar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <WorkbenchTheme style={{ minHeight: 640, padding: 24, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 242, height: 560, border: '1px solid var(--wb-sep)', borderRadius: 12, overflow: 'hidden' }}>
          <Story />
        </div>
      </WorkbenchTheme>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ThreadSidebar>;

function SidebarDemo({ compact }: { compact?: boolean }) {
  const [cur, setCur] = useState<string | null>('t1');
  const threads = [{ id: 'now', title: 'streaming right now', age: 'now', settled: false, msgs: [] }, ...SEED_THREADS];
  return <ThreadSidebar threads={threads} cur={cur} compact={compact} onSelect={setCur} onNew={() => setCur(null)} onClose={() => {}} />;
}

export const Default: Story = { render: () => <SidebarDemo /> };
export const Compact: Story = { render: () => <SidebarDemo compact /> };
