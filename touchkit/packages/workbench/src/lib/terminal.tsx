import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { cn, MONO } from './util';
import { tick } from './haptics';
import { WIcon, IconBtn } from './icons';

/* ══ Terminal ══ */
export interface TermLine {
  t: string;
  p?: boolean;
  c?: string;
}
export function fakeShell(cmd: string, files: string[]): TermLine[] | 'CLEAR' {
  const c = cmd.trim();
  if (!c) return [];
  if (c === 'help') return ['available: ls, pwd, echo, whoami, npm run dev, clear'].map((t) => ({ t }));
  if (c === 'ls') return [{ t: files.join('   ') }];
  if (c === 'pwd') return [{ t: '/Users/dev/cookbook' }];
  if (c === 'whoami') return [{ t: 'dev' }];
  if (c.startsWith('echo ')) return [{ t: c.slice(5) }];
  if (c === 'npm run dev')
    return [
      { t: '> cookbook@0.1.0 dev' },
      { t: '> vite' },
      { t: '' },
      { t: '  VITE v6.0.3  ready in 412 ms', c: '#7EE0B8' },
      { t: '' },
      { t: '  ➜  Local:   http://localhost:3000/', c: '#8AB4FF' },
    ];
  if (c === 'clear') return 'CLEAR';
  return [{ t: 'zsh: command not found: ' + c.split(' ')[0], c: '#FF8A80' }];
}
export const TERM_FILES = ['package.json', 'src', 'touchkit.jsx', 'workbench.jsx', 'vite.config.js'];

export interface TermBodyProps {
  seed?: TermLine[];
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
export function TermBody({ seed, autoFocus, className, style }: TermBodyProps) {
  const [hist, setHist] = useState<TermLine[]>(seed || []);
  const [val, setVal] = useState('');
  const sc = useRef<HTMLDivElement>(null),
    inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = sc.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hist]);
  const prompt = (
    <span>
      <span style={{ color: '#7EE0B8' }}>dev@workbench</span> <span style={{ color: '#8AB4FF' }}>cookbook</span>{' '}
      <span style={{ color: 'var(--wb-label3)' }}>%</span>
    </span>
  );
  const run = () => {
    const out = fakeShell(val, TERM_FILES);
    if (out === 'CLEAR') setHist([]);
    else setHist((h) => [...h, { t: val, p: true }, ...out]);
    setVal('');
    tick();
  };
  return (
    <div
      ref={sc}
      data-slot="term-body"
      className={cn('wb-scroll', className)}
      onClick={() => {
        if (inp.current) inp.current.focus();
      }}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px', fontFamily: MONO, fontSize: 12.5, lineHeight: 1.62, color: '#D4D4DE', cursor: 'text', ...style }}
    >
      {hist.map((l, i) => (
        <div key={i} style={{ whiteSpace: 'pre-wrap', color: l.c || (l.p ? '#D4D4DE' : 'var(--wb-label2)') }}>
          {l.p ? <span>{prompt} </span> : null}
          {l.t}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
        {prompt}
        <input
          ref={inp}
          value={val}
          autoFocus={autoFocus}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
          }}
          aria-label="Terminal input"
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          style={{ flex: 1, minWidth: 40, border: 0, background: 'none', outline: 'none', color: '#EDEDF2', font: 'inherit', padding: 0 }}
        />
      </div>
    </div>
  );
}

export interface TermHeaderProps {
  onClose?: () => void;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}
export function TermHeader({ onClose, title, className, style }: TermHeaderProps) {
  return (
    <div
      data-slot="term-header"
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px 5px 14px', flexShrink: 0, borderBottom: '1px solid var(--wb-sep)', ...style }}
    >
      <WIcon name="term" size={14} sw={1.8} style={{ color: 'var(--wb-label3)' }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--wb-label2)', marginLeft: 4 }}>{title || 'zsh — cookbook'}</span>
      <span style={{ flex: 1 }} />
      <IconBtn name="split" label="Split terminal" size={15} onPress={tick} />
      <IconBtn name="plus" label="New terminal" size={15} onPress={tick} />
      <IconBtn name="trash" label="Close terminal" size={15} onPress={onClose} />
    </div>
  );
}

export interface TerminalDockProps {
  h: number;
  setH: (h: number) => void;
  onClose?: () => void;
  seed?: TermLine[];
  className?: string;
  style?: React.CSSProperties;
}
export function TerminalDock({ h, setH, onClose, seed, className, style }: TerminalDockProps) {
  const st = useRef<{ y0: number; h0: number } | null>(null);
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    st.current = { y0: e.clientY, h0: h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!st.current) return;
    setH(Math.min(520, Math.max(110, st.current.h0 - (e.clientY - st.current.y0))));
  };
  const up = () => {
    st.current = null;
  };
  return (
    <div
      data-slot="terminal-dock"
      className={className}
      style={{ height: h, flexShrink: 0, position: 'relative', background: '#0C0C10', borderTop: '1px solid var(--wb-sep)', display: 'flex', flexDirection: 'column', ...style }}
    >
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ position: 'absolute', top: -3, left: 0, right: 0, height: 7, cursor: 'ns-resize', zIndex: 2, touchAction: 'none' }}
      />
      <TermHeader onClose={onClose} />
      <TermBody seed={seed} />
    </div>
  );
}
