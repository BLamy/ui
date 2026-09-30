import { useState, type ReactNode } from 'react';
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
  useOptionalWorkbenchShell,
} from './workbench-shell';
import { SidebarContent, SidebarFooter, SidebarHeader, SidebarItem, SidebarSearch, SidebarSection, SidebarWorkspace } from '../components/sidebar';
import { Icon } from '../lib/icon';
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

/* The thread list, from the generic Sidebar parts (the t3-clone block has T3 Code's own thread sidebar). Picking
   a thread closes the compact drawer. */
function ThreadNav({
  brand,
  detail,
  threads,
  current,
  onPick,
  label = 'Threads',
  search,
  children,
}: {
  brand: string;
  detail?: string;
  threads: Thread[];
  current?: string | null;
  onPick?: (id: string) => void;
  label?: string;
  /** a search field under the brand */
  search?: boolean;
  /** the footer */
  children?: ReactNode;
}) {
  const shell = useOptionalWorkbenchShell();
  return (
    <nav aria-label="Threads" className="flex h-full flex-col bg-sidebar">
      <SidebarHeader>
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <SidebarWorkspace name={brand} detail={detail} />
          </div>
          <WorkbenchSidebarClose />
        </div>
        {search ? <SidebarSearch placeholder="Search threads" /> : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection title={label}>
          {threads.map((t) => (
            <SidebarItem
              key={t.id}
              icon={<Icon name="bubble-left" size={15} sw={1.8} />}
              label={t.title}
              active={t.id === current}
              onPress={() => {
                onPick?.(t.id);
                if (shell?.compact) shell.setSidebarOpen(false);
              }}
            />
          ))}
        </SidebarSection>
      </SidebarContent>
      {children}
    </nav>
  );
}

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
  const thread = threads.find((t) => t.id === cur) ?? null;
  const surfaceMeta = SURFACES.find((s) => s.k === kind);
  return (
    <div className="border border-white/10" style={{ width, height, margin: '0 auto', overflow: 'hidden' }}>
      <WorkbenchShell defaultDockOpen={terminal} defaultPanelOpen={panel} defaultPanelFullscreen={full}>
        <WorkbenchSidebar>
          <ThreadNav brand="Workbench" detail="cookbook" threads={threads.filter((t) => t.settled).slice(0, 7)} current={cur} onPick={setCur} label="Settled" search>
            <SidebarFooter>
              <SidebarItem icon={<Icon name="gearshape" size={15} sw={1.8} />} label="Settings" />
            </SidebarFooter>
          </ThreadNav>
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
    <div className="border border-white/10" style={{ width: 980, height: 600, margin: '0 auto', overflow: 'hidden' }}>
      <WorkbenchShell>
        <WorkbenchSidebar width={220}>
          <ThreadNav brand="Assistant" threads={THREADS.slice(0, 5)} current={t.id} label="Recent" />
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
            <WorkbenchTitle project="cookbook">boot order</WorkbenchTitle>
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
