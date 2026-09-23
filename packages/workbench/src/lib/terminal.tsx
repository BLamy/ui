import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { cn } from './util';
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
export const TERM_FILES = ['package.json', 'src', 'blui.jsx', 'workbench.jsx', 'vite.config.js'];

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
      <span className="text-[#7EE0B8]">dev@workbench</span> <span className="text-[#8AB4FF]">cookbook</span>{' '}
      <span className="text-wb-label3">%</span>
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
      className={cn(
        'wb-scroll min-h-0 flex-1 cursor-text overflow-y-auto px-3.5 py-2.5 font-mono text-[12.5px] leading-[1.62] text-[#D4D4DE]',
        className,
      )}
      onClick={() => {
        if (inp.current) inp.current.focus();
      }}
      style={style}
    >
      {hist.map((l, i) => (
        <div
          key={i}
          className={cn('whitespace-pre-wrap', l.c ? 'text-(color:--term-c)' : l.p ? 'text-[#D4D4DE]' : 'text-wb-label2')}
          // a line's own color comes with the data
          style={l.c ? ({ '--term-c': l.c } as React.CSSProperties) : undefined}
        >
          {l.p ? <span>{prompt} </span> : null}
          {l.t}
        </div>
      ))}
      <div className="flex items-baseline gap-[7px]">
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
          className="min-w-10 flex-1 border-0 bg-transparent p-0 [font:inherit] text-[#EDEDF2] outline-none"
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
      className={cn('flex shrink-0 items-center gap-1 border-b border-wb-sep py-[5px] pr-2 pl-3.5', className)}
      style={style}
    >
      <WIcon name="term" size={14} sw={1.8} className="text-wb-label3" />
      <span className="ml-1 text-[12px] font-semibold text-wb-label2">{title || 'zsh — cookbook'}</span>
      <span className="flex-1" />
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
      className={cn('relative flex h-(--dock-h) shrink-0 flex-col border-t border-wb-sep bg-[#0C0C10]', className)}
      // the dock height is user-resized at runtime
      style={{ '--dock-h': h + 'px', ...style } as React.CSSProperties}
    >
      <div
        data-slot="terminal-dock-resize"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="absolute -top-[3px] right-0 left-0 z-2 h-[7px] cursor-ns-resize touch-none"
      />
      <TermHeader onClose={onClose} />
      <TermBody seed={seed} />
    </div>
  );
}
