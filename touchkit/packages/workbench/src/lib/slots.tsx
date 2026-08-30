import * as React from 'react';
import { vib, tick } from './haptics';
import { WIcon, IconBtn } from './icons';
import { useWorkbenchShell } from './workbench-shell';
import { ThreadSidebar, type WorkbenchThread } from './thread-sidebar';
import { ChatView } from './chat';
import { TerminalDock, TermHeader, TermBody, type TermLine } from './terminal';
import { SurfacePanel, SurfaceTabBar, type SurfaceKind } from './surfaces';

/* ── Slot children: ordinary components that read the shell with useWorkbenchShell() ── */
export interface WBHeaderProps {
  thread?: WorkbenchThread | null;
  setCur: (id: string | null) => void;
  /** project crumb, defaults to the prototype's "cookbook" */
  project?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function WBHeader({ thread, setCur, project = 'cookbook', className, style }: WBHeaderProps) {
  const { compact, side, setSide, setSideSheet, term, setTerm, panel, setPanel } = useWorkbenchShell();
  return (
    <div
      data-slot="wb-header"
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', height: 44, borderBottom: '1px solid var(--wb-sep)', flexShrink: 0, boxSizing: 'border-box', ...style }}
    >
      {compact ? (
        <IconBtn
          name="hamburger"
          label="Menu"
          onPress={() => {
            tick();
            setSideSheet(true);
          }}
        />
      ) : (
        <IconBtn
          name="sidebar"
          label="Toggle sidebar"
          active={!side}
          onPress={() => {
            tick();
            setSide((v) => !v);
          }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, marginLeft: 4 }}>
        <WIcon name="folder" size={14} sw={1.9} style={{ color: 'var(--wb-label3)' }} />
        <span style={{ fontSize: 12.5, color: 'var(--wb-label3)', flexShrink: 0 }}>{project}</span>
        <span style={{ fontSize: 12.5, color: 'var(--wb-label3)' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread ? thread.title : 'new thread'}</span>
      </div>
      <IconBtn
        name="plus"
        label="New thread"
        onPress={() => {
          vib([8]);
          setCur(null);
          setSideSheet(false);
        }}
      />
      <IconBtn
        name="panelB"
        label="Toggle terminal"
        active={term}
        onPress={() => {
          tick();
          setTerm(!term);
        }}
      />
      {!compact ? (
        <IconBtn
          name="panelR"
          label="Toggle right panel"
          active={panel}
          onPress={() => {
            tick();
            setPanel(!panel);
          }}
        />
      ) : null}
    </div>
  );
}

export interface WBSidebarSlotProps {
  threads: WorkbenchThread[];
  cur: string | null;
  setCur: (id: string | null) => void;
}
export function WBSidebarSlot({ threads, cur, setCur }: WBSidebarSlotProps) {
  const { compact, setSideSheet } = useWorkbenchShell();
  return (
    <ThreadSidebar
      threads={threads}
      cur={cur}
      compact={compact}
      onSelect={(id) => {
        setCur(id);
        setSideSheet(false);
      }}
      onNew={() => {
        vib([8]);
        setCur(null);
        setSideSheet(false);
      }}
      onClose={() => setSideSheet(false)}
    />
  );
}

export interface WBMainSlotProps {
  thread?: WorkbenchThread | null;
  streaming?: boolean;
  onSend: (text: string, imgs?: string[]) => void;
  onStop?: () => void;
  onUnsettle?: () => void;
  setCur: (id: string | null) => void;
  project?: string;
}
export function WBMainSlot({ thread, streaming, onSend, onStop, onUnsettle, setCur, project }: WBMainSlotProps) {
  return (
    <ChatView
      thread={thread}
      streaming={streaming}
      onSend={onSend}
      onStop={onStop}
      onUnsettle={onUnsettle}
      header={<WBHeader thread={thread} setCur={setCur} project={project} />}
    />
  );
}

export function WBDockSlot({ seed }: { seed?: TermLine[] }) {
  const { termH, setTermH, setTerm } = useWorkbenchShell();
  return (
    <TerminalDock
      h={termH}
      setH={setTermH}
      seed={seed}
      onClose={() => {
        tick();
        setTerm(false);
      }}
    />
  );
}

export function WBDockSheetSlot({ seed }: { seed?: TermLine[] }) {
  const { setTerm } = useWorkbenchShell();
  return (
    <React.Fragment>
      <TermHeader onClose={() => setTerm(false)} />
      <TermBody seed={seed} />
    </React.Fragment>
  );
}

export interface WBPanelSlotProps {
  kind: SurfaceKind | null;
  onOpen: (k: SurfaceKind | null) => void;
}
export function WBPanelSlot({ kind, onOpen }: WBPanelSlotProps) {
  const { compact, setTab, setPanel, full, setFull } = useWorkbenchShell();
  return (
    <SurfacePanel
      kind={kind}
      compact={compact}
      onOpen={onOpen}
      full={full}
      onFull={setFull}
      onClose={() => {
        tick();
        if (compact) setTab('chat');
        else {
          setPanel(false);
          setFull(false);
        }
      }}
    />
  );
}

export function WBTabsSlot({ kind, onOpen }: WBPanelSlotProps) {
  const { tab, setTab } = useWorkbenchShell();
  return (
    <SurfaceTabBar
      active={tab === 'chat' ? 'chat' : kind || ''}
      onPick={(k) => {
        tick();
        if (k === 'chat') setTab('chat');
        else {
          onOpen(k as SurfaceKind);
          setTab('surface');
        }
      }}
    />
  );
}
