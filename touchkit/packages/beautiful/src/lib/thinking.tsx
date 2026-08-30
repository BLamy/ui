/* 02 — Thinking: compositional expandable trace — Thinking.Trigger / .Content / .Tabs / .Tab / .Panel / .Step / .Search / .Code */
import * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BEASE, BFONT, BIcon, BMONO, C, P, card, cn, mut, mut3, vib } from './base';

export interface ThinkingContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tab: string | null;
  setTab: React.Dispatch<React.SetStateAction<string | null>>;
  ensure: (id: string) => void;
}
export const ThinkCtx = createContext<ThinkingContextValue | null>(null);
export function useThinking() {
  const c = useContext(ThinkCtx);
  if (!c) throw new Error('Thinking.* must be rendered inside <Thinking>');
  return c;
}

export interface ThinkingProps {
  defaultOpen?: boolean;
  defaultTab?: string | null;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function Thinking({ defaultOpen = true, defaultTab = null, children, style, className }: ThinkingProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<string | null>(defaultTab);
  const ensure = (id: string) => setTab((t) => (t == null ? id : t));
  return (
    <ThinkCtx.Provider value={{ open, setOpen, tab, setTab, ensure }}>
      <div data-slot="thinking" className={cn(className)} style={card({ overflow: 'hidden', maxWidth: 520, ...style })}>
        {children}
      </div>
    </ThinkCtx.Provider>
  );
}

export interface ThinkingTriggerProps {
  icon?: ReactNode;
  children?: ReactNode;
}
export function ThinkingTrigger({ icon, children }: ThinkingTriggerProps) {
  const c = useThinking();
  return (
    <button
      data-slot="thinking-trigger"
      className="bui-hl"
      onClick={() => {
        c.setOpen((o) => !o);
        vib([6]);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        border: 0,
        background: 'none',
        color: 'var(--wb-label)',
        padding: '10px 14px',
        cursor: 'pointer',
        fontFamily: BFONT,
        textAlign: 'left',
      }}
    >
      <span style={{ color: C.purple, display: 'grid' }}>{icon || <BIcon d={P['spark']} size={15} />}</span>
      <span style={{ fontSize: 13, fontWeight: 650, flex: 1 }}>{children}</span>
      <span
        style={{
          color: mut3,
          display: 'grid',
          transform: c.open ? 'rotate(180deg)' : 'none',
          transition: 'transform .3s ' + BEASE,
        }}
      >
        <BIcon d={P['chevD']} size={15} />
      </span>
    </button>
  );
}

export function ThinkingContent({ children }: { children?: ReactNode }) {
  const c = useThinking();
  return (
    <div
      data-slot="thinking-content"
      style={{
        display: 'grid',
        gridTemplateRows: c.open ? '1fr' : '0fr',
        transition: 'grid-template-rows .35s ' + BEASE,
      }}
    >
      <div style={{ overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

export function ThinkingTabs({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="thinking-tabs" style={{ display: 'flex', gap: 4, padding: '0 12px 8px', flexWrap: 'wrap' }}>
      {children}
    </div>
  );
}

export interface ThinkingTabProps {
  id: string;
  children?: ReactNode;
}
export function ThinkingTab({ id, children }: ThinkingTabProps) {
  const c = useThinking();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    c.ensure(id);
  }, []);
  const on = c.tab === id;
  return (
    <button
      data-slot="thinking-tab"
      className="bui-hl"
      onClick={() => {
        c.setTab(id);
        vib([4]);
      }}
      style={{
        border: 0,
        borderRadius: 7,
        padding: '4px 10px',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: BFONT,
        background: on ? 'var(--wb-fill2)' : 'none',
        color: on ? 'var(--wb-label)' : mut,
      }}
    >
      {children}
    </button>
  );
}

export interface ThinkingPanelProps {
  id: string;
  children?: ReactNode;
}
export function ThinkingPanel({ id, children }: ThinkingPanelProps) {
  const c = useThinking();
  if (c.tab !== id) return null;
  return (
    <div
      data-slot="thinking-panel"
      style={{
        padding: '2px 14px 14px',
        fontSize: 12.5,
        lineHeight: 1.6,
        color: mut,
        animation: 'bui-in .25s ' + BEASE,
      }}
    >
      {children}
    </div>
  );
}

export interface ThinkingStepProps {
  done?: boolean;
  children?: ReactNode;
}
export function ThinkingStep({ done, children }: ThinkingStepProps) {
  return (
    <div data-slot="thinking-step" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
      {done ? (
        <span style={{ color: C.green, display: 'grid' }}>
          <BIcon d={P['check']} size={13} sw={2.4} />
        </span>
      ) : (
        <span
          style={{
            width: 13,
            height: 13,
            border: '2px solid var(--wb-fill2)',
            borderTopColor: C.blue,
            borderRadius: '50%',
            animation: 'bui-spin .8s linear infinite',
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ color: done ? mut : 'var(--wb-label)' }}>{children}</span>
    </div>
  );
}

export interface ThinkingSearchProps {
  site?: ReactNode;
  children?: ReactNode;
}
export function ThinkingSearch({ site, children }: ThinkingSearchProps) {
  return (
    <div data-slot="thinking-search" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
      <span style={{ color: mut3, display: 'grid' }}>
        <BIcon d={P['globe']} size={13} />
      </span>
      <span style={{ fontFamily: BMONO, fontSize: 11.5, color: C.teal }}>{site}</span>
      <span>{children}</span>
    </div>
  );
}

export function ThinkingCode({ children }: { children?: ReactNode }) {
  return (
    <pre
      data-slot="thinking-code"
      style={{
        margin: 0,
        fontFamily: BMONO,
        fontSize: 11.5,
        background: '#101014',
        borderRadius: 9,
        padding: '10px 12px',
        color: '#D8D8E2',
        overflow: 'auto',
      }}
    >
      {children}
    </pre>
  );
}

Thinking.Trigger = ThinkingTrigger;
Thinking.Content = ThinkingContent;
Thinking.Tabs = ThinkingTabs;
Thinking.Tab = ThinkingTab;
Thinking.Panel = ThinkingPanel;
Thinking.Step = ThinkingStep;
Thinking.Search = ThinkingSearch;
Thinking.Code = ThinkingCode;
