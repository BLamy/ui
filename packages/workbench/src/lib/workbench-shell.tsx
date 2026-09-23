import * as React from 'react';
import { useState, useEffect } from 'react';
import { AdaptivePane, collectSlots, defineSlot, useContainerWidth, type AdaptivePaneMode } from '@touchkit/ui';
import { cn, WFONT } from './util';
import { workbenchVars } from './theme';
import { SnapSheet } from './snap-sheet';

/* ══ WorkbenchShell — compositional IDE-scaffold container ══
   Owns width class + region state. Slots (children are ordinary elements — they read the shell with
   useWorkbenchShell(), never a ctx argument):
   Sidebar (column ⇄ overlay sheet) · Main · Dock (inline, ⇄ DockSheet in a SnapSheet when compact) ·
   Panel (column ⇄ drawer ⇄ fullscreen) · TabBar (compact only).
   Composition: useContainerWidth → width class; Sidebar and Panel are AdaptivePanes whose mode follows it;
   the compact dock is a SnapSheet. */

/** Width class thresholds, measured on the shell's own box. */
export function workbenchWidthClass(w: number): WorkbenchWidthClass {
  return w < 760 ? 'compact' : w < 1120 ? 'medium' : 'regular';
}
export type WorkbenchWidthClass = 'regular' | 'medium' | 'compact';
export interface WorkbenchShellContextValue {
  wc: WorkbenchWidthClass;
  compact: boolean;
  side: boolean;
  setSide: React.Dispatch<React.SetStateAction<boolean>>;
  sideSheet: boolean;
  setSideSheet: React.Dispatch<React.SetStateAction<boolean>>;
  term: boolean;
  setTerm: React.Dispatch<React.SetStateAction<boolean | null>>;
  termH: number;
  setTermH: React.Dispatch<React.SetStateAction<number>>;
  panel: boolean;
  setPanel: React.Dispatch<React.SetStateAction<boolean | null>>;
  tab: string;
  setTab: React.Dispatch<React.SetStateAction<string>>;
  full: boolean;
  setFull: React.Dispatch<React.SetStateAction<boolean>>;
}

const WBShellCtx = React.createContext<WorkbenchShellContextValue | null>(null);
export const useWorkbenchShell = (): WorkbenchShellContextValue => {
  const ctx = React.useContext(WBShellCtx);
  if (!ctx) throw new Error('useWorkbenchShell must be used within <WorkbenchShell>');
  return ctx;
};

export interface WorkbenchShellProps {
  tint?: string;
  /** initial/forced terminal visibility; `false` also disables the auto-open at regular width */
  terminal?: boolean | 'true' | null;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function WorkbenchShell(props: WorkbenchShellProps) {
  const [rootRef, width] = useContainerWidth();
  const wc = workbenchWidthClass(width);
  const [side, setSide] = useState(true);
  const [sideSheet, setSideSheet] = useState(false);
  const [termOpen, setTermOpen] = useState<boolean | null>(null);
  const [termH, setTermH] = useState(190);
  const [panelOpen, setPanelOpen] = useState<boolean | null>(null);
  const [tab, setTab] = useState('chat');
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (props.terminal != null) setTermOpen(props.terminal === true || props.terminal === 'true');
  }, [props.terminal]);
  const compact = wc === 'compact';
  const term = termOpen == null ? props.terminal !== false && wc === 'regular' : termOpen;
  const panel = panelOpen == null ? wc === 'regular' : panelOpen;
  const ctx: WorkbenchShellContextValue = {
    wc,
    compact,
    side,
    setSide,
    sideSheet,
    setSideSheet,
    term,
    setTerm: setTermOpen,
    termH,
    setTermH,
    panel,
    setPanel: setPanelOpen,
    tab,
    setTab,
    full,
    setFull,
  };
  const slots = collectSlots(props.children);
  const sidebarMode: AdaptivePaneMode = !slots.sidebar ? 'hidden' : compact ? 'drawer' : side ? 'column' : 'hidden';
  const panelMode: AdaptivePaneMode = !slots.panel
    ? 'hidden'
    : compact
      ? tab === 'surface' ? 'cover' : 'hidden'
      : full
        ? panel ? 'cover' : 'hidden'
        : wc === 'medium' ? 'drawer' : panel ? 'column' : 'hidden';
  // The column docks inside the row; the compact drawer spans the whole shell, tab bar included.
  const sidebar = (
    <AdaptivePane
      mode={sidebarMode}
      side="left"
      open={sideSheet}
      onClose={() => setSideSheet(false)}
      columnWidth={242}
      columnStyle={{ borderRight: '1px solid var(--wb-sep)' }}
      drawerWidth={280}
      maxWidth="84%"
      zIndex={80}
    >
      {slots.sidebar}
    </AdaptivePane>
  );
  return (
    <WBShellCtx.Provider value={ctx}>
      <div
        ref={rootRef}
        data-slot="workbench-shell"
        className={cn('wb-dark', props.className)}
        style={{
          ...workbenchVars(props.tint),
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: 'var(--wb-bg)',
          color: 'var(--wb-label)',
          fontFamily: WFONT,
          colorScheme: 'dark',
          display: 'flex',
          flexDirection: 'column',
          WebkitFontSmoothing: 'antialiased',
          ...props.style,
        }}
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
          {sidebarMode === 'column' ? sidebar : null}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--wb-bg)' }}>
            {slots.main}
            {!compact && term ? slots.dock : null}
          </div>
          <AdaptivePane
            mode={panelMode}
            side="right"
            open={panel}
            onClose={() => setPanelOpen(false)}
            columnWidth="clamp(300px, 32%, 420px)"
            columnStyle={{ borderLeft: '1px solid var(--wb-sep)' }}
            drawerWidth="min(420px, 94%)"
            zIndex={panelMode === 'cover' ? 60 : 58}
            shadow="0 0 44px rgba(0,0,0,.55)"
            style={{ borderLeft: '1px solid var(--wb-sep)' }}
          >
            {slots.panel}
          </AdaptivePane>
        </div>
        {compact ? slots.tabbar : null}
        {sidebarMode === 'drawer' ? sidebar : null}
        {compact && slots.docksheet ? (
          <SnapSheet open={term} onClose={() => setTermOpen(false)} snaps={[0.52, 0.93]} bg="#0C0C10">
            {slots.docksheet}
          </SnapSheet>
        ) : null}
      </div>
    </WBShellCtx.Provider>
  );
}
WorkbenchShell.Context = WBShellCtx;
WorkbenchShell.useShell = useWorkbenchShell;
WorkbenchShell.Sidebar = defineSlot('sidebar');
WorkbenchShell.Main = defineSlot('main');
WorkbenchShell.Dock = defineSlot('dock');
WorkbenchShell.DockSheet = defineSlot('docksheet');
WorkbenchShell.Panel = defineSlot('panel');
WorkbenchShell.TabBar = defineSlot('tabbar');
