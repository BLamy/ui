import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  WorkbenchShell,
  WorkbenchSidebar,
  WorkbenchSidebarTrigger,
  WorkbenchSidebarClose,
  WorkbenchMain,
  WorkbenchHeader,
  WorkbenchTitle,
  WorkbenchActions,
  WorkbenchAction,
  WorkbenchDock,
  WorkbenchDockTrigger,
  WorkbenchDockClose,
  WorkbenchPanel,
  WorkbenchPanelTrigger,
  WorkbenchPanelHeader,
  WorkbenchPanelTitle,
  WorkbenchPanelFullscreen,
  WorkbenchPanelClose,
  WorkbenchTabBar,
  WorkbenchTab,
} from './workbench-shell';
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
} from '../components/workbench/thread-sidebar';
import {
  Conversation,
  ConversationEmpty,
  ConversationGreeting,
  ConversationMessages,
  ConversationComposer,
  ConversationSuggestions,
  Suggestion,
  UserMessage,
  AssistantMessage,
  MessageMarkdown,
  WorkLog,
  ToolCall,
  SettledBanner,
} from '../components/workbench/chat';
import { WorkbenchComposer } from '../components/workbench/workbench-composer';
import { TerminalHeader, TerminalBody, TerminalAction } from '../components/workbench/terminal';
import {
  SURFACES,
  SurfacePicker,
  SurfaceBrowser,
  SurfaceAppPreview,
  SurfaceFiles,
  SurfaceDiff,
  SurfaceAgents,
  SurfaceTerminal,
  type SurfaceKind,
} from '../components/workbench/surfaces';
import { IconBtn } from '../lib/workbench/icons';
import { AGENTS, DIFF, FILES, SUGGESTIONS, TERMINAL_SEED, THREADS, type Thread } from '../components/workbench/fixtures';
import '../styles.css';

const meta: Meta = {
  title: 'Templates/WorkbenchShell',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

/* The full composition, static (no agent): each frame width exercises one width class —
   regular (≥1120) · medium (760–1119, right-edge drawer) · compact (<760, tab bar + snap-sheet dock). */
function ShellDemo({
  width,
  height,
  terminal,
  surface = null,
  thread: initialThread = 't1',
  panel,
  full,
}: {
  width: number | string;
  height: number;
  terminal?: boolean;
  surface?: SurfaceKind | null;
  thread?: string | null;
  panel?: boolean;
  full?: boolean;
}) {
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const [cur, setCur] = useState<string | null>(initialThread);
  const [kind, setKind] = useState<SurfaceKind | null>(surface);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const thread = threads.find((t) => t.id === cur) ?? null;
  const settled = threads.filter((t) => t.settled && t.title.includes(query));
  const shown = showAll ? settled : settled.slice(0, 7);
  const surfaceMeta = SURFACES.find((s) => s.k === kind);
  const item = (t: Thread) => (
    <ThreadItem key={t.id} active={t.id === cur} meta={t.age} onPress={() => setCur(t.id)}>
      {t.title}
    </ThreadItem>
  );
  return (
    <div style={{ width, height, margin: '0 auto', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
      <WorkbenchShell defaultDockOpen={terminal} defaultPanelOpen={panel} defaultPanelFullscreen={full}>
        <WorkbenchSidebar>
          <ThreadSidebar>
            <ThreadSidebarHeader>
              <ThreadSidebarBrand>Workbench</ThreadSidebarBrand>
              <WorkbenchSidebarClose />
            </ThreadSidebarHeader>
            <ThreadSidebarToolbar>
              <ThreadSearch value={query} onChange={setQuery} />
              <ThreadNewButton onPress={() => setCur(null)} />
            </ThreadSidebarToolbar>
            <ProjectSwitcher />
            <ThreadList>
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
        </WorkbenchSidebar>

        <WorkbenchMain>
          <WorkbenchHeader>
            <WorkbenchSidebarTrigger />
            <WorkbenchTitle project="cookbook">{thread ? thread.title : 'new thread'}</WorkbenchTitle>
            <WorkbenchActions>
              <WorkbenchAction icon="plus" label="New thread" onPress={() => setCur(null)} />
              <WorkbenchDockTrigger />
              <WorkbenchPanelTrigger />
            </WorkbenchActions>
          </WorkbenchHeader>
          <Conversation empty={!thread}>
            <ConversationEmpty>
              <ConversationGreeting title="What are we building?" description="Start a thread — ask anything about this workspace." />
            </ConversationEmpty>
            <ConversationMessages threadKey={thread?.id}>
              {thread?.messages.map((m) =>
                m.role === 'user' ? (
                  <UserMessage key={m.id}>{m.text}</UserMessage>
                ) : (
                  <AssistantMessage key={m.id}>
                    {m.summary ? <WorkLog summary={m.summary}>{m.steps?.map((s, i) => <ToolCall key={i} {...s} />)}</WorkLog> : null}
                    <MessageMarkdown markdown={m.text} />
                  </AssistantMessage>
                ),
              )}
            </ConversationMessages>
            <ConversationComposer>
              {thread?.settled ? (
                <SettledBanner onUnsettle={() => setThreads((ts) => ts.map((t) => (t.id === thread.id ? { ...t, settled: false } : t)))} />
              ) : null}
              <WorkbenchComposer onSubmit={() => {}} autoFocus={!thread} />
            </ConversationComposer>
            <ConversationSuggestions>
              {SUGGESTIONS.map((s) => (
                <Suggestion key={s}>{s}</Suggestion>
              ))}
            </ConversationSuggestions>
          </Conversation>
          <WorkbenchDock>
            <TerminalHeader title="zsh — cookbook">
              <TerminalAction icon="rectangle-split" label="Split terminal" />
              <TerminalAction icon="plus" label="New terminal" />
              <WorkbenchDockClose />
            </TerminalHeader>
            <TerminalBody seed={TERMINAL_SEED} />
          </WorkbenchDock>
        </WorkbenchMain>

        <WorkbenchPanel>
          <WorkbenchPanelHeader>
            <WorkbenchPanelTitle icon={surfaceMeta?.icon}>{surfaceMeta?.name ?? 'Surfaces'}</WorkbenchPanelTitle>
            {surfaceMeta ? <IconBtn name="chevron-down-wide" label="Switch surface" size={15} onPress={() => setKind(null)} /> : null}
            <WorkbenchPanelFullscreen />
            <WorkbenchPanelClose />
          </WorkbenchPanelHeader>
          {kind === 'browser' ? (
            <SurfaceBrowser url="http://localhost:3000">
              <SurfaceAppPreview name="app-builder" detail="serving on :3000 · pid 5229" />
            </SurfaceBrowser>
          ) : kind === 'terminal' ? (
            <SurfaceTerminal>
              <TerminalBody />
            </SurfaceTerminal>
          ) : kind === 'files' ? (
            <SurfaceFiles paths={FILES} selected={['cookbook/src/App.tsx']} />
          ) : kind === 'diff' ? (
            <SurfaceDiff oldFile={DIFF.before} newFile={DIFF.after} />
          ) : kind === 'agents' ? (
            <SurfaceAgents agents={AGENTS} />
          ) : (
            <SurfacePicker onPick={setKind} />
          )}
        </WorkbenchPanel>

        <WorkbenchTabBar value={kind} onValueChange={(k) => setKind(k as SurfaceKind)}>
          <WorkbenchTab id="chat" icon="bubble-left">
            Chat
          </WorkbenchTab>
          {SURFACES.map((s) => (
            <WorkbenchTab key={s.k} id={s.k} icon={s.icon}>
              {s.name}
            </WorkbenchTab>
          ))}
        </WorkbenchTabBar>
      </WorkbenchShell>
    </div>
  );
}

/* regular width — sidebar column, inline terminal dock (auto-open), right panel column */
export const Desktop: Story = { render: () => <ShellDemo width={1280} height={720} /> };
/* regular width with the terminal dock closed */
export const DesktopDockClosed: Story = { render: () => <ShellDemo width={1280} height={720} terminal={false} /> };
/* regular width, empty thread — centered "What are we building?" composer */
export const DesktopEmptyThread: Story = { render: () => <ShellDemo width={1280} height={720} thread={null} terminal={false} /> };
/* regular width, browser surface open in the right panel column */
export const DesktopBrowserSurface: Story = { render: () => <ShellDemo width={1280} height={720} surface="browser" /> };
/* regular width, panel expanded to explicit full-screen mode */
export const DesktopPanelFullscreen: Story = { render: () => <ShellDemo width={1280} height={720} surface="browser" panel full /> };
/* medium width — panel presented as a right-edge overlay drawer (closed by default) */
export const Medium: Story = { render: () => <ShellDemo width={900} height={680} /> };
/* medium width with the right-edge drawer slid open over a scrim */
export const MediumPanelDrawer: Story = { render: () => <ShellDemo width={900} height={680} surface="files" panel /> };
/* compact width — hamburger sidebar sheet, bottom tab bar */
export const Compact: Story = { render: () => <ShellDemo width={390} height={720} /> };
/* compact width with the terminal presented as a vaul-style snap drawer */
export const CompactDockSheet: Story = { render: () => <ShellDemo width={390} height={720} terminal /> };
/* compact width with a surface open full-screen behind the tab bar */
export const CompactSurfacePage: Story = { render: () => <ShellDemo width={390} height={720} surface="agents" panel /> };

/* Parts are optional: leave one out and its region is gone. Sidebar + conversation only. */
function ChatOnlyDemo() {
  const t = THREADS[1];
  return (
    <div style={{ width: 980, height: 600, margin: '0 auto', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
      <WorkbenchShell>
        <WorkbenchSidebar width={220}>
          <ThreadSidebar>
            <ThreadSidebarHeader>
              <ThreadSidebarBrand>Assistant</ThreadSidebarBrand>
              <WorkbenchSidebarClose />
            </ThreadSidebarHeader>
            <ThreadList>
              <ThreadGroup label="Recent">
                {THREADS.slice(0, 5).map((x) => (
                  <ThreadItem key={x.id} active={x.id === t.id} status={x.id === 't3' ? 'unread' : 'idle'}>
                    {x.title}
                  </ThreadItem>
                ))}
              </ThreadGroup>
            </ThreadList>
          </ThreadSidebar>
        </WorkbenchSidebar>
        <WorkbenchMain>
          <WorkbenchHeader>
            <WorkbenchSidebarTrigger />
            <WorkbenchTitle>{t.title}</WorkbenchTitle>
          </WorkbenchHeader>
          <Conversation>
            <ConversationMessages threadKey={t.id}>
              {t.messages.map((m) =>
                m.role === 'user' ? (
                  <UserMessage key={m.id}>{m.text}</UserMessage>
                ) : (
                  <AssistantMessage key={m.id}>
                    <MessageMarkdown markdown={m.text} />
                  </AssistantMessage>
                ),
              )}
            </ConversationMessages>
            <ConversationComposer>
              <WorkbenchComposer options={false} checkout={false} onSubmit={() => {}} />
            </ConversationComposer>
          </Conversation>
        </WorkbenchMain>
      </WorkbenchShell>
    </div>
  );
}
export const ChatOnly: Story = { render: () => <ChatOnlyDemo /> };

/* No sidebar: a conversation beside a diff inspector, in light. */
export const ChatWithInspector: Story = {
  render: () => (
    <div style={{ width: 1200, height: 600, margin: '0 auto', overflow: 'hidden' }}>
      <WorkbenchShell appearance="light">
        <WorkbenchMain>
          <WorkbenchHeader>
            <WorkbenchTitle project="cookbook">haptics boot order</WorkbenchTitle>
            <WorkbenchActions>
              <WorkbenchPanelTrigger />
            </WorkbenchActions>
          </WorkbenchHeader>
          <Conversation>
            <ConversationMessages threadKey="inspect">
              <UserMessage key="u">Fix the boot order so the shim installs before the first tap.</UserMessage>
              <AssistantMessage key="a">
                <WorkLog summary="Worked for 42s" defaultOpen>
                  {THREADS[1].messages[1].steps?.map((s, i) => <ToolCall key={i} {...s} />)}
                </WorkLog>
                <MessageMarkdown markdown="Done — the change is in the inspector." />
              </AssistantMessage>
            </ConversationMessages>
            <ConversationComposer>
              <WorkbenchComposer checkout={false} onSubmit={() => {}} />
            </ConversationComposer>
          </Conversation>
        </WorkbenchMain>
        <WorkbenchPanel>
          <WorkbenchPanelHeader>
            <WorkbenchPanelTitle icon="doc-text">Changes</WorkbenchPanelTitle>
            <WorkbenchPanelFullscreen />
            <WorkbenchPanelClose />
          </WorkbenchPanelHeader>
          <SurfaceDiff oldFile={DIFF.before} newFile={DIFF.after} />
        </WorkbenchPanel>
      </WorkbenchShell>
    </div>
  ),
};
