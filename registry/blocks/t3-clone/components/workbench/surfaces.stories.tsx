import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
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
} from './surfaces';
import { TerminalBody } from './terminal';
import {
  WorkbenchPanel,
  WorkbenchPanelHeader,
  WorkbenchPanelTitle,
  WorkbenchPanelFullscreen,
  WorkbenchPanelClose,
  WorkbenchTabBar,
  WorkbenchTab,
} from './workbench-shell';
import { IconButton, WorkbenchTheme} from '@brett_lamy/ui';
import { AGENTS, DIFF, FILES } from './fixtures';
import '@brett_lamy/ui/styles.css';

const meta: Meta<typeof WorkbenchPanel> = {
  title: 'Organisms/SurfacePanel',
  component: WorkbenchPanel,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof WorkbenchPanel>;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <WorkbenchTheme style={{ minHeight: 520, padding: 24, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 380, height: 460, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>{children}</div>
    </WorkbenchTheme>
  );
}

/* A WorkbenchPanel on its own (outside a shell): header parts + one surface body. */
function PanelDemo({ initial, full: initialFull = false, compact }: { initial: SurfaceKind | null; full?: boolean; compact?: boolean }) {
  const [kind, setKind] = useState<SurfaceKind | null>(initial);
  const [full, setFull] = useState(initialFull);
  const meta = SURFACES.find((s) => s.k === kind);
  return (
    <WorkbenchPanel>
      <WorkbenchPanelHeader>
        <WorkbenchPanelTitle icon={meta?.icon}>{meta ? meta.name : 'Surfaces'}</WorkbenchPanelTitle>
        {meta ? <IconButton name="chevron-down-wide" label="Switch surface" size={15} onPress={() => setKind(null)} /> : null}
        {!compact ? <WorkbenchPanelFullscreen active={full} onPress={() => setFull(!full)} /> : null}
        <WorkbenchPanelClose onPress={() => setKind(null)} />
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
  );
}

export const EmptyPicker: Story = { render: () => <Frame><PanelDemo initial={null} /></Frame> };
export const Browser: Story = { render: () => <Frame><PanelDemo initial="browser" /></Frame> };
export const Terminal: Story = { render: () => <Frame><PanelDemo initial="terminal" /></Frame> };
export const Files: Story = { render: () => <Frame><PanelDemo initial="files" /></Frame> };
export const Diff: Story = { render: () => <Frame><PanelDemo initial="diff" /></Frame> };
export const Agents: Story = { render: () => <Frame><PanelDemo initial="agents" /></Frame> };

/* fullscreen mode toggled on — the expand button becomes "restore" and highlights */
export const Fullscreen: Story = { render: () => <Frame><PanelDemo initial="browser" full /></Frame> };

/* compact presentation — no fullscreen toggle (a shell hides it at compact width by itself) */
export const Compact: Story = { render: () => <Frame><PanelDemo initial="diff" compact /></Frame> };

/* WorkbenchTabBar on its own: every tab reports through onValueChange */
function TabBarDemo() {
  const [active, setActive] = useState('chat');
  return (
    <WorkbenchTheme style={{ minHeight: 200, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 390, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <WorkbenchTabBar value={active} onValueChange={setActive}>
          <WorkbenchTab id="chat" icon="bubble-left">
            Chat
          </WorkbenchTab>
          {SURFACES.map((s) => (
            <WorkbenchTab key={s.k} id={s.k} icon={s.icon}>
              {s.name}
            </WorkbenchTab>
          ))}
        </WorkbenchTabBar>
      </div>
    </WorkbenchTheme>
  );
}
export const TabBar: Story = { render: () => <TabBarDemo /> };
