import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkbenchShell, useWorkbenchShell } from './workbench-shell';
import { WBSidebarSlot, WBMainSlot, WBDockSlot, WBDockSheetSlot, WBPanelSlot, WBTabsSlot } from './slots';
import type { SurfaceKind } from './surfaces';
import type { WorkbenchThread } from './thread-sidebar';
import { SEED_THREADS, TERM_SEED } from '../demos/workbench-demo';
import '../styles.css';

const meta: Meta = {
  title: 'Templates/WorkbenchShell',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

/* Renders nothing — nudges shell state once on mount so a story can open the panel,
   enter fullscreen or switch the compact tab without user interaction. */
function ShellInit({ panel, full, tab }: { panel?: boolean; full?: boolean; tab?: string }) {
  const { setPanel, setFull, setTab } = useWorkbenchShell();
  useEffect(() => {
    if (panel != null) setPanel(panel);
    if (full != null) setFull(full);
    if (tab != null) setTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/* Static slot composition — the shell measures its own container, so each frame width
   exercises one width class: regular (≥1120) · medium (760–1119, right-edge drawer) ·
   compact (<760, bottom tab bar + snap-sheet dock). */
function ShellDemo({
  width,
  height,
  terminal,
  surface = null,
  thread: initialThread = 't1',
  panel,
  full,
  tab,
}: {
  width: number | string;
  height: number;
  terminal?: boolean | null;
  surface?: SurfaceKind | null;
  thread?: string | null;
  panel?: boolean;
  full?: boolean;
  tab?: string;
}) {
  const [threads, setThreads] = useState<WorkbenchThread[]>(SEED_THREADS);
  const [cur, setCur] = useState<string | null>(initialThread);
  const [surfKind, setSurfKind] = useState<SurfaceKind | null>(surface);
  const thread = threads.find((t) => t.id === cur) || null;
  return (
    <div style={{ width, height, margin: '0 auto', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
      <WorkbenchShell terminal={terminal}>
        <WorkbenchShell.Sidebar>
          <WBSidebarSlot threads={threads} cur={cur} setCur={setCur} />
        </WorkbenchShell.Sidebar>
        <WorkbenchShell.Main>
          <>
            <ShellInit panel={panel} full={full} tab={tab} />
            <WBMainSlot
              thread={thread}
              streaming={false}
              onSend={() => {}}
              onStop={() => {}}
              setCur={setCur}
              onUnsettle={() => thread && setThreads((ts) => ts.map((t) => (t.id === thread.id ? { ...t, settled: false } : t)))}
            />
          </>
        </WorkbenchShell.Main>
        <WorkbenchShell.Dock>
          <WBDockSlot seed={TERM_SEED} />
        </WorkbenchShell.Dock>
        <WorkbenchShell.DockSheet>
          <WBDockSheetSlot seed={TERM_SEED} />
        </WorkbenchShell.DockSheet>
        <WorkbenchShell.Panel>
          <WBPanelSlot kind={surfKind} onOpen={setSurfKind} />
        </WorkbenchShell.Panel>
        <WorkbenchShell.TabBar>
          <WBTabsSlot kind={surfKind} onOpen={setSurfKind} />
        </WorkbenchShell.TabBar>
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
/* compact width — hamburger sidebar sheet, bottom SurfaceTabBar */
export const Compact: Story = { render: () => <ShellDemo width={390} height={720} /> };
/* compact width with the terminal presented as a vaul-style snap drawer */
export const CompactDockSheet: Story = { render: () => <ShellDemo width={390} height={720} terminal /> };
/* compact width with a surface open full-screen behind the tab bar */
export const CompactSurfacePage: Story = { render: () => <ShellDemo width={390} height={720} surface="agents" tab="surface" /> };
