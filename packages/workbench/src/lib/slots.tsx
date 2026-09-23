import * as React from 'react';
import { cn } from './util';
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
      className={cn('box-border flex h-11 shrink-0 items-center gap-1 border-b border-wb-sep px-2.5', className)}
      style={style}
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
      <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5">
        <WIcon name="folder" size={14} sw={1.9} className="text-wb-label3" />
        <span className="shrink-0 text-[12.5px] text-wb-label3">{project}</span>
        <span className="text-[12.5px] text-wb-label3">/</span>
        <span className="truncate text-[13px] font-[650]">{thread ? thread.title : 'new thread'}</span>
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
