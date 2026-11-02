import { useState } from 'react';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { Icon } from '@/lib/icon';
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
import { PROJECT, type Thread } from '../lib/data';
import type { ThreadsState } from '../lib/use-threads';

/** A thread row's hover card: its project and age, where it stands, what was asked first, and the agent's latest
    work log (summary and the first steps) — enough to tell similar-sounding threads apart before switching. */
function ThreadCard({ thread }: { thread: Thread }) {
  const ask = thread.messages.find((m) => m.role === 'user');
  const work = [...thread.messages].reverse().find((m) => m.role === 'assistant');
  const running = thread.messages.some((m) => m.live);
  return (
    <>
      <HoverCardHeader
        media={<Icon name="bubble-left" size={20} sw={1.8} className="text-tertiary-foreground" />}
        title={thread.title}
        subtitle={`${PROJECT} · ${thread.age} ago · ${running ? 'Running' : thread.settled ? 'Settled' : 'Active'}`}
      />
      {ask ? (
        <p className="mt-3 mb-0 line-clamp-3 rounded-lg bg-secondary px-2.5 py-1.5 text-footnote leading-[1.4] text-foreground">{ask.text}</p>
      ) : (
        <p className="mt-3 mb-0 text-footnote text-tertiary-foreground">No messages yet</p>
      )}
      {work?.summary && (
        <div className="mt-2.5 text-footnote text-muted-foreground">
          <div className="font-semibold">{work.summary}{work.steps?.length ? ` · ${work.steps.length} steps` : ''}</div>
          {work.steps?.slice(0, 3).map((s) => (
            <div key={s.title} className="mt-1 flex items-center gap-1.5 truncate">
              <Icon name="checkmark" size={11} sw={2.4} className="shrink-0 text-success" />
              <span className="truncate">{s.title}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

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
      preview={<ThreadCard thread={t} />}
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
