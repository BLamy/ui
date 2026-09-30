import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/workbench/util';
import { IconBtn } from '../../lib/workbench/icons';
import { Icon, type IconName } from '../../lib/icon';

/* ══ Terminal parts ══
   <TerminalHeader title="zsh — cookbook"><TerminalAction icon="rectangle-split"/><WorkbenchDockClose/></TerminalHeader>
   <TerminalBody seed={lines}/>
   Put them in a WorkbenchDock (inline dock ⇄ compact SnapSheet) or a SurfaceTerminal (panel). */
export interface TermLine {
  /** text */
  t: string;
  /** a prompt line (the command the user typed) */
  p?: boolean;
  /** color */
  c?: string;
}
/** The terminal's ANSI-style ink (fixed content colors, like a terminal theme): output text, the user, the cwd,
    success and link lines, errors. */
export const TERMINAL_COLORS = { text: '#D4D4DE', green: '#7EE0B8', blue: '#8AB4FF', red: '#FF8A80' } as const;
/* The same inks as utilities. */
const INK = { text: 'text-[#D4D4DE]', green: 'text-[#7EE0B8]', blue: 'text-[#8AB4FF]' } as const;

/** The demo echo shell: ls, pwd, echo, whoami, npm run dev, clear, help. */
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
      { t: '  VITE v6.0.3  ready in 412 ms', c: TERMINAL_COLORS.green },
      { t: '' },
      { t: '  ➜  Local:   http://localhost:3000/', c: TERMINAL_COLORS.blue },
    ];
  if (c === 'clear') return 'CLEAR';
  return [{ t: 'zsh: command not found: ' + c.split(' ')[0], c: TERMINAL_COLORS.red }];
}
export const TERM_FILES = ['package.json', 'src', 'blui.jsx', 'workbench.jsx', 'vite.config.js'];

export interface TerminalBodyProps {
  /** lines already in the scrollback */
  seed?: TermLine[];
  /** runs a command; return lines to print, or `'CLEAR'`. Defaults to the demo `fakeShell`. */
  run?: (cmd: string) => TermLine[] | 'CLEAR';
  /** prompt: `user cwd %` */
  user?: string;
  cwd?: string;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
/** A tiny interactive shell: scrollback, prompt, input. */
export function TerminalBody({ seed, run: runProp, user = 'dev@workbench', cwd = 'cookbook', autoFocus, className, style }: TerminalBodyProps) {
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
      <span className={INK.green}>{user}</span> <span className={INK.blue}>{cwd}</span> <span className="text-tertiary-foreground">%</span>
    </span>
  );
  const run = () => {
    const out = runProp ? runProp(val) : fakeShell(val, TERM_FILES);
    if (out === 'CLEAR') setHist([]);
    else setHist((h) => [...h, { t: val, p: true }, ...out]);
    setVal('');
  };
  return (
    <div
      ref={sc}
      data-slot="terminal-body"
      data-theme-scope="terminal"
      className={cn(
        'dark scheme-dark wb-scroll min-h-0 flex-1 cursor-text overflow-y-auto px-3.5 py-2.5 font-mono text-[12.5px] leading-[1.62]',
        INK.text,
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
          className={cn('whitespace-pre-wrap', l.c ? 'text-(color:--term-c)' : l.p ? INK.text : 'text-muted-foreground')}
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
          className="min-w-10 flex-1 border-0 bg-transparent p-0 [font:inherit] text-foreground outline-none"
        />
      </div>
    </div>
  );
}

export interface TerminalHeaderProps {
  title?: React.ReactNode;
  /** TerminalAction buttons (and a WorkbenchDockClose), at the end */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
/** Session title bar: icon, title, actions. */
export function TerminalHeader({ title = 'zsh', children, className, style }: TerminalHeaderProps) {
  return (
    <div data-slot="terminal-header" className={cn('flex shrink-0 items-center gap-1 border-b border-border py-[5px] pr-2 pl-3.5', className)} style={style}>
      <Icon name="terminal" size={14} sw={1.8} className="text-tertiary-foreground" />
      <span className="ml-1 text-[12px] font-semibold text-muted-foreground">{title}</span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function TerminalAction({ icon, label, onPress, className }: { icon: IconName | (string & {}); label: string; onPress?: () => void; className?: string }) {
  return (
    <IconBtn
      name={icon}
      label={label}
      size={15}
      className={className}
      onPress={() => {
        onPress?.();
      }}
    />
  );
}
