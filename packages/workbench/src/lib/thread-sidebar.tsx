import * as React from 'react';
import { useState } from 'react';
import { cn } from './util';
import { vib, tick } from './haptics';
import { WIcon, IconBtn } from './icons';

/* ══ Thread sidebar ══ */
export interface WorkbenchThread {
  id: string;
  title: string;
  age: string;
  settled?: boolean;
  msgs: WorkbenchMessage[];
}
export interface WorkbenchTrace {
  steps: string[];
  search?: [string, string][];
  code?: string;
}
export interface WorkbenchMessage {
  id: string;
  role: 'user' | 'assistant';
  md?: string;
  imgs?: string[];
  live?: boolean;
  meta?: string;
  trace?: WorkbenchTrace;
}

export interface ThreadSidebarProps {
  threads: WorkbenchThread[];
  cur?: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: () => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function ThreadSidebar({ threads, cur, onSelect, onNew, onClose, compact, className, style }: ThreadSidebarProps) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [openSec, setOpenSec] = useState(true);
  const list = threads.filter((t) => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()));
  const active = list.filter((t) => !t.settled),
    settled = list.filter((t) => t.settled);
  const shownSettled = showAll ? settled : settled.slice(0, 7);
  const row = (t: WorkbenchThread) => (
    <button
      key={t.id}
      type="button"
      className="wb-btn wb-hl"
      onClick={() => {
        tick();
        onSelect(t.id);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        border: 0,
        borderRadius: 8,
        background: cur === t.id ? 'var(--wb-fill2)' : 'transparent',
        color: 'var(--wb-label)',
        fontSize: 13,
        cursor: 'pointer',
        textAlign: 'left',
        boxSizing: 'border-box',
      }}
    >
      <WIcon name="msg" size={15} sw={1.8} style={{ color: 'var(--wb-label3)' }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
      <span style={{ fontSize: 11.5, color: 'var(--wb-label3)', flexShrink: 0 }}>{t.age}</span>
    </button>
  );
  return (
    <div
      data-slot="thread-sidebar"
      className={cn(className)}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: 'var(--wb-side)', ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 8px' }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'linear-gradient(135deg, var(--wb-tint), #5E5CE6)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <WIcon name="spark" size={13} sw={2.2} style={{ color: '#fff' }} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-.1px' }}>Workbench</span>
        {compact ? <IconBtn name="x" label="Close sidebar" onPress={onClose} style={{ marginLeft: 'auto' }} /> : null}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 12px 6px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--wb-fill)', borderRadius: 8, padding: '5px 8px' }}>
          <WIcon name="search" size={14} sw={2} style={{ color: 'var(--wb-label3)' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search threads"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'none', outline: 'none', color: 'var(--wb-label)', fontSize: 12.5, fontFamily: 'inherit' }}
          />
        </div>
        <IconBtn
          name="compose"
          label="New thread"
          onPress={() => {
            vib([8]);
            onNew();
          }}
          size={17}
        />
      </div>
      <button
        type="button"
        className="wb-btn wb-hl"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          margin: '0 8px',
          padding: '6px 8px',
          border: 0,
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--wb-label2)',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <WIcon name="folder" size={15} sw={1.8} />
        <span style={{ flex: 1 }}>All projects</span>
        <WIcon name="chevD" size={13} sw={2.2} />
        <WIcon name="folderP" size={15} sw={1.8} style={{ color: 'var(--wb-label3)' }} />
      </button>
      <div className="wb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 8px 8px' }}>
        {active.length ? (
          <React.Fragment>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px 4px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.4px', color: 'var(--wb-label3)' }}>Active</span>
              <span style={{ flex: 1, height: 1, background: 'var(--wb-sep)' }} />
            </div>
            {active.map(row)}
          </React.Fragment>
        ) : null}
        <button
          type="button"
          className="wb-btn"
          onClick={() => {
            setOpenSec((o) => !o);
            tick();
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 8px 4px', border: 0, background: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.4px', color: 'var(--wb-label3)' }}>Settled</span>
          <span style={{ flex: 1, height: 1, background: 'var(--wb-sep)' }} />
          <WIcon name={openSec ? 'chevU' : 'chevD'} size={12} sw={2.2} style={{ color: 'var(--wb-label3)' }} />
        </button>
        {openSec ? (
          <React.Fragment>
            {shownSettled.map(row)}
            {settled.length > shownSettled.length ? (
              <button
                type="button"
                className="wb-btn wb-hl"
                onClick={() => {
                  setShowAll(true);
                  tick();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  border: 0,
                  borderRadius: 8,
                  background: 'none',
                  color: 'var(--wb-label3)',
                  fontSize: 12.5,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <WIcon name="plus" size={13} sw={2} />
                <span>Show {settled.length - shownSettled.length} more</span>
              </button>
            ) : null}
          </React.Fragment>
        ) : null}
      </div>
      <div style={{ padding: '8px 10px 10px', borderTop: '1px solid var(--wb-sep)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 9, background: 'rgba(10,132,255,.12)', marginBottom: 6 }}>
          <WIcon name="dl" size={14} sw={2} style={{ color: 'var(--wb-tint)' }} />
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--wb-tint)' }}>Update available</span>
          <WIcon name="x" size={13} sw={2} style={{ color: 'var(--wb-label3)' }} />
        </div>
        <button
          type="button"
          className="wb-btn wb-hl"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '7px 8px',
            border: 0,
            borderRadius: 8,
            background: 'none',
            color: 'var(--wb-label2)',
            fontSize: 13,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <WIcon name="gear" size={16} sw={1.7} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
