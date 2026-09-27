import * as React from 'react';
import { useState, useEffect } from 'react';
import { AdaptivePane, type AdaptivePaneMode } from '../components/adaptive-pane';
import { collectSlots, defineSlot, useContainerWidth } from '../lib/container';
import { cn } from '../lib/workbench/util';
import type { Appearance } from '../lib/theme';
import { workbenchVars, workbenchAppearanceClass, useWorkbenchAppearance, WorkbenchAppearanceProvider } from '../lib/workbench/theme';
import { SnapSheet } from '../components/workbench/snap-sheet';

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
  /** Light or dark palette. Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  /** initial/forced terminal visibility; `false` also disables the auto-open at regular width */
  terminal?: boolean | 'true' | null;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
/* Drawers over a light shell: a lighter scrim and a softer shadow than EdgeDrawer's dark defaults. */
const LIGHT_DRAWER = { scrim: 'rgba(0,0,0,.22)', shadow: '0 0 36px rgba(0,0,0,.14)' };

export function WorkbenchShell(props: WorkbenchShellProps) {
  const [rootRef, width] = useContainerWidth();
  const appearance = useWorkbenchAppearance(props.appearance);
  const light = appearance === 'light';
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
      {...(light ? LIGHT_DRAWER : null)}
    >
      {slots.sidebar}
    </AdaptivePane>
  );
  return (
    <WorkbenchAppearanceProvider value={appearance}>
    <WBShellCtx.Provider value={ctx}>
      <div
        ref={rootRef}
        data-slot="workbench-shell"
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden bg-wb-bg font-ios text-wb-label antialiased',
          workbenchAppearanceClass(appearance),
          props.className,
        )}
        style={{ ...workbenchVars(props.tint, appearance), ...props.style }}
      >
        <div className="relative flex min-h-0 flex-1">
          {sidebarMode === 'column' ? sidebar : null}
          <div className="flex min-w-0 flex-1 flex-col bg-wb-bg">
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
            shadow={light ? LIGHT_DRAWER.shadow : '0 0 44px rgba(0,0,0,.55)'}
            {...(light ? { scrim: LIGHT_DRAWER.scrim } : null)}
            className="border-l border-wb-sep"
          >
            {slots.panel}
          </AdaptivePane>
        </div>
        {compact ? slots.tabbar : null}
        {sidebarMode === 'drawer' ? sidebar : null}
        {compact && slots.docksheet ? (
          <SnapSheet open={term} onClose={() => setTermOpen(false)} snaps={[0.52, 0.93]} bg="var(--wb-term, #0C0C10)" className="wb-term">
            {slots.docksheet}
          </SnapSheet>
        ) : null}
      </div>
    </WBShellCtx.Provider>
    </WorkbenchAppearanceProvider>
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
