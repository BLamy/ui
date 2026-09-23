/* ══ Sidebar system — one compositional API over every sidebar variant ══
   <SidebarProvider> owns open state + container width (useContainerWidth); <Sidebar variant="docked|rail|float|overlay">
   renders the same children in any behavior, and ANY variant becomes a hamburger overlay (EdgeDrawer) below the
   breakpoint. Styled in the workbench dark language: every colour reads a --wb-* token with a fallback. */
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { EdgeDrawer } from './edge-drawer';
import { useContainerWidth } from '../lib/container';
import { cn, EASE as BEASE } from '../lib/utils';

const BFONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
const BMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const BLUE = '#0A84FF';
const mut = 'var(--wb-label2, rgba(235,235,245,.6))';
const mut3 = 'var(--wb-label3, rgba(235,235,245,.34))';
const card = (extra?: CSSProperties): CSSProperties => ({
  background: 'var(--wb-card, #1C1C23)',
  border: '1px solid var(--wb-sep, rgba(255,255,255,.08))',
  borderRadius: 14,
  fontFamily: BFONT,
  ...extra,
});
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
        className={cn(className)}
        style={{
          display: 'flex',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: BFONT,
          background: 'var(--wb-bg, #141419)',
          ...style,
        }}
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>{children}</div>
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
        style={{ background: 'var(--wb-side, #101015)', borderRight: '1px solid var(--wb-sep)' }}
      >
        <div data-slot="sidebar" style={{ height: '100%' }}>{body}</div>
      </EdgeDrawer>
    );
  const w = collapsed ? railWidth : c.open ? width : 0;
  const float = variant === 'float';
  return (
    <div
      data-slot="sidebar"
      style={{
        width: w,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width .32s ' + BEASE,
        boxSizing: 'border-box',
        background: float ? 'transparent' : 'var(--wb-side, #101015)',
        borderRight: float ? 'none' : '1px solid var(--wb-sep)',
        padding: float ? 10 : 0,
      }}
    >
      <div
        style={{
          width: (collapsed ? railWidth : width) - (float ? 20 : 0),
          height: '100%',
          boxSizing: 'border-box',
          ...(float ? card({ background: 'var(--wb-side, #101015)', borderRadius: 14, overflow: 'hidden' }) : {}),
        }}
      >
        {body}
      </div>
    </div>
  );
}

export function SidebarHeader({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="sidebar-header" style={{ padding: '12px 10px 6px', flexShrink: 0 }}>
      {children}
    </div>
  );
}
export function SidebarContent({ children }: { children?: ReactNode }) {
  return (
    <div
      data-slot="sidebar-content"
      className="tk-scroll"
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '0 8px' }}
    >
      {children}
    </div>
  );
}
export function SidebarFooter({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="sidebar-footer" style={{ padding: 8, borderTop: '1px solid var(--wb-sep)', flexShrink: 0 }}>
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 2px 4px',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 800,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {initial || (name || 'W')[0]}
      </span>
      {!collapsed && (
        <div style={{ lineHeight: 1.15, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--wb-label)', whiteSpace: 'nowrap' }}>{name}</div>
          {detail && <div style={{ fontSize: 10.5, color: mut3, whiteSpace: 'nowrap' }}>{detail}</div>}
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
      <button
        data-slot="sidebar-search"
        className="tk-sidebar-hl"
        title={placeholder}
        onClick={onPress}
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          border: 0,
          borderRadius: 8,
          padding: '8px 0',
          background: 'none',
          color: mut3,
          cursor: 'pointer',
        }}
      >
        <BIcon d={P['search']} size={14} />
      </button>
    );
  return (
    <button
      data-slot="sidebar-search"
      className="tk-sidebar-hl"
      onClick={onPress}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        width: '100%',
        border: 0,
        background: 'var(--wb-fill)',
        borderRadius: 8,
        padding: '6px 9px',
        margin: '2px 0 4px',
        cursor: 'pointer',
        fontFamily: BFONT,
      }}
    >
      <span style={{ color: mut3, display: 'grid' }}>
        <BIcon d={P['search']} size={13} />
      </span>
      <span style={{ fontSize: 12, color: mut3, flex: 1, textAlign: 'left' }}>{placeholder}</span>
      <span
        style={{
          fontFamily: BMONO,
          fontSize: 10,
          color: mut3,
          border: '1px solid var(--wb-sep)',
          borderRadius: 4,
          padding: '0 4px',
        }}
      >
        /
      </span>
    </button>
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
          <div style={{ height: 1, background: 'var(--wb-sep)', margin: '8px 6px' }} />
        ) : (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.6px',
              textTransform: 'uppercase',
              color: mut3,
              padding: '10px 9px 4px',
              whiteSpace: 'nowrap',
            }}
          >
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
    <button
      data-slot="sidebar-item"
      className="tk-sidebar-hl"
      title={label}
      onClick={() => {
        vib([5]);
        onPress && onPress();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 9,
        width: '100%',
        border: 0,
        borderRadius: 8,
        padding: collapsed ? '8px 0' : '6px 9px',
        cursor: 'pointer',
        fontFamily: BFONT,
        textAlign: 'left',
        margin: '1px 0',
        background: active ? 'var(--wb-fill2)' : 'none',
        color: tone || (active ? 'var(--wb-label)' : mut),
        fontSize: 13,
        fontWeight: tone ? 600 : 400,
      }}
    >
      <span style={{ display: 'grid', flexShrink: 0 }}>{ic}</span>
      {!collapsed && (
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      )}
      {!collapsed && badge != null && (
        <span
          style={{
            fontFamily: BMONO,
            fontSize: 10.5,
            color: BLUE,
            background: 'rgba(10,132,255,.13)',
            borderRadius: 6,
            padding: '1px 6px',
          }}
        >
          {badge}
        </span>
      )}
    </button>
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
    <button
      data-slot="sidebar-trigger"
      className={cn('bui-hl', className)}
      onClick={c.toggle}
      aria-label="Toggle sidebar"
      style={{
        border: 0,
        background: 'none',
        color: mut,
        cursor: 'pointer',
        padding: 6,
        borderRadius: 8,
        display: 'grid',
        placeItems: 'center',
        ...style,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      </svg>
    </button>
  );
}

export function SidebarInset({ children, style, className }: { children?: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn(className)}
      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...style }}
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
