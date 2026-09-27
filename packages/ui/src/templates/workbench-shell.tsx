import * as React from 'react';
import { useState } from 'react';
import { ToggleButtonGroup } from 'react-aria-components';
import { AdaptivePane, type AdaptivePaneMode } from '../components/adaptive-pane';
import { useContainerWidth } from '../lib/container';
import { cn } from '../lib/workbench/util';
import { tick, vib } from '../lib/workbench/haptics';
import { WIcon, IconBtn, type WIconName } from '../lib/workbench/icons';
import { ToggleButton } from '../lib/workbench/press';
import type { Appearance } from '../lib/theme';
import { workbenchVars, workbenchAppearanceClass, useWorkbenchAppearance, WorkbenchAppearanceProvider } from '../lib/workbench/theme';
import { SnapSheet } from '../components/workbench/snap-sheet';

/* ══ WorkbenchShell — a thin layout root and the parts that compose an IDE-style agent workspace ══

   <WorkbenchShell>                      grid root: measures itself, owns region state, provides context
     <WorkbenchSidebar/>                 left column ⇄ EdgeDrawer (compact)          — AdaptivePane
     <WorkbenchMain>                     centre column
       <WorkbenchHeader/>                title bar: triggers, title, actions
       …content…
       <WorkbenchDock/>                  resizable bottom dock ⇄ SnapSheet (compact)
     </WorkbenchMain>
     <WorkbenchPanel/>                   right column ⇄ drawer (medium) ⇄ cover (fullscreen / compact page)
     <WorkbenchTabBar/>                  bottom tab bar, compact only
   </WorkbenchShell>

   Each part renders in place and decides its own presentation from the shell's width class, so the root
   never inspects its children. Parts that need to escape their column (the sidebar drawer, the compact
   dock sheet, the panel cover) are positioned against the root grid. */

/** Width class thresholds, measured on the shell's own box. */
export function workbenchWidthClass(w: number): WorkbenchWidthClass {
  return w < 760 ? 'compact' : w < 1120 ? 'medium' : 'regular';
}
export type WorkbenchWidthClass = 'regular' | 'medium' | 'compact';

export interface WorkbenchShellContextValue {
  /** measured shell width */
  width: number;
  widthClass: WorkbenchWidthClass;
  compact: boolean;
  appearance: Appearance;
  /** column visible (regular/medium) or drawer open (compact) */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
  toggleDock: () => void;
  dockHeight: number;
  setDockHeight: (h: number) => void;
  /** column/drawer open (regular/medium) or the panel page showing (compact) */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  panelFullscreen: boolean;
  setPanelFullscreen: (full: boolean) => void;
}

const WorkbenchShellContext = React.createContext<WorkbenchShellContextValue | null>(null);

/** Shell state for descendants. Throws outside `<WorkbenchShell>`. */
export function useWorkbenchShell(): WorkbenchShellContextValue {
  const ctx = React.useContext(WorkbenchShellContext);
  if (!ctx) throw new Error('useWorkbenchShell must be used within <WorkbenchShell>');
  return ctx;
}
/** Shell state, or `null` when a part is rendered on its own (docs, stories, a custom layout). */
export function useOptionalWorkbenchShell(): WorkbenchShellContextValue | null {
  return React.useContext(WorkbenchShellContext);
}

export interface WorkbenchShellProps {
  tint?: string;
  /** Light or dark palette. Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  /** Initial sidebar column visibility (regular/medium). Default `true`. */
  defaultSidebarOpen?: boolean;
  /** Initial dock visibility. Unset: open at regular width only. `false` keeps it closed at every width. */
  defaultDockOpen?: boolean;
  /** Initial dock height in px. Default 190. */
  defaultDockHeight?: number;
  /** Initial panel visibility. Unset: open at regular width only. `true` also opens the compact panel page. */
  defaultPanelOpen?: boolean;
  defaultPanelFullscreen?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function WorkbenchShell({
  tint,
  appearance: appearanceProp,
  defaultSidebarOpen = true,
  defaultDockOpen,
  defaultDockHeight = 190,
  defaultPanelOpen,
  defaultPanelFullscreen = false,
  children,
  className,
  style,
}: WorkbenchShellProps) {
  const [rootRef, width] = useContainerWidth();
  const appearance = useWorkbenchAppearance(appearanceProp);
  const widthClass = workbenchWidthClass(width);
  const compact = widthClass === 'compact';
  // Wide and compact presentations keep separate state, so crossing the breakpoint never pops a drawer open.
  const [sideColumn, setSideColumn] = useState(defaultSidebarOpen);
  const [sideDrawer, setSideDrawer] = useState(false);
  const [dockPref, setDockPref] = useState<boolean | null>(defaultDockOpen ?? null);
  const [dockHeight, setDockHeight] = useState(defaultDockHeight);
  const [panelPref, setPanelPref] = useState<boolean | null>(defaultPanelOpen ?? null);
  const [panelPage, setPanelPage] = useState(defaultPanelOpen === true);
  const [panelFullscreen, setPanelFullscreen] = useState(defaultPanelFullscreen);

  const sidebarOpen = compact ? sideDrawer : sideColumn;
  const dockOpen = dockPref ?? widthClass === 'regular';
  const panelOpen = compact ? panelPage : (panelPref ?? widthClass === 'regular');
  const setSidebarOpen = (open: boolean) => (compact ? setSideDrawer(open) : setSideColumn(open));
  const setPanelOpen = (open: boolean) => {
    if (compact) return setPanelPage(open);
    setPanelPref(open);
    if (!open) setPanelFullscreen(false);
  };
  const ctx: WorkbenchShellContextValue = {
    width,
    widthClass,
    compact,
    appearance,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar: () => setSidebarOpen(!sidebarOpen),
    dockOpen,
    setDockOpen: setDockPref,
    toggleDock: () => setDockPref(!dockOpen),
    dockHeight,
    setDockHeight,
    panelOpen,
    setPanelOpen,
    togglePanel: () => setPanelOpen(!panelOpen),
    panelFullscreen,
    setPanelFullscreen,
  };
  return (
    <WorkbenchAppearanceProvider value={appearance}>
      <WorkbenchShellContext.Provider value={ctx}>
        <div
          ref={rootRef}
          data-slot="workbench-shell"
          data-width-class={widthClass}
          className={cn(
            'relative grid h-full w-full grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-wb-bg font-ios text-wb-label antialiased',
            workbenchAppearanceClass(appearance),
            className,
          )}
          style={{ ...workbenchVars(tint, appearance), ...style }}
        >
          {children}
        </div>
      </WorkbenchShellContext.Provider>
    </WorkbenchAppearanceProvider>
  );
}

/* Drawers over a light shell: a lighter scrim and a softer shadow than EdgeDrawer's dark defaults. */
const LIGHT_DRAWER = { scrim: 'rgba(0,0,0,.22)', shadow: '0 0 36px rgba(0,0,0,.14)' };

/* ── Sidebar ── */
export interface WorkbenchSidebarProps {
  /** docked column width. Default 242. */
  width?: number | string;
  /** compact drawer width. Default 280. */
  drawerWidth?: number | string;
  children?: React.ReactNode;
}
/** The left region: a docked column, or an EdgeDrawer over the whole shell at compact width. */
export function WorkbenchSidebar({ width = 242, drawerWidth = 280, children }: WorkbenchSidebarProps) {
  const shell = useOptionalWorkbenchShell();
  if (!shell) return <>{children}</>;
  const { compact, sidebarOpen, setSidebarOpen, appearance } = shell;
  const mode: AdaptivePaneMode = compact ? 'drawer' : sidebarOpen ? 'column' : 'hidden';
  return (
    <AdaptivePane
      mode={mode}
      side="left"
      open={compact && sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      columnWidth={width}
      columnStyle={{ gridColumn: 1, gridRow: 1, borderRight: '1px solid var(--wb-sep)' }}
      drawerWidth={drawerWidth}
      maxWidth="84%"
      zIndex={80}
      {...(appearance === 'light' ? LIGHT_DRAWER : null)}
    >
      {children}
    </AdaptivePane>
  );
}

interface TriggerProps {
  /** overrides the default action */
  onPress?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
/** Sidebar toggle in the header: a hamburger that opens the drawer at compact width. */
export function WorkbenchSidebarTrigger({ onPress, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  const compact = !!shell?.compact;
  return (
    <IconBtn
      name={compact ? 'hamburger' : 'sidebar'}
      label={compact ? 'Menu' : 'Toggle sidebar'}
      active={!compact && shell ? !shell.sidebarOpen : false}
      className={className}
      style={style}
      onPress={() => {
        tick();
        if (onPress) onPress();
        else shell?.toggleSidebar();
      }}
    />
  );
}
/** Closes the compact sidebar drawer; renders nothing at wider widths. */
export function WorkbenchSidebarClose({ onPress, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  if (!shell?.compact) return null;
  return (
    <IconBtn name="x" label="Close sidebar" className={cn('ml-auto', className)} style={style} onPress={onPress ?? (() => shell.setSidebarOpen(false))} />
  );
}

/* ── Main ── */
export function WorkbenchMain({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div
      data-slot="workbench-main"
      // not positioned: the compact dock sheet inside it covers the whole shell
      className={cn('col-start-2 row-start-1 flex min-h-0 min-w-0 flex-col bg-wb-bg', className)}
      style={style}
    >
      {children}
    </div>
  );
}

/* ── Header ── */
export function WorkbenchHeader({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div data-slot="workbench-header" className={cn('box-border flex h-11 shrink-0 items-center gap-1 border-b border-wb-sep px-2.5', className)} style={style}>
      {children}
    </div>
  );
}
export interface WorkbenchTitleProps {
  /** crumb before the title, e.g. the project */
  project?: React.ReactNode;
  icon?: WIconName;
  children?: React.ReactNode;
  className?: string;
}
/** `folder project / title` — fills the header's free space so the actions sit at its end. */
export function WorkbenchTitle({ project, icon = 'folder', children, className }: WorkbenchTitleProps) {
  return (
    <div data-slot="workbench-title" className={cn('ml-1 flex min-w-0 flex-1 items-center gap-1.5', className)}>
      <WIcon name={icon} size={14} sw={1.9} className="text-wb-label3" />
      {project != null ? (
        <>
          <span className="shrink-0 text-[12.5px] text-wb-label3">{project}</span>
          <span className="text-[12.5px] text-wb-label3">/</span>
        </>
      ) : null}
      <span className="truncate text-[13px] font-[650]">{children}</span>
    </div>
  );
}
export function WorkbenchActions({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="workbench-actions" className={cn('flex shrink-0 items-center gap-1', className)}>
      {children}
    </div>
  );
}
/** A header icon button that thumps like the rest of the chrome. */
export function WorkbenchAction({ icon, label, onPress, active, className }: { icon: WIconName; label: string; onPress?: () => void; active?: boolean; className?: string }) {
  return (
    <IconBtn
      name={icon}
      label={label}
      active={active}
      className={className}
      onPress={() => {
        vib([8]);
        onPress?.();
      }}
    />
  );
}

/* ── Dock ── */
export interface WorkbenchDockProps {
  /** compact sheet snap points, as fractions of the shell height */
  snaps?: number[];
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
/**
 * The bottom dock (a terminal, logs, a console). Inline and resizable from its top edge at regular and
 * medium widths; at compact width the same children move into a SnapSheet over the whole shell.
 * Place it last inside `WorkbenchMain`. Outside a shell it renders inline with its own height.
 */
export function WorkbenchDock({ snaps = [0.52, 0.93], minHeight = 110, maxHeight = 520, className, style, children }: WorkbenchDockProps) {
  const shell = useOptionalWorkbenchShell();
  const [ownH, setOwnH] = useState(190);
  const h = shell ? shell.dockHeight : ownH;
  const setH = shell ? shell.setDockHeight : setOwnH;
  const drag = React.useRef<{ y0: number; h0: number } | null>(null);
  if (shell?.compact) {
    return (
      <SnapSheet open={shell.dockOpen} onClose={() => shell.setDockOpen(false)} snaps={snaps} bg="var(--wb-term, #0C0C10)" className={cn('wb-term', className)} style={style}>
        {children}
      </SnapSheet>
    );
  }
  if (shell && !shell.dockOpen) return null;
  const up = () => {
    drag.current = null;
  };
  return (
    <div
      data-slot="workbench-dock"
      className={cn('wb-term relative flex h-(--dock-h) shrink-0 flex-col border-t border-wb-sep bg-wb-term', className)}
      // the dock height is user-resized at runtime
      style={{ '--dock-h': h + 'px', ...style } as React.CSSProperties}
    >
      <div
        data-slot="workbench-dock-resize"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize dock"
        onPointerDown={(e) => {
          drag.current = { y0: e.clientY, h0: h };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) setH(Math.min(maxHeight, Math.max(minHeight, drag.current.h0 - (e.clientY - drag.current.y0))));
        }}
        onPointerUp={up}
        onPointerCancel={up}
        className="absolute -top-[3px] right-0 left-0 z-2 h-[7px] cursor-ns-resize touch-none"
      />
      {children}
    </div>
  );
}
/** Header toggle for the dock. */
export function WorkbenchDockTrigger({ onPress, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  return (
    <IconBtn
      name="panelB"
      label="Toggle terminal"
      active={!!shell?.dockOpen}
      className={className}
      style={style}
      onPress={() => {
        tick();
        if (onPress) onPress();
        else shell?.toggleDock();
      }}
    />
  );
}
/** Closes the dock (inline or sheet). */
export function WorkbenchDockClose({ icon = 'trash', label = 'Close terminal', size = 15, onPress, className }: TriggerProps & { icon?: WIconName; label?: string; size?: number }) {
  const shell = useOptionalWorkbenchShell();
  return (
    <IconBtn
      name={icon}
      label={label}
      size={size}
      className={className}
      onPress={() => {
        tick();
        if (onPress) onPress();
        else shell?.setDockOpen(false);
      }}
    />
  );
}

/* ── Panel ── */
export interface WorkbenchPanelProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
/**
 * The right region (an inspector: surfaces, a diff, a preview). A column at regular width, an EdgeDrawer at
 * medium width, and a cover over everything but the tab bar when fullscreen or on the compact panel page.
 * The children render in a `bg-wb-side` column either way, so their state survives every move.
 */
export function WorkbenchPanel({ className, style, children }: WorkbenchPanelProps) {
  const shell = useOptionalWorkbenchShell();
  const body = (
    <div data-slot="workbench-panel" className={cn('box-border flex h-full w-full flex-col bg-wb-side', className)} style={style}>
      {children}
    </div>
  );
  if (!shell) return body;
  const { compact, widthClass, width, panelOpen, panelFullscreen, setPanelOpen, appearance } = shell;
  const light = appearance === 'light';
  const mode: AdaptivePaneMode = compact || panelFullscreen ? (panelOpen ? 'cover' : 'hidden') : widthClass === 'medium' ? 'drawer' : panelOpen ? 'column' : 'hidden';
  const pane = (
    <AdaptivePane
      mode={mode}
      side="right"
      open={panelOpen}
      onClose={() => setPanelOpen(false)}
      columnWidth={`clamp(300px, ${width * 0.32}px, 420px)`}
      columnStyle={{ gridColumn: 3, gridRow: 1, borderLeft: '1px solid var(--wb-sep)' }}
      drawerWidth="min(420px, 94%)"
      zIndex={mode === 'cover' ? 60 : 58}
      shadow={light ? LIGHT_DRAWER.shadow : '0 0 44px rgba(0,0,0,.55)'}
      {...(light ? { scrim: LIGHT_DRAWER.scrim } : null)}
      className="border-l border-wb-sep"
    >
      {body}
    </AdaptivePane>
  );
  // The cover spans the first grid row — the whole shell above the (compact) tab bar.
  return mode === 'cover' ? <div className="relative z-60 col-span-full row-start-1">{pane}</div> : pane;
}
/** Header toggle for the panel; hidden at compact width, where the tab bar switches views. */
export function WorkbenchPanelTrigger({ onPress, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  if (shell?.compact) return null;
  return (
    <IconBtn
      name="panelR"
      label="Toggle right panel"
      active={!!shell?.panelOpen}
      className={className}
      style={style}
      onPress={() => {
        tick();
        if (onPress) onPress();
        else shell?.togglePanel();
      }}
    />
  );
}
export function WorkbenchPanelHeader({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div
      data-slot="workbench-panel-header"
      className={cn('box-border flex min-h-10 shrink-0 items-center gap-0.5 border-b border-wb-sep py-1.5 pr-2 pl-3.5', className)}
      style={style}
    >
      {children}
    </div>
  );
}
/** Icon + name; fills the header so the controls after it sit at its end. */
export function WorkbenchPanelTitle({ icon, className, children }: { icon?: WIconName; className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="workbench-panel-title" className={cn('mr-0.5 flex min-w-0 flex-1 items-center gap-2', className)}>
      {icon ? <WIcon name={icon} size={15} sw={1.8} className="text-wb-label2" /> : null}
      <span className="truncate text-[13px] font-[650]">{children}</span>
    </div>
  );
}
/** Promotes the panel to cover the shell; hidden at compact width. `active`/`onPress` for use outside a shell. */
export function WorkbenchPanelFullscreen({ active, onPress, className }: TriggerProps & { active?: boolean }) {
  const shell = useOptionalWorkbenchShell();
  if (shell?.compact) return null;
  const full = active ?? !!shell?.panelFullscreen;
  return (
    <IconBtn
      name={full ? 'restore' : 'expand'}
      label={full ? 'Exit full screen' : 'Full screen'}
      size={16}
      active={full}
      className={className}
      onPress={() => {
        vib([8]);
        if (onPress) onPress();
        else shell?.setPanelFullscreen(!full);
      }}
    />
  );
}
/** Closes the panel (and leaves fullscreen); on compact width returns to the main view. */
export function WorkbenchPanelClose({ onPress, className }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  return (
    <IconBtn
      name="x"
      label="Close panel"
      size={16}
      className={className}
      onPress={() => {
        tick();
        if (onPress) onPress();
        else shell?.setPanelOpen(false);
      }}
    />
  );
}

/* ── Tab bar (compact) ── */
interface TabBarContextValue {
  mainTab: string;
  onValueChange?: (id: string) => void;
}
const TabBarContext = React.createContext<TabBarContextValue>({ mainTab: 'chat' });

export interface WorkbenchTabBarProps {
  /** the panel's current view (e.g. the open surface); selected while the panel page shows */
  value?: string | null;
  onValueChange?: (id: string) => void;
  /** id of the tab that shows the main column. Default `'chat'`. */
  mainTab?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
/**
 * Compact-width view switcher: a single-select ToggleButtonGroup under the shell. The `mainTab` shows the
 * main column; any other tab opens the panel page and reports its id through `onValueChange`.
 * Renders only at compact width inside a shell (always, on its own).
 */
export function WorkbenchTabBar({ value, onValueChange, mainTab = 'chat', className, style, children }: WorkbenchTabBarProps) {
  const shell = useOptionalWorkbenchShell();
  if (shell && !shell.compact) return null;
  const selected = shell && !shell.panelOpen ? mainTab : (value ?? '');
  return (
    <TabBarContext.Provider value={{ mainTab, onValueChange }}>
      <ToggleButtonGroup
        data-slot="workbench-tab-bar"
        aria-label="Views"
        selectionMode="single"
        selectedKeys={selected ? [selected] : []}
        className={cn('col-span-full row-start-2 flex shrink-0 border-t border-wb-sep bg-wb-side', className)}
        style={style}
      >
        {children}
      </ToggleButtonGroup>
    </TabBarContext.Provider>
  );
}
export function WorkbenchTab({ id, icon, className, children }: { id: string; icon: WIconName; className?: string; children?: React.ReactNode }) {
  const shell = useOptionalWorkbenchShell();
  const { mainTab, onValueChange } = React.useContext(TabBarContext);
  return (
    <ToggleButton
      id={id}
      className={cn(
        'wb-btn flex min-h-[50px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] border-0 bg-transparent pt-[7px] pb-1.5 text-wb-label3 data-selected:text-wb-tint',
        className,
      )}
      onPress={() => {
        tick();
        // In a shell the main tab just closes the panel page; on its own every tab reports its id.
        if (id !== mainTab || !shell) onValueChange?.(id);
        shell?.setPanelOpen(id !== mainTab);
      }}
    >
      <WIcon name={icon} size={20} sw={1.8} />
      <span className="text-[9.5px] font-semibold tracking-[.2px]">{children}</span>
    </ToggleButton>
  );
}
