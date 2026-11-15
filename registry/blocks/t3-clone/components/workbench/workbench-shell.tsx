import * as React from 'react';
import { useState } from 'react';
import { Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable';
import { Toggle as ToggleButton, ToggleGroup, type ToggleGroupValueChangeReason } from '@ui-sdk/react/toggle';
import type { ChangeDetails } from '@ui-sdk/core';
import { AdaptivePane, type AdaptivePanePresentation } from '@/components/ui/adaptive-pane';
import { FloatingSheet, FloatingSheetBody } from '@/components/ui/floating-sheet';
import { SizeClassProvider, useSizeClass, type SizeClass } from '@/lib/container';
import { Icon, type IconName } from '@/lib/icon';
import { type Appearance, ThemeScope, useScopeAppearance } from '@/lib/theme';
import { cn, pressable } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';


/* ══ WorkbenchShell — a thin layout root and the parts that compose an IDE-style agent workspace ══

   <WorkbenchShell>                      grid root: measures itself, owns region state, provides context
     <WorkbenchSidebar/>                 left column ⇄ drawer (compact)              — AdaptivePane
     <WorkbenchMain>                     centre column: a vertical Resizable
       <WorkbenchHeader/>                title bar: triggers, title, actions
       <WorkbenchContent/>               the resizable panel above the dock
       <WorkbenchDock/>                  resizable bottom dock ⇄ FloatingSheet (compact)
     </WorkbenchMain>
     <WorkbenchPanel/>                   right column ⇄ drawer (medium) ⇄ cover (fullscreen / compact page)
     <WorkbenchTabBar/>                  bottom tab bar, compact only
   </WorkbenchShell>

   Each part renders in place and decides its own presentation from the shell's size class (compact below
   760px, regular from 1120px, measured on the shell's own box), so the root never inspects its children. Parts that need to escape their column (the sidebar drawer, the compact
   dock sheet, the panel cover) are positioned against the root grid. */

/** The size-class breakpoints of a shell, on its own box. */
export const workbenchBreakpoints = { medium: 760, regular: 1120 } as const;
export type WorkbenchSizeClass = SizeClass;

export interface WorkbenchShellContextValue {
  /** the shell's size class (`data-size-class` on the root) */
  sizeClass: WorkbenchSizeClass;
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
  const [rootRef, sizeClass] = useSizeClass({ breakpoints: workbenchBreakpoints });
  const appearance = useScopeAppearance('workbench', appearanceProp);
  const compact = sizeClass === 'compact';
  // Wide and compact presentations keep separate state, so crossing the breakpoint never pops a drawer open.
  const [sideColumn, setSideColumn] = useState(defaultSidebarOpen);
  const [sideDrawer, setSideDrawer] = useState(false);
  const [dockPref, setDockPref] = useState<boolean | null>(defaultDockOpen ?? null);
  const [dockHeight, setDockHeight] = useState(defaultDockHeight);
  const [panelPref, setPanelPref] = useState<boolean | null>(defaultPanelOpen ?? null);
  const [panelPage, setPanelPage] = useState(defaultPanelOpen === true);
  const [panelFullscreen, setPanelFullscreen] = useState(defaultPanelFullscreen);

  const sidebarOpen = compact ? sideDrawer : sideColumn;
  const dockOpen = dockPref ?? sizeClass === 'regular';
  const panelOpen = compact ? panelPage : (panelPref ?? sizeClass === 'regular');
  const setSidebarOpen = (open: boolean) => (compact ? setSideDrawer(open) : setSideColumn(open));
  const setPanelOpen = (open: boolean) => {
    if (compact) return setPanelPage(open);
    setPanelPref(open);
    if (!open) setPanelFullscreen(false);
  };
  const ctx: WorkbenchShellContextValue = {
    sizeClass,
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
    <WorkbenchShellContext.Provider value={ctx}>
      {/* A `workbench` theme scope: popups opened in the shell wear its palette, appearance and tint too. */}
      <ThemeScope
        ref={rootRef}
        scope="workbench"
        appearance={appearance}
        tint={tint}
        data-slot="workbench-shell"
        // A layer host (in the markup, with `contain: layout`): the palette, drawers and menus opened in the shell
        // stay in its box, so in a framed page their scrim covers the shell, not the page.
        data-layer-host=""
        className={cn(
          // An inline-size container, so the panel column can size itself from the shell (`cqw`).
          '@container relative grid [contain:layout] h-full w-full grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background font-sans text-foreground antialiased',
          className,
        )}
        style={style}
      >
        {/* A size-class scope: popups inside resolve `presentation="auto"` from the shell's own box. */}
        <SizeClassProvider value={sizeClass}>{children}</SizeClassProvider>
      </ThemeScope>
    </WorkbenchShellContext.Provider>
  );
}

/* ── Sidebar ── */
export interface WorkbenchSidebarProps {
  /** docked column width. Default 242. */
  width?: number | string;
  /** compact drawer width. Default 280. */
  drawerWidth?: number | string;
  children?: React.ReactNode;
}
/** The left region: a docked column, or a drawer over the whole shell at compact width. */
export function WorkbenchSidebar({ width = 242, drawerWidth = 280, children }: WorkbenchSidebarProps) {
  const shell = useOptionalWorkbenchShell();
  if (!shell) return <>{children}</>;
  const { compact, sidebarOpen, setSidebarOpen } = shell;
  return (
    <AdaptivePane
      presentation={compact ? 'drawer' : 'column'}
      side="start"
      aria-label="Sidebar"
      open={sidebarOpen}
      onOpenChange={(open) => setSidebarOpen(open)}
      columnWidth={width}
      drawerWidth={drawerWidth}
      className="border-r border-border"
      style={{ gridColumn: 1, gridRow: 1 }}
      zIndex={80}
    >
      {children}
    </AdaptivePane>
  );
}

interface TriggerProps {
  /** overrides the default action */
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
/* A header toggle: the kit's quiet Toggle (`aria-pressed`), filled while pressed. */
function HeaderToggle({ label, pressed, onPressedChange, className, style, children }: { label: string; pressed: boolean; onPressedChange: (pressed: boolean) => void; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <Toggle
      variant="quiet"
      size="icon-sm"
      aria-label={label}
      title={label}
      pressed={pressed}
      onPressedChange={(next) => onPressedChange(next)}
      className={className}
      style={style}
    >
      {children}
    </Toggle>
  );
}

/** Sidebar control in the header: a hamburger that opens the drawer at compact width, else a "Hide sidebar" toggle. */
export function WorkbenchSidebarTrigger({ onClick, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  if (shell?.compact) {
    return (
      <Button variant="quiet" size="icon-sm" aria-label="Menu" title="Menu" className={className} style={style} onClick={onClick ?? (() => shell.setSidebarOpen(true))}>
        <Icon name="line-3-horizontal" size={18} sw={1.7} />
      </Button>
    );
  }
  return (
    <HeaderToggle
      label="Hide sidebar"
      pressed={shell ? !shell.sidebarOpen : false}
      onPressedChange={(hidden) => (onClick ? onClick() : shell?.setSidebarOpen(!hidden))}
      className={className}
      style={style}
    >
      <Icon name="sidebar-left" size={18} sw={1.7} />
    </HeaderToggle>
  );
}
/** Closes the compact sidebar drawer; renders nothing at wider widths. */
export function WorkbenchSidebarClose({ onClick, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  if (!shell?.compact) return null;
  return (
    <Button
      variant="quiet"
      size="icon-sm"
      aria-label="Close sidebar"
      title="Close sidebar"
      className={cn('ml-auto', className)}
      style={style}
      onClick={onClick ?? (() => shell.setSidebarOpen(false))}
    >
      <Icon name="xmark-large" size={18} sw={1.7} />
    </Button>
  );
}

/* ── Main ── */
/* The dock's sized box, so the main column can read its height in px when a resize ends. Set only inside a
   WorkbenchMain, which is the group the dock resizes in. */
const WorkbenchMainContext = React.createContext<React.RefObject<HTMLDivElement | null> | null>(null);

/**
 * The centre column: header, then `WorkbenchContent`, then `WorkbenchDock`. It is a vertical UI SDK Resizable, so
 * the dock's top edge is a real separator between the content and the dock (drag it, or focus it and use the arrow
 * keys, Home and End).
 */
export function WorkbenchMain({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  const shell = useOptionalWorkbenchShell();
  const dockRef = React.useRef<HTMLDivElement | null>(null);
  return (
    <WorkbenchMainContext value={dockRef}>
      <Resizable
        orientation="vertical"
        // Remember the height the dock was left at, so closing and reopening it keeps it.
        onLayoutCommit={() => {
          const height = Math.round(dockRef.current?.getBoundingClientRect().height ?? 0);
          if (height > 0) shell?.setDockHeight(height);
        }}
        // not positioned: the compact dock sheet inside it covers the whole shell
        className={cn('col-start-2 row-start-1 min-h-0 min-w-0 bg-background', className)}
        style={style}
      >
        {children}
      </Resizable>
    </WorkbenchMainContext>
  );
}

/** The resizable region between the header and the dock (a conversation, an editor). */
export function WorkbenchContent({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <ResizablePanel className={cn('flex min-h-0 min-w-0 flex-col', className)} style={style}>
      {children}
    </ResizablePanel>
  );
}

/* ── Header ── */
export function WorkbenchHeader({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div data-slot="workbench-header" className={cn('box-border flex h-toolbar shrink-0 items-center gap-1 border-b border-border px-2.5', className)} style={style}>
      {children}
    </div>
  );
}
export interface WorkbenchTitleProps {
  /** crumb before the title, e.g. the project */
  project?: React.ReactNode;
  icon?: IconName | (string & {});
  children?: React.ReactNode;
  className?: string;
}
/** `folder project / title` — fills the header's free space so the actions sit at its end. */
export function WorkbenchTitle({ project, icon = 'folder-closed', children, className }: WorkbenchTitleProps) {
  return (
    <div data-slot="workbench-title" className={cn('ml-1 flex min-w-0 flex-1 items-center gap-1.5', className)}>
      <Icon name={icon} size={14} sw={1.9} className="text-tertiary-foreground" />
      {project != null ? (
        <>
          <span className="shrink-0 text-[12.5px] text-tertiary-foreground">{project}</span>
          <span className="text-[12.5px] text-tertiary-foreground">/</span>
        </>
      ) : null}
      <span className="truncate text-footnote font-[650]">{children}</span>
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
export function WorkbenchAction({ icon, label, onClick, className }: { icon: IconName | (string & {}); label: string; onClick?: () => void; className?: string }) {
  return (
    <Button
      variant="quiet"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={className}
      onClick={() => {
        onClick?.();
      }}
    >
      <Icon name={icon} size={18} sw={1.7} />
    </Button>
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
 * medium widths (a UI SDK ResizablePanel after `WorkbenchContent`, `minHeight`–`maxHeight` px); at compact width
 * the same children move into a FloatingSheet (`collapse="hide"`) over the whole shell. Place it last inside
 * `WorkbenchMain`. Outside one it renders inline with its own height.
 */
export function WorkbenchDock({ snaps = [0.52, 0.93], minHeight = 110, maxHeight = 520, className, style, children }: WorkbenchDockProps) {
  const shell = useOptionalWorkbenchShell();
  const dockRef = React.useContext(WorkbenchMainContext);
  const h = shell ? shell.dockHeight : 190;
  if (shell?.compact) {
    const lowest = Math.min(...snaps);
    const highest = Math.max(...snaps);
    const middle = snaps.filter((f) => f > lowest && f < highest);
    return (
      // The dock is a `terminal` theme scope: dark in both appearances. Its shadow still follows the shell.
      <ThemeScope scope="terminal" className="contents text-foreground">
        <FloatingSheet
          variant="sheet"
          gutter={0}
          radius={16}
          collapse="hide"
          visible={shell.dockOpen}
          onVisibleChange={(visible) => {
            if (!visible) shell.setDockOpen(false);
          }}
          peek={`${lowest * 100}%`}
          snapPoints={middle.map((f) => `${f * 100}%` as const)}
          topGap={`${(1 - highest) * 100}%`}
          hideOnScroll={false}
          scrim={false}
          aria-label="Dock"
          className={cn('z-70', className)}
          surfaceClassName="bg-background"
          style={style}
        >
          <FloatingSheetBody>
            <div className="flex h-full min-h-0 flex-col">{children}</div>
          </FloatingSheetBody>
        </FloatingSheet>
      </ThemeScope>
    );
  }
  if (shell && !shell.dockOpen) return null;
  // The dock is a `terminal` theme scope: dark in both appearances.
  const dockClass = cn('dark scheme-dark relative flex shrink-0 flex-col border-t border-border bg-background text-foreground', className);
  if (!dockRef) {
    // On its own (no WorkbenchMain around it) the dock is inline at its own height.
    return (
      <div data-slot="workbench-dock" data-theme-scope="terminal" className={cn('h-(--dock-h)', dockClass)} style={{ '--dock-h': h + 'px', ...style } as React.CSSProperties}>
        {children}
      </div>
    );
  }
  return (
    <>
      {/* UI SDK's separator: a zero-height line with a 10px (24px on touch) hit area, over the dock's own border. */}
      <ResizableHandle
        aria-label="Resize dock"
        className="relative z-2 h-0 outline-none after:absolute after:inset-x-0 after:-top-[3px] after:h-[7px] focus-visible:after:bg-ring/45"
      />
      <ResizablePanel defaultSize={`${h}px`} minSize={`${minHeight}px`} maxSize={`${maxHeight}px`} className="flex min-h-0 flex-col">
        <div ref={dockRef} data-slot="workbench-dock" data-theme-scope="terminal" className={cn('h-full', dockClass)} style={style}>
          {children}
        </div>
      </ResizablePanel>
    </>
  );
}
/** Header toggle for the dock, pressed while it shows. */
export function WorkbenchDockTrigger({ onClick, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  return (
    <HeaderToggle
      label="Terminal"
      pressed={!!shell?.dockOpen}
      onPressedChange={(open) => (onClick ? onClick() : shell?.setDockOpen(open))}
      className={className}
      style={style}
    >
      <Icon name="panel-bottom" size={18} sw={1.7} />
    </HeaderToggle>
  );
}
/** Closes the dock (inline or sheet). */
export function WorkbenchDockClose({ icon = 'bin', label = 'Close terminal', size = 15, onClick, className }: TriggerProps & { icon?: IconName | (string & {}); label?: string; size?: number }) {
  const shell = useOptionalWorkbenchShell();
  return (
    <Button
      variant="quiet"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={className}
      onClick={() => {
        if (onClick) onClick();
        else shell?.setDockOpen(false);
      }}
    >
      <Icon name={icon} size={size} sw={1.7} />
    </Button>
  );
}

/* ── Panel ── */
export interface WorkbenchPanelProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
/**
 * The right region (an inspector: surfaces, a diff, a preview). A column at regular width, a drawer at
 * medium width, and a cover over everything but the tab bar when fullscreen or on the compact panel page.
 * The children render in a `bg-sidebar` column either way, so their state survives every move.
 */
export function WorkbenchPanel({ className, style, children }: WorkbenchPanelProps) {
  const shell = useOptionalWorkbenchShell();
  const body = (
    <div data-slot="workbench-panel" className={cn('box-border flex h-full w-full flex-col bg-sidebar', className)} style={style}>
      {children}
    </div>
  );
  if (!shell) return body;
  const { compact, sizeClass, panelOpen, panelFullscreen, setPanelOpen } = shell;
  const mode: AdaptivePanePresentation = compact || panelFullscreen ? 'cover' : sizeClass === 'medium' ? 'drawer' : 'column';
  const pane = (
    <AdaptivePane
      presentation={mode}
      side="end"
      aria-label="Panel"
      open={panelOpen}
      onOpenChange={(open) => setPanelOpen(open)}
      columnWidth="clamp(300px, 32cqw, 420px)"
      drawerWidth="min(420px, 94%)"
      zIndex={mode === 'cover' ? 60 : 58}
      className="border-l border-border max-w-[94%]"
      style={{ gridColumn: 3, gridRow: 1 }}
    >
      {body}
    </AdaptivePane>
  );
  // The cover spans the first grid row — the whole shell above the (compact) tab bar.
  return mode === 'cover' && panelOpen ? <div className="relative z-60 col-span-full row-start-1">{pane}</div> : pane;
}
/** Header toggle for the panel; hidden at compact width, where the tab bar switches views. */
export function WorkbenchPanelTrigger({ onClick, className, style }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  if (shell?.compact) return null;
  return (
    <HeaderToggle
      label="Right panel"
      pressed={!!shell?.panelOpen}
      onPressedChange={(open) => (onClick ? onClick() : shell?.setPanelOpen(open))}
      className={className}
      style={style}
    >
      <Icon name="sidebar-right" size={18} sw={1.7} />
    </HeaderToggle>
  );
}
export function WorkbenchPanelHeader({ className, style, children }: { className?: string; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <div
      data-slot="workbench-panel-header"
      className={cn('box-border flex min-h-10 shrink-0 items-center gap-0.5 border-b border-border py-1.5 pr-2 pl-3.5', className)}
      style={style}
    >
      {children}
    </div>
  );
}
/** Icon + name; fills the header so the controls after it sit at its end. */
export function WorkbenchPanelTitle({ icon, className, children }: { icon?: IconName | (string & {}); className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="workbench-panel-title" className={cn('mr-0.5 flex min-w-0 flex-1 items-center gap-2', className)}>
      {icon ? <Icon name={icon} size={15} sw={1.8} className="text-muted-foreground" /> : null}
      <span className="truncate text-footnote font-[650]">{children}</span>
    </div>
  );
}
/** Promotes the panel to cover the shell (a toggle, pressed while it does); hidden at compact width.
    `pressed`/`onClick` for use outside a shell. */
export function WorkbenchPanelFullscreen({ pressed, onClick, className }: TriggerProps & { pressed?: boolean }) {
  const shell = useOptionalWorkbenchShell();
  if (shell?.compact) return null;
  const full = pressed ?? !!shell?.panelFullscreen;
  return (
    <HeaderToggle label="Full screen" pressed={full} onPressedChange={(next) => (onClick ? onClick() : shell?.setPanelFullscreen(next))} className={className}>
      <Icon name={full ? 'arrows-collapse' : 'arrows-expand'} size={16} sw={1.7} />
    </HeaderToggle>
  );
}
/** Closes the panel (and leaves fullscreen); on compact width returns to the main view. */
export function WorkbenchPanelClose({ onClick, className }: TriggerProps) {
  const shell = useOptionalWorkbenchShell();
  return (
    <Button
      variant="quiet"
      size="icon-sm"
      aria-label="Close panel"
      title="Close panel"
      className={className}
      onClick={() => {
        if (onClick) onClick();
        else shell?.setPanelOpen(false);
      }}
    >
      <Icon name="xmark-large" size={16} sw={1.7} />
    </Button>
  );
}

/* ── Tab bar (compact) ── */
export type WorkbenchTabBarValueChangeDetails = ChangeDetails<ToggleGroupValueChangeReason>;
export interface WorkbenchTabBarProps {
  /** the panel's current view (e.g. the open surface); selected while the panel page shows */
  value?: string | null;
  /** Runs before the view changes, with the ToggleGroup's details (`item-press`); `details.cancel()` keeps the
      current one. */
  onValueChange?: (id: string, details: WorkbenchTabBarValueChangeDetails) => void;
  /** id of the tab that shows the main column. Default `'chat'`. */
  mainTab?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
/**
 * Compact-width view switcher: a single-select ToggleGroup (UI SDK) under the shell. The `mainTab` shows the
 * main column; any other tab opens the panel page and reports its id through `onValueChange`.
 * Renders only at compact width inside a shell (always, on its own).
 */
export function WorkbenchTabBar({ value, onValueChange, mainTab = 'chat', className, style, children }: WorkbenchTabBarProps) {
  const shell = useOptionalWorkbenchShell();
  if (shell && !shell.compact) return null;
  const selected = shell && !shell.panelOpen ? mainTab : (value ?? '');
  return (
    <ToggleGroup
      aria-label="Views"
      value={selected ? [selected] : []}
      deselectable={false}
      onValueChange={([id], details) => {
        if (!id) return;
        // In a shell the main tab just closes the panel page; on its own every tab reports its id.
        if (id !== mainTab || !shell) onValueChange?.(id, details);
        if (!details.canceled) shell?.setPanelOpen(id !== mainTab);
      }}
      className={cn('col-span-full row-start-2 flex shrink-0 border-t border-border bg-sidebar', className)}
      style={style}
    >
      {children}
    </ToggleGroup>
  );
}
export function WorkbenchTab({ value, icon, className, children }: { value: string; icon: IconName | (string & {}); className?: string; children?: React.ReactNode }) {
  return (
    <ToggleButton
      value={value}
      className={cn(
        pressable, 'flex min-h-[50px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] border-0 bg-transparent pt-[7px] pb-1.5 text-tertiary-foreground data-pressed:text-primary',
        className,
      )}
    >
      <Icon name={icon} size={20} sw={1.8} />
      <span className="text-[9.5px] font-semibold tracking-[.2px]">{children}</span>
    </ToggleButton>
  );
}
