/* 14 — Sidebar system: one compositional API over every sidebar variant.
   <SidebarProvider> owns open state + container-width detection; <Sidebar variant="docked|rail|float|overlay">
   renders the same children in any behavior, and ANY variant becomes a hamburger overlay below the breakpoint. */
import * as React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, BMONO, C, P, card, cn, mut, mut3, vib } from './base';

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
  const ref = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setNarrow(el.offsetWidth < breakpoint));
    ro.observe(el);
    return () => ro.disconnect();
  }, [breakpoint]);
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
      <React.Fragment>
        <div
          onClick={() => c.setOpen(false)}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            background: 'rgba(0,0,0,.45)',
            opacity: c.open ? 1 : 0,
            pointerEvents: c.open ? 'auto' : 'none',
            transition: 'opacity .3s',
          }}
        />
        <div
          data-slot="sidebar"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width,
            zIndex: 21,
            background: 'var(--wb-side, #101015)',
            borderRight: '1px solid var(--wb-sep)',
            transform: c.open ? 'none' : 'translateX(-102%)',
            transition: 'transform .38s ' + BEASE,
            boxShadow: c.open ? '0 0 44px rgba(0,0,0,.4)' : 'none',
          }}
        >
          {body}
        </div>
      </React.Fragment>
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
      className="wb-scroll"
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
        className="bui-hl"
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
      className="bui-hl"
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
      className="bui-hl"
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
            color: C.blue,
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
        <SidebarItem icon="plus" label="New task" tone={C.blue} />
        <SidebarSection title="Workspace">{[it('home', 'Home'), it('bolt', 'Agent tasks', 4), it('inbox', 'Inbox')]}</SidebarSection>
        <SidebarSection title="Objects">{[it('box', 'Suppliers'), it('box', 'Inventory')]}</SidebarSection>
      </SidebarContent>
    </Sidebar>
  );
}
