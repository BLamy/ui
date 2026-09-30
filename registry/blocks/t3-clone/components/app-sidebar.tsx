import { useState } from 'react';
import { WorkbenchSidebarClose } from './workbench/workbench-shell';
import {
  ProjectSwitcher,
  SidebarFooterItem,
  SidebarNotice,
  ThreadGroup,
  ThreadItem,
  ThreadList,
  ThreadNewButton,
  ThreadSearch,
  ThreadShowMore,
  ThreadSidebar,
  ThreadSidebarBrand,
  ThreadSidebarFooter,
  ThreadSidebarHeader,
  ThreadSidebarToolbar,
} from './thread-sidebar';
import type { Thread } from '../lib/data';
import type { ThreadsState } from '../lib/use-threads';

/** Threads split into Active and Settled, with search and a "Show more" for the long tail. */
export function AppSidebar({ state }: { state: ThreadsState }) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState(true);
  const q = query.trim().toLowerCase();
  const matches = state.threads.filter((t) => t.title.toLowerCase().includes(q));
  const active = matches.filter((t) => !t.settled);
  const settled = matches.filter((t) => t.settled);
  const shown = showAll ? settled : settled.slice(0, 7);

  const item = (t: Thread) => (
    <ThreadItem
      key={t.id}
      active={t.id === state.current?.id}
      status={t.messages.some((m) => m.live) ? 'running' : 'idle'}
      meta={t.age}
      onPress={() => state.select(t.id)}
    >
      {t.title}
    </ThreadItem>
  );

  return (
    <ThreadSidebar>
      <ThreadSidebarHeader>
        <ThreadSidebarBrand>Workbench</ThreadSidebarBrand>
        <WorkbenchSidebarClose />
      </ThreadSidebarHeader>
      <ThreadSidebarToolbar>
        <ThreadSearch value={query} onChange={setQuery} />
        <ThreadNewButton onPress={state.newThread} />
      </ThreadSidebarToolbar>
      <ProjectSwitcher />
      <ThreadList>
        {active.length > 0 && <ThreadGroup label="Active">{active.map(item)}</ThreadGroup>}
        <ThreadGroup label="Settled" collapsible>
          {shown.map(item)}
          {settled.length > shown.length && <ThreadShowMore count={settled.length - shown.length} onPress={() => setShowAll(true)} />}
        </ThreadGroup>
      </ThreadList>
      <ThreadSidebarFooter>
        {notice && <SidebarNotice onDismiss={() => setNotice(false)}>Update available</SidebarNotice>}
        <SidebarFooterItem icon="gearshape">Settings</SidebarFooterItem>
      </ThreadSidebarFooter>
    </ThreadSidebar>
  );
}
