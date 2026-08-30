import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { cn, WFONT, EASE } from './util';
import { workbenchVars } from './theme';
import { SnapSheet } from './snap-sheet';

/* ══ WorkbenchShell — compositional IDE-scaffold container ══
   Owns width class + region state. Slots (children are ordinary elements — they read the shell with
   useWorkbenchShell(), never a ctx argument):
   Sidebar (column ⇄ overlay sheet) · Main · Dock (inline, ⇄ DockSheet in a SnapSheet when compact) ·
   Panel (column ⇄ drawer ⇄ fullscreen) · TabBar (compact only). */
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

type SlotChildren = React.ReactNode;
interface SlotProps {
  children?: SlotChildren;
}
type SlotComponent = React.FC<SlotProps> & { __wbSlot: string };
function wbSlot(name: string): SlotComponent {
  const S: React.FC<SlotProps> = () => null;
  (S as SlotComponent).__wbSlot = name;
  return S as SlotComponent;
}

export interface WorkbenchShellProps {
  tint?: string;
  /** initial/forced terminal visibility; `false` also disables the auto-open at regular width */
  terminal?: boolean | 'true' | null;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function WorkbenchShell(props: WorkbenchShellProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [wc, setWc] = useState<WorkbenchWidthClass>('regular');
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
  const roRef = useRef<ResizeObserver | null>(null);
  const attachRoot = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (!el) return;
    const apply = (w: number) => {
      if (w > 0) setWc(w < 760 ? 'compact' : w < 1120 ? 'medium' : 'regular');
    };
    apply(el.getBoundingClientRect().width);
    if (typeof ResizeObserver !== 'undefined') {
      roRef.current = new ResizeObserver((en) => apply(en[0].contentRect.width));
      roRef.current.observe(el);
    }
  };
  useEffect(
    () => () => {
      if (roRef.current) roRef.current.disconnect();
    },
    []
  );
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
  const slots: Record<string, SlotChildren> = {};
  React.Children.forEach(props.children, (c) => {
    if (React.isValidElement(c) && typeof c.type === 'function' && (c.type as SlotComponent).__wbSlot)
      slots[(c.type as SlotComponent).__wbSlot] = (c.props as SlotProps).children;
  });
  const get = (k: string): React.ReactNode => {
    const sl = slots[k];
    return sl == null ? null : sl;
  };
  const panelEl = get('panel');
  return (
    <WBShellCtx.Provider value={ctx}>
      <div
        ref={attachRoot}
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
          {!compact && side && slots['sidebar'] ? <div style={{ width: 242, flexShrink: 0, borderRight: '1px solid var(--wb-sep)' }}>{get('sidebar')}</div> : null}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--wb-bg)' }}>
            {get('main')}
            {!compact && term && slots['dock'] ? get('dock') : null}
          </div>
          {wc === 'regular' && panel && !full && panelEl ? (
            <div style={{ width: 'clamp(300px, 32%, 420px)', flexShrink: 0, borderLeft: '1px solid var(--wb-sep)' }}>{panelEl}</div>
          ) : null}
          {compact && tab === 'surface' && panelEl ? <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>{panelEl}</div> : null}
        </div>
        {compact ? get('tabbar') : null}
        {wc === 'medium' && !full && panelEl ? (
          <React.Fragment>
            <div
              onClick={() => setPanelOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 58,
                background: 'rgba(0,0,0,.45)',
                opacity: panel ? 1 : 0,
                pointerEvents: panel ? 'auto' : 'none',
                transition: 'opacity .32s ' + EASE,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: 'min(420px, 94%)',
                zIndex: 59,
                transform: panel ? 'none' : 'translateX(103%)',
                transition: 'transform .38s ' + EASE,
                borderLeft: '1px solid var(--wb-sep)',
                boxShadow: panel ? '0 0 44px rgba(0,0,0,.55)' : 'none',
              }}
            >
              {panelEl}
            </div>
          </React.Fragment>
        ) : null}
        {!compact && panel && full && panelEl ? <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>{panelEl}</div> : null}
        {compact && slots['docksheet'] ? (
          <SnapSheet open={term} onClose={() => setTermOpen(false)} snaps={[0.52, 0.93]} bg="#0C0C10">
            {get('docksheet')}
          </SnapSheet>
        ) : null}
        {compact && slots['sidebar'] ? (
          <React.Fragment>
            <div
              onClick={() => setSideSheet(false)}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 80,
                background: 'rgba(0,0,0,.45)',
                opacity: sideSheet ? 1 : 0,
                pointerEvents: sideSheet ? 'auto' : 'none',
                transition: 'opacity .32s ' + EASE,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 280,
                maxWidth: '84%',
                zIndex: 81,
                transform: sideSheet ? 'none' : 'translateX(-102%)',
                transition: 'transform .38s ' + EASE,
                boxShadow: sideSheet ? '0 0 44px rgba(0,0,0,.5)' : 'none',
              }}
            >
              {get('sidebar')}
            </div>
          </React.Fragment>
        ) : null}
      </div>
    </WBShellCtx.Provider>
  );
}
WorkbenchShell.Context = WBShellCtx;
WorkbenchShell.useShell = useWorkbenchShell;
WorkbenchShell.Sidebar = wbSlot('sidebar');
WorkbenchShell.Main = wbSlot('main');
WorkbenchShell.Dock = wbSlot('dock');
WorkbenchShell.DockSheet = wbSlot('docksheet');
WorkbenchShell.Panel = wbSlot('panel');
WorkbenchShell.TabBar = wbSlot('tabbar');
