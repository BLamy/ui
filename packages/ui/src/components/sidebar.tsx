/* ══ Sidebar system — one compositional API over every sidebar variant ══
   <SidebarProvider> owns open state + container width (useContainerWidth); <Sidebar variant="docked|rail|float|overlay">
   renders the same children in any behavior, and ANY variant becomes a hamburger overlay (EdgeDrawer) below the
   breakpoint. Styled in the workbench dark language: every colour reads a --wb-* token with a fallback. */
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { EdgeDrawer } from './edge-drawer';
import { useContainerWidth } from '../lib/container';
import { cn } from '../lib/utils';

const BLUE = '#0A84FF';
/* Muted label colours with the workbench-dark fallbacks the sidebar has always carried. */
const mut = 'text-[color:var(--muted-foreground)]';
const mut3 = 'text-[color:var(--tertiary-foreground)]';
/* Sidebar hairline. */
const sepR = '[border-right:1px_solid_var(--border)]';
const sideBg = 'bg-[var(--sidebar)]';
/** Haptic tap (no-ops where navigator.vibrate is unavailable; the Haptics engine patches it on iOS Safari). */
const vib = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* noop */
  }
};

/** Sidebar item icons: 24×24 stroke paths, keyed by name. */
export const SIDEBAR_ICONS: Record<string, string> = {
  search: 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.2-4.2',
  plus: 'M12 5v14M5 12h14',
  home: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  inbox: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1.5 2h3L15 13h5',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  bell: 'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c-2.5 2.6-2.5 15.4 0 18c2.5-2.6 2.5-15.4 0-18',
};
const P = SIDEBAR_ICONS;

function BIcon({ d, size = 16, sw = 1.9 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg data-slot="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export interface SidebarContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggle: () => void;
  narrow: boolean;
}
export const SBCtx = createContext<SidebarContextValue | null>(null);
export const SBCollapsedCtx = createContext(false);
export function useSidebar() {
  const c = useContext(SBCtx);
  if (!c) throw new Error('Sidebar components must be rendered inside <SidebarProvider>');
  return c;
}

export interface SidebarProviderProps {
  defaultOpen?: boolean;
  breakpoint?: number;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function SidebarProvider({ defaultOpen = true, breakpoint = 560, children, style, className }: SidebarProviderProps) {
  const [ref, width] = useContainerWidth();
  const [open, setOpen] = useState(defaultOpen);
  const narrow = width < breakpoint;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setOpen(narrow ? false : defaultOpen);
  }, [narrow]);
  const toggle = () => {
    setOpen((o) => !o);
    vib([6]);
  };
  return (
    <SBCtx.Provider value={{ open, setOpen, toggle, narrow }}>
      <div
        ref={ref}
        data-slot="sidebar-provider"
        className={cn('relative flex h-full overflow-hidden bg-[var(--background)] font-ios', className)}
        style={style}
      >
        {children}
      </div>
    </SBCtx.Provider>
  );
}

export type SidebarVariant = 'docked' | 'rail' | 'float' | 'overlay';
export interface SidebarProps {
  variant?: SidebarVariant;
  width?: number;
  railWidth?: number;
  children?: ReactNode;
}
export function Sidebar({ variant = 'docked', width = 228, railWidth = 52, children }: SidebarProps) {
  const c = useSidebar();
  const overlay = variant === 'overlay' || c.narrow;
  const collapsed = !overlay && variant === 'rail' && !c.open;
  const body = (
    <SBCollapsedCtx.Provider value={collapsed}>
      <div className="flex h-full flex-col overflow-hidden">{children}</div>
    </SBCollapsedCtx.Provider>
  );
  if (overlay)
    return (
      <EdgeDrawer
        side="left"
        open={c.open}
        onClose={() => c.setOpen(false)}
        width={width}
        zIndex={20}
        shadow="0 0 44px rgba(0,0,0,.4)"
        className={cn(sideBg, sepR)}
      >
        <div data-slot="sidebar" className="h-full">{body}</div>
      </EdgeDrawer>
    );
  const w = collapsed ? railWidth : c.open ? width : 0;
  const float = variant === 'float';
  return (
    <div
      data-slot="sidebar"
      className={cn(
        'box-border shrink-0 overflow-hidden transition-[width] duration-spring-smooth ease-spring-smooth',
        float ? 'bg-transparent p-2.5' : cn(sideBg, sepR, 'p-0'),
      )}
      // Width follows open/collapsed state and the width props.
      style={{ width: w }}
    >
      <div
        className={cn(
          'box-border h-full',
          float && cn(sideBg, 'overflow-hidden rounded-[14px] [border:1px_solid_var(--border)] font-ios'),
        )}
        style={{ width: (collapsed ? railWidth : width) - (float ? 20 : 0) }}
      >
        {body}
      </div>
    </div>
  );
}

export function SidebarHeader({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="sidebar-header" className="shrink-0 px-2.5 pt-3 pb-1.5">
      {children}
    </div>
  );
}
export function SidebarContent({ children }: { children?: ReactNode }) {
  return (
    <div
      data-slot="sidebar-content"
      className="bl-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-0"
    >
      {children}
    </div>
  );
}
export function SidebarFooter({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="sidebar-footer" className="shrink-0 p-2 [border-top:1px_solid_var(--border)]">
      {children}
    </div>
  );
}

export interface SidebarWorkspaceProps {
  name?: string;
  detail?: ReactNode;
  initial?: ReactNode;
}
export function SidebarWorkspace({ name, detail, initial }: SidebarWorkspaceProps) {
  const collapsed = useContext(SBCollapsedCtx);
  return (
    <div
      data-slot="sidebar-workspace"
      className={cn('flex items-center gap-2 px-0.5 pt-0 pb-1', collapsed ? 'justify-center' : 'justify-start')}
    >
      <span className="grid size-[26px] shrink-0 place-items-center rounded-[8px] bg-[linear-gradient(135deg,#0A84FF,#5E5CE6)] text-[12px] font-extrabold text-white">
        {initial || (name || 'W')[0]}
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-[1.15]">
          <div className="text-[12.5px] font-bold whitespace-nowrap text-foreground">{name}</div>
          {detail && <div className={cn('text-[10.5px] whitespace-nowrap', mut3)}>{detail}</div>}
        </div>
      )}
    </div>
  );
}

export interface SidebarSearchProps {
  placeholder?: string;
  onPress?: () => void;
}
export function SidebarSearch({ placeholder = 'Quick search', onPress }: SidebarSearchProps) {
  const collapsed = useContext(SBCollapsedCtx);
  if (collapsed)
    return (
      <AriaButton
        data-slot="sidebar-search"
        className={cn('bl-sidebar-hl grid w-full cursor-pointer place-items-center rounded-[8px] border-0 bg-transparent px-0 py-2', mut3)}
        render={(props) => <button {...props} title={placeholder} />}
        onPress={onPress}
      >
        <BIcon d={P['search']} size={14} />
      </AriaButton>
    );
  return (
    <AriaButton
      data-slot="sidebar-search"
      className="bl-sidebar-hl mx-0 mt-0.5 mb-1 flex w-full cursor-pointer items-center gap-[7px] rounded-[8px] border-0 bg-secondary px-[9px] py-1.5 font-ios"
      onPress={onPress}
    >
      <span className={cn('grid', mut3)}>
        <BIcon d={P['search']} size={13} />
      </span>
      <span className={cn('flex-1 text-left text-[12px]', mut3)}>{placeholder}</span>
      <span className={cn('rounded-[4px] px-1 py-0 font-mono text-[10px] [border:1px_solid_var(--border)]', mut3)}>
        /
      </span>
    </AriaButton>
  );
}

export interface SidebarSectionProps {
  title?: ReactNode;
  children?: ReactNode;
}
export function SidebarSection({ title, children }: SidebarSectionProps) {
  const collapsed = useContext(SBCollapsedCtx);
  return (
    <div data-slot="sidebar-section">
      {title ? (
        collapsed ? (
          <div className="mx-1.5 my-2 h-px bg-border" />
        ) : (
          <div className={cn('px-[9px] pt-2.5 pb-1 text-[10px] font-bold tracking-[.6px] whitespace-nowrap uppercase', mut3)}>
            {title}
          </div>
        )
      ) : null}
      {children}
    </div>
  );
}

export interface SidebarItemProps {
  icon?: string | ReactNode;
  label?: string;
  badge?: ReactNode;
  active?: boolean;
  tone?: string;
  onPress?: () => void;
}
export function SidebarItem({ icon, label, badge, active, tone, onPress }: SidebarItemProps) {
  const collapsed = useContext(SBCollapsedCtx);
  const ic = typeof icon === 'string' ? <BIcon d={P[icon] || P['box']} size={15} sw={1.8} /> : icon;
  return (
    <AriaButton
      data-slot="sidebar-item"
      className={cn(
        'bl-sidebar-hl mx-0 my-px flex w-full cursor-pointer items-center gap-[9px] rounded-[8px] border-0 text-left font-ios text-[13px]',
        collapsed ? 'justify-center px-0 py-2' : 'justify-start px-[9px] py-1.5',
        active ? 'bg-secondary-strong' : 'bg-transparent',
        !tone && (active ? 'text-foreground' : mut),
        tone ? 'font-semibold' : 'font-normal',
      )}
      render={(props) => <button {...props} title={label} />}
      onPress={() => {
        vib([5]);
        onPress && onPress();
      }}
      // A caller-chosen tone colour.
      style={tone ? { color: tone } : undefined}
    >
      <span className="grid shrink-0">{ic}</span>
      {!collapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
      {!collapsed && badge != null && (
        <span className="rounded-[6px] bg-[rgba(10,132,255,.13)] px-1.5 py-px font-mono text-[10.5px] text-[#0A84FF]">
          {badge}
        </span>
      )}
    </AriaButton>
  );
}

Sidebar.Header = SidebarHeader;
Sidebar.Content = SidebarContent;
Sidebar.Footer = SidebarFooter;
Sidebar.Workspace = SidebarWorkspace;
Sidebar.Search = SidebarSearch;
Sidebar.Section = SidebarSection;
Sidebar.Item = SidebarItem;

export function SidebarTrigger({ style, className }: { style?: CSSProperties; className?: string }) {
  const c = useSidebar();
  return (
    <AriaButton
      data-slot="sidebar-trigger"
      className={cn('bui-hl grid cursor-pointer place-items-center rounded-[8px] border-0 bg-transparent p-1.5', mut, className)}
      onPress={c.toggle}
      aria-label="Toggle sidebar"
      style={style}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      </svg>
    </AriaButton>
  );
}

export function SidebarInset({ children, style, className }: { children?: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', className)}
      style={style}
    >
      {children}
    </div>
  );
}

/* SidebarNav — the pre-composed example, built from the primitives */
export interface SidebarNavProps {
  variant?: SidebarVariant;
}
export function SidebarNav({ variant = 'docked' }: SidebarNavProps) {
  const [cur, setCur] = useState('Home');
  const it = (icon: string, label: string, badge?: ReactNode) => (
    <SidebarItem key={label} icon={icon} label={label} badge={badge} active={cur === label} onPress={() => setCur(label)} />
  );
  return (
    <Sidebar variant={variant}>
      <SidebarHeader>
        <SidebarWorkspace name="Creamery Ops" detail="Production Workspace" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarSearch />
        <SidebarItem icon="plus" label="New task" tone={BLUE} />
        <SidebarSection title="Workspace">{[it('home', 'Home'), it('bolt', 'Agent tasks', 4), it('inbox', 'Inbox')]}</SidebarSection>
        <SidebarSection title="Objects">{[it('box', 'Suppliers'), it('box', 'Inventory')]}</SidebarSection>
      </SidebarContent>
    </Sidebar>
  );
}
