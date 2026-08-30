import * as React from 'react';
import { useState } from 'react';
import { cn, MONO } from './util';
import { vib, tick } from './haptics';
import { WIcon, IconBtn, type WIconName } from './icons';
import { TermBody } from './terminal';

/* ══ Surfaces (right panel) ══ */
export type SurfaceKind = 'browser' | 'terminal' | 'files' | 'diff' | 'agents';
export interface SurfaceMeta {
  k: SurfaceKind;
  icon: WIconName;
  name: string;
  blurb: string;
}
export const SURFACES: SurfaceMeta[] = [
  { k: 'browser', icon: 'globe', name: 'Browser', blurb: 'Open a local app or URL.' },
  { k: 'terminal', icon: 'term', name: 'Terminal', blurb: 'Start a shell in this workspace.' },
  { k: 'files', icon: 'files', name: 'Files', blurb: 'Browse and read workspace files.' },
  { k: 'diff', icon: 'diff', name: 'Diff', blurb: 'Review changes in this thread.' },
  { k: 'agents', icon: 'bot', name: 'Agents', blurb: 'Watch subagents and workflows run.' },
];

export function SurfaceEmpty({ onOpen }: { onOpen: (k: SurfaceKind) => void }) {
  return (
    <div
      data-slot="surface-empty"
      className="wb-scroll"
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '26px 20px' }}
    >
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 16.5, fontWeight: 650 }}>Open a surface</div>
        <div style={{ fontSize: 12.5, color: 'var(--wb-label2)', marginTop: 3 }}>Choose what to show in the right panel.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, maxWidth: 420, width: '100%', margin: '0 auto' }}>
        {SURFACES.map((s) => (
          <button
            key={s.k}
            type="button"
            className="wb-btn wb-hl"
            onClick={() => {
              vib([8]);
              onOpen(s.k);
            }}
            style={{ border: '1px solid var(--wb-sep)', background: 'var(--wb-card)', borderRadius: 13, padding: '15px 14px', cursor: 'pointer', textAlign: 'left', color: 'var(--wb-label)' }}
          >
            <WIcon name={s.icon} size={21} sw={1.6} style={{ color: 'var(--wb-label2)' }} />
            <div style={{ fontSize: 13.5, fontWeight: 650, marginTop: 10 }}>{s.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--wb-label2)', marginTop: 3, lineHeight: 1.45 }}>{s.blurb}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SurfaceBrowser() {
  return (
    <div data-slot="surface-browser" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: '1px solid var(--wb-sep)', flexShrink: 0 }}>
        <WIcon name="chevR" size={14} sw={2} style={{ color: 'var(--wb-label3)', transform: 'scaleX(-1)' }} />
        <WIcon name="chevR" size={14} sw={2} style={{ color: 'var(--wb-label3)', opacity: 0.4 }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--wb-fill)', borderRadius: 7, padding: '4px 9px', fontSize: 12, fontFamily: MONO, color: 'var(--wb-label2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wb-green)' }} />
          http://localhost:3000
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: '#101014', display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--wb-tint), #5E5CE6)', display: 'inline-grid', placeItems: 'center' }}>
            <WIcon name="spark" size={20} sw={2} style={{ color: '#fff' }} />
          </span>
          <div style={{ fontSize: 13.5, fontWeight: 650, marginTop: 12 }}>app-builder</div>
          <div style={{ fontSize: 12, color: 'var(--wb-label3)', marginTop: 3, fontFamily: MONO }}>serving on :3000 · pid 5229</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 16, justifyContent: 'center' }}>
            {[52, 76, 40].map((w, i) => (
              <span key={i} style={{ width: w, height: 8, borderRadius: 4, background: 'var(--wb-fill2)' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FILE_TREE: [string, number, 'folder' | 'doc'][] = [
  ['cookbook', 0, 'folder'],
  ['src', 1, 'folder'],
  ['components', 2, 'folder'],
  ['Credenza.tsx', 3, 'doc'],
  ['SideDrawer.tsx', 3, 'doc'],
  ['MessageScroller.tsx', 3, 'doc'],
  ['haptics.ts', 2, 'doc'],
  ['App.tsx', 2, 'doc'],
  ['touchkit.jsx', 1, 'doc'],
  ['workbench.jsx', 1, 'doc'],
  ['package.json', 1, 'doc'],
  ['vite.config.js', 1, 'doc'],
];
export function SurfaceFiles() {
  const [sel, setSel] = useState('App.tsx');
  return (
    <div data-slot="surface-files" className="wb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 10px' }}>
      {FILE_TREE.map(([name, depth, kind]) => (
        <button
          key={name}
          type="button"
          className="wb-btn wb-hl"
          onClick={() => {
            setSel(name);
            tick();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            width: '100%',
            padding: '4.5px 8px',
            paddingLeft: 8 + depth * 16,
            border: 0,
            borderRadius: 7,
            background: sel === name ? 'var(--wb-fill2)' : 'none',
            color: 'var(--wb-label)',
            fontSize: 12.5,
            fontFamily: kind === 'folder' ? 'inherit' : MONO,
            cursor: 'pointer',
            textAlign: 'left',
            boxSizing: 'border-box',
          }}
        >
          {kind === 'folder' ? <WIcon name="chevD" size={11} sw={2.4} style={{ color: 'var(--wb-label3)' }} /> : <span style={{ width: 11 }} />}
          <WIcon name={kind === 'folder' ? 'folder' : 'doc'} size={14.5} sw={1.7} style={{ color: kind === 'folder' ? '#8AB4FF' : 'var(--wb-label3)' }} />
          <span>{name}</span>
        </button>
      ))}
    </div>
  );
}

const DIFF_LINES: [string, string][] = [
  [' ', 'function Haptics.boot() {'],
  ['-', '  if (navigator.vibrate) return;          // skipped the polyfill'],
  ['-', '  import("https://esm.run/ios-vibrator-pro-max");'],
  ['+', '  if (stub) delete navigator.vibrate;     // clear blockers first'],
  ['+', '  import("…/ios-vibrator-pro-max@3.0.3/+esm");  // pinned'],
  ['+', '  window.addEventListener("tk-vib", report);'],
  [' ', '}'],
];
export function SurfaceDiff() {
  return (
    <div data-slot="surface-diff" className="wb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <WIcon name="doc" size={15} sw={1.8} style={{ color: 'var(--wb-label3)' }} />
        <span style={{ fontSize: 12.5, fontFamily: MONO }}>touchkit.jsx</span>
        <span style={{ fontSize: 11.5, fontFamily: MONO, color: 'var(--wb-green)' }}>+3</span>
        <span style={{ fontSize: 11.5, fontFamily: MONO, color: 'var(--wb-red)' }}>−2</span>
      </div>
      <div style={{ border: '1px solid var(--wb-sep)', borderRadius: 9, overflow: 'hidden' }}>
        {DIFF_LINES.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              fontFamily: MONO,
              fontSize: 11.5,
              lineHeight: 1.75,
              background: l[0] === '+' ? 'rgba(48,209,88,.11)' : l[0] === '-' ? 'rgba(255,69,58,.10)' : 'transparent',
            }}
          >
            <span style={{ width: 22, textAlign: 'center', flexShrink: 0, color: l[0] === '+' ? 'var(--wb-green)' : l[0] === '-' ? 'var(--wb-red)' : 'var(--wb-label3)' }}>{l[0]}</span>
            <span style={{ whiteSpace: 'pre', color: 'var(--wb-label2)' }}>{l[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const AGENTS = [
  { n: 'docs-writer', s: 'running', m: 'writing message-scroller.md · 2m 14s' },
  { n: 'test-runner', s: 'passed', m: '42 passed · 0 failed · 18s' },
  { n: 'lint', s: 'passed', m: 'no issues · 4s' },
  { n: 'bundle-size', s: 'queued', m: 'waiting on test-runner' },
];
export function SurfaceAgents() {
  return (
    <div data-slot="surface-agents" className="wb-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px' }}>
      {AGENTS.map((a) => (
        <div key={a.n} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, marginBottom: 4, background: 'var(--wb-card)', border: '1px solid var(--wb-sep)' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flexShrink: 0,
              background: a.s === 'running' ? 'var(--wb-tint)' : a.s === 'passed' ? 'var(--wb-green)' : 'var(--wb-label3)',
              animation: a.s === 'running' ? 'wbPulse 1.2s infinite' : 'none',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 650, fontFamily: MONO }}>{a.n}</div>
            <div style={{ fontSize: 11.5, color: 'var(--wb-label2)', marginTop: 1 }}>{a.m}</div>
          </div>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '.5px',
              textTransform: 'uppercase',
              color: a.s === 'running' ? 'var(--wb-tint)' : a.s === 'passed' ? 'var(--wb-green)' : 'var(--wb-label3)',
            }}
          >
            {a.s}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface SurfacePanelProps {
  kind?: SurfaceKind | null;
  onOpen: (k: SurfaceKind | null) => void;
  onClose?: () => void;
  full?: boolean;
  onFull?: (f: boolean) => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function SurfacePanel({ kind, onOpen, onClose, full, onFull, compact, className, style }: SurfacePanelProps) {
  const meta = SURFACES.find((s) => s.k === kind);
  return (
    <div
      data-slot="surface-panel"
      className={cn(className)}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--wb-side)', boxSizing: 'border-box', ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px 6px 14px', borderBottom: '1px solid var(--wb-sep)', flexShrink: 0, minHeight: 40, boxSizing: 'border-box' }}>
        {meta ? <WIcon name={meta.icon} size={15} sw={1.8} style={{ color: 'var(--wb-label2)' }} /> : null}
        <span style={{ fontSize: 13, fontWeight: 650, marginLeft: meta ? 6 : 0 }}>{meta ? meta.name : 'Surfaces'}</span>
        <span style={{ flex: 1 }} />
        {meta ? (
          <IconBtn
            name="chevD"
            label="Switch surface"
            size={15}
            onPress={() => {
              tick();
              onOpen(null);
            }}
          />
        ) : null}
        {!compact ? (
          <IconBtn
            name={full ? 'restore' : 'expand'}
            label={full ? 'Exit full screen' : 'Full screen'}
            size={16}
            onPress={() => {
              vib([8]);
              if (onFull) onFull(!full);
            }}
            active={full}
          />
        ) : null}
        <IconBtn name="x" label="Close panel" size={16} onPress={onClose} />
      </div>
      {kind === 'browser' ? (
        <SurfaceBrowser />
      ) : kind === 'terminal' ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#0C0C10' }}>
          <TermBody />
        </div>
      ) : kind === 'files' ? (
        <SurfaceFiles />
      ) : kind === 'diff' ? (
        <SurfaceDiff />
      ) : kind === 'agents' ? (
        <SurfaceAgents />
      ) : (
        <SurfaceEmpty onOpen={onOpen} />
      )}
    </div>
  );
}

export interface SurfaceTabBarProps {
  active: string;
  onPick: (k: string) => void;
  className?: string;
  style?: React.CSSProperties;
}
export function SurfaceTabBar({ active, onPick, className, style }: SurfaceTabBarProps) {
  const tabs = [{ k: 'chat', icon: 'msg' as WIconName, name: 'Chat' }, ...SURFACES.map((s) => ({ k: s.k as string, icon: s.icon, name: s.name }))];
  return (
    <div
      data-slot="surface-tab-bar"
      role="tablist"
      aria-label="Surfaces"
      className={className}
      style={{ display: 'flex', flexShrink: 0, borderTop: '1px solid var(--wb-sep)', background: 'var(--wb-side)', ...style }}
    >
      {tabs.map((t) => (
        <button
          key={t.k}
          type="button"
          className="wb-btn"
          role="tab"
          aria-selected={active === t.k}
          onClick={() => onPick(t.k)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 50,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            padding: '7px 0 6px',
            color: active === t.k ? 'var(--wb-tint)' : 'var(--wb-label3)',
          }}
        >
          <WIcon name={t.icon} size={20} sw={1.8} />
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.2px' }}>{t.name}</span>
        </button>
      ))}
    </div>
  );
}
