import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ThreadSidebar,
  ThreadSidebarHeader,
  ThreadSidebarBrand,
  ThreadSidebarToolbar,
  ThreadSearch,
  ThreadNewButton,
  ProjectSwitcher,
  ThreadList,
  ThreadGroup,
  ThreadItem,
  ThreadShowMore,
  ThreadSidebarFooter,
  SidebarNotice,
  SidebarFooterItem,
  SidebarUser,
  type ThreadStatus,
} from './components/thread-sidebar';
import { IconButton } from '@/components/ui/icon-button';
import { WorkbenchTheme } from '@/components/ui/workbench-theme';
import { THREADS } from './lib/data';

const meta: Meta<typeof ThreadSidebar> = {
  title: 'Organisms/ThreadSidebar',
  component: ThreadSidebar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <WorkbenchTheme style={{ minHeight: 640, padding: 24, display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 242, height: 560, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <Story />
        </div>
      </WorkbenchTheme>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ThreadSidebar>;

/* The t3-clone block's sidebar parts (components/thread-sidebar.tsx), composed the way its AppSidebar does: search filters, Settled folds, "Show more" expands. */
function SidebarDemo({ compact }: { compact?: boolean }) {
  const [cur, setCur] = useState<string | null>('t1');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const threads = [{ id: 'now', title: 'streaming right now', age: 'now', settled: false }, ...THREADS];
  const match = threads.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()));
  const active = match.filter((t) => !t.settled);
  const settled = match.filter((t) => t.settled);
  const shown = showAll ? settled : settled.slice(0, 7);
  const item = (t: (typeof threads)[number]) => (
    <ThreadItem key={t.id} active={cur === t.id} meta={t.age} onPress={() => setCur(t.id)}>
      {t.title}
    </ThreadItem>
  );
  return (
    <ThreadSidebar>
      <ThreadSidebarHeader>
        <ThreadSidebarBrand>Workbench</ThreadSidebarBrand>
        {compact ? <IconButton name="xmark-large" label="Close sidebar" className="ml-auto" /> : null}
      </ThreadSidebarHeader>
      <ThreadSidebarToolbar>
        <ThreadSearch value={query} onChange={setQuery} />
        <ThreadNewButton onPress={() => setCur(null)} />
      </ThreadSidebarToolbar>
      <ProjectSwitcher />
      <ThreadList>
        {active.length ? <ThreadGroup label="Active">{active.map(item)}</ThreadGroup> : null}
        <ThreadGroup label="Settled" collapsible>
          {shown.map(item)}
          {settled.length > shown.length ? <ThreadShowMore count={settled.length - shown.length} onPress={() => setShowAll(true)} /> : null}
        </ThreadGroup>
      </ThreadList>
      <ThreadSidebarFooter>
        <SidebarNotice onDismiss={() => {}}>Update available</SidebarNotice>
        <SidebarFooterItem icon="gearshape">Settings</SidebarFooterItem>
      </ThreadSidebarFooter>
    </ThreadSidebar>
  );
}

export const Default: Story = { render: () => <SidebarDemo /> };
export const Compact: Story = { render: () => <SidebarDemo compact /> };

/* ThreadItem statuses: running (pulsing dot), unread (bold + dot), error, idle — plus the user footer. */
const STATUSES: [string, ThreadStatus, string][] = [
  ['deploy preview to staging', 'running', 'now'],
  ['review the auth refactor', 'unread', '3m'],
  ['migrate the billing tables', 'error', '1h'],
  ['write release notes', 'idle', '2d'],
];
export const Statuses: Story = {
  render: () => (
    <ThreadSidebar>
      <ThreadSidebarHeader>
        <ThreadSidebarBrand>Agents</ThreadSidebarBrand>
      </ThreadSidebarHeader>
      <ProjectSwitcher>acme/web</ProjectSwitcher>
      <ThreadList>
        <ThreadGroup label="Today">
          {STATUSES.map(([title, status, age], i) => (
            <ThreadItem key={title} status={status} meta={age} active={i === 1}>
              {title}
            </ThreadItem>
          ))}
        </ThreadGroup>
      </ThreadList>
      <ThreadSidebarFooter>
        <SidebarUser name="Ada Lovelace" detail="Pro plan" />
      </ThreadSidebarFooter>
    </ThreadSidebar>
  ),
};
