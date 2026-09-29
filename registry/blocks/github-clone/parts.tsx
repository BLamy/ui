/* Small GitHub-flavoured pieces the page composes: the palette, octicon-style glyphs, label chips, state icons,
   underline tabs, a line-numbered code view, a unified diff view and a file tree. Code is highlighted by the
   library's SyntaxHighlighting (gpu-lexer on WebGPU), recolored with Primer's syntax palette below. */
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Avatar, Icon, SyntaxHighlighting, SyntaxTokens, TabViewIndicator, TabViewPanel, TabViewTab, cn, languageFromPath, useSyntaxTokens, type IconName,
} from '@brett_lamy/ui';
import type { FileNode, Label, PullRequest, User } from './data';

/* ── Palette ──
   BLProvider and WorkbenchTheme take a `style`; these override their tokens with GitHub's Primer colors so
   every bl-* / wb-* utility (and the library parts) pick them up. The --gh-* extras are the diff / state colors. */
export function githubVars(dark: boolean): CSSProperties {
  const c = dark
    ? {
        bg: '#0d1117', bg2: '#151b23', inset: '#010409', label: '#f0f6fc', label2: '#9198a1', label3: '#656c76',
        sep: '#3d444d', fill: 'rgba(101,108,118,.2)', fill2: 'rgba(101,108,118,.4)', tint: '#4493f8', green: '#3fb950', red: '#f85149',
      }
    : {
        bg: '#ffffff', bg2: '#f6f8fa', inset: '#f6f8fa', label: '#1f2328', label2: '#59636e', label3: '#818b98',
        sep: '#d1d9e0', fill: 'rgba(129,139,152,.12)', fill2: 'rgba(129,139,152,.22)', tint: '#0969da', green: '#1a7f37', red: '#d1242f',
      };
  return {
    '--background': c.bg, '--muted': c.bg2, '--card': c.bg, '--popover': c.bg2, '--foreground': c.label,
    '--muted-foreground': c.label2, '--tertiary-foreground': c.label3, '--border': c.sep, '--secondary': c.fill, '--secondary-strong': c.fill2,
    '--accent': c.fill, '--bar': c.bg, '--sticky': c.bg, '--sidebar': c.inset, '--primary': c.tint,
    '--success': c.green, '--destructive': c.red,
    '--background': c.bg, '--sidebar': c.bg2, '--card': c.bg, '--popover': c.bg2, '--border': c.sep, '--secondary': c.fill,
    '--secondary-strong': c.fill2, '--foreground': c.label, '--muted-foreground': c.label2, '--tertiary-foreground': c.label3, '--primary': c.tint,
    '--wb-shadow': dark ? 'rgba(1,4,9,.5)' : 'rgba(31,35,40,.06)',
    '--mdc-code': dark ? 'rgba(101,108,118,.2)' : 'rgba(129,139,152,.12)', '--mdc-pre': c.bg2, '--mdc-pre-fg': c.label,
    '--mdc-border': c.sep, '--mdc-mut': c.label2, '--mdc-card': c.bg, '--mdc-muted': c.bg2,
    '--wb-hl-kw': dark ? '#ff7b72' : '#cf222e', '--wb-hl-str': dark ? '#a5d6ff' : '#0a3069', '--wb-hl-num': dark ? '#79c0ff' : '#0550ae',
    '--wb-hl-com': dark ? '#9198a1' : '#59636e', '--wb-hl-fn': dark ? '#d2a8ff' : '#8250df', '--wb-hl-tag': dark ? '#7ee787' : '#116329',
    '--wb-hl-attr': dark ? '#ffa657' : '#953800', '--wb-hl-punc': c.label, '--wb-hl-id': c.label,
    /* SyntaxHighlighting tokens → Primer's prettylights palette. */
    '--bl-syntax-keyword': dark ? '#ff7b72' : '#cf222e', '--bl-syntax-operator': c.label,
    '--bl-syntax-string': dark ? '#a5d6ff' : '#0a3069', '--bl-syntax-number': dark ? '#79c0ff' : '#0550ae',
    '--bl-syntax-constant': dark ? '#79c0ff' : '#0550ae', '--bl-syntax-comment': dark ? '#9198a1' : '#59636e',
    '--bl-syntax-comment-style': 'normal', '--bl-syntax-function': dark ? '#d2a8ff' : '#8250df',
    '--bl-syntax-type': dark ? '#ffa657' : '#953800', '--bl-syntax-fg': c.label, '--bl-syntax-surface': c.bg,
    '--bl-syntax-line-number': c.label3,
    '--bl-syntax-highlight': dark ? 'rgba(187,128,9,.15)' : '#fff8c5', '--bl-syntax-highlight-bar': dark ? '#9e6a03' : '#d4a72c',
    /* Docstream (MarkdownView) draws h2 rules with the shadcn --border token directly. */
    '--border': c.sep,
    '--gh-inset': c.inset,
    '--gh-open': dark ? '#3fb950' : '#1a7f37', '--gh-done': dark ? '#ab7df8' : '#8250df', '--gh-closed': dark ? '#f85149' : '#d1242f',
    '--gh-attention': dark ? '#d29922' : '#9a6700', '--gh-btn': dark ? '#212830' : '#f6f8fa', '--gh-btn-hover': dark ? '#262c36' : '#eff2f5',
    '--gh-add': dark ? 'rgba(46,160,67,.15)' : '#dafbe1', '--gh-add-num': dark ? 'rgba(63,185,80,.3)' : '#aceebb',
    '--gh-del': dark ? 'rgba(248,81,73,.1)' : '#ffebe9', '--gh-del-num': dark ? 'rgba(248,81,73,.3)' : '#ffcecb',
    '--gh-hunk': dark ? 'rgba(56,139,253,.1)' : '#ddf4ff', '--gh-hunk-fg': c.label2,
    '--gh-tab': '#fd8c73', '--gh-folder': dark ? '#7d8590' : '#54aeff',
  } as CSSProperties;
}

/* ── Octicon-style glyphs (16px grid, drawn for this block) ──
   GitHub's domain marks (repo, branch, PR, issue, CI states…) are drawn here; generic UI glyphs come from the
   library's Icon (regular weight at 1.25× lands on the octicons' 1.5px stroke). */
const GENERIC = {
  check: 'check', x: 'xmark', chevDown: 'chevron-down', chevRight: 'chevron-right', chevLeft: 'chevron-left',
  search: 'magnifyingglass', plus: 'plus', bell: 'bell', menu: 'menu', link: 'link', gear: 'gear', copy: 'copy',
  kebab: 'ellipsis', sidebar: 'sidebar', star: 'star',
} as const satisfies Record<string, IconName>;
const OCT: Record<string, ReactNode> = {
  code: <path d="M5.2 4.2 1.5 8l3.7 3.8M10.8 4.2 14.5 8l-3.7 3.8" />,
  issue: <><circle cx="8" cy="8" r="6.25" /><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" /></>,
  issueClosed: <><circle cx="8" cy="8" r="6.25" /><path d="m5.4 8.2 1.8 1.8 3.4-3.6" /></>,
  pr: <><circle cx="4" cy="3.5" r="1.7" /><circle cx="4" cy="12.5" r="1.7" /><circle cx="12" cy="12.5" r="1.7" /><path d="M4 5.2v5.6M12 10.8V6.5A2.2 2.2 0 0 0 9.8 4.3H7.4M8.9 2.6 7.2 4.3 8.9 6" /></>,
  prDraft: <><circle cx="4" cy="3.5" r="1.7" /><circle cx="4" cy="12.5" r="1.7" /><circle cx="12" cy="12.5" r="1.7" /><path d="M4 5.2v5.6M12 3.2v.4M12 6.4v.4M12 9.4v.4" /></>,
  merged: <><circle cx="4" cy="3.5" r="1.7" /><circle cx="4" cy="12.5" r="1.7" /><circle cx="12" cy="8.5" r="1.7" /><path d="M4 5.2v5.6M4 5.2c0 2.2 1.6 3.3 3.6 3.3h2.7" /></>,
  prClosed: <><circle cx="4" cy="3.5" r="1.7" /><circle cx="4" cy="12.5" r="1.7" /><circle cx="12" cy="12.5" r="1.7" /><path d="M4 5.2v5.6M12 10.8V7.6M10.4 2.2l3.2 3.2M13.6 2.2l-3.2 3.2" /></>,
  play: <><circle cx="8" cy="8" r="6.25" /><path d="M6.6 5.4v5.2L10.6 8z" fill="currentColor" /></>,
  eye: <><path d="M1.2 8S3.6 3.3 8 3.3 14.8 8 14.8 8 12.4 12.7 8 12.7 1.2 8 1.2 8z" /><circle cx="8" cy="8" r="2" /></>,
  fork: <><circle cx="4" cy="3" r="1.6" /><circle cx="12" cy="3" r="1.6" /><circle cx="8" cy="13" r="1.6" /><path d="M4 4.6v.9A1.8 1.8 0 0 0 5.8 7.3h4.4A1.8 1.8 0 0 0 12 5.5v-.9M8 7.3v4.1" /></>,
  book: <path d="M1.8 2.8h3.7A2.5 2.5 0 0 1 8 5.3v8.2a2 2 0 0 0-2-2H1.8zM14.2 2.8h-3.7A2.5 2.5 0 0 0 8 5.3v8.2a2 2 0 0 1 2-2h4.2z" />,
  file: <><path d="M3.5 1.8h5.8l3.2 3.2v9.2h-9z" /><path d="M9.2 1.8v3.3h3.3" /></>,
  folder: <path d="M1.5 3.2c0-.5.4-.9.9-.9h3.7l1.5 1.8h6c.5 0 .9.4.9.9v7.8c0 .5-.4.9-.9.9H2.4a.9.9 0 0 1-.9-.9z" fill="currentColor" stroke="none" />,
  branch: <><circle cx="4.5" cy="3.2" r="1.6" /><circle cx="4.5" cy="12.8" r="1.6" /><circle cx="11.5" cy="4.5" r="1.6" /><path d="M4.5 4.8v6.4M11.5 6.1c0 2.7-2.4 3-5 3.6a3 3 0 0 0-2 1.5" /></>,
  tag: <><path d="M1.8 2.6v4.8l6.9 6.9 5.6-5.6-6.9-6.9H2.6z" /><circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" /></>,
  history: <><path d="M2.2 8a5.8 5.8 0 1 0 1.7-4.1L2.2 5.6M2.2 2.2v3.4h3.4" /><path d="M8 5v3.3l2.2 1.4" /></>,
  comment: <path d="M2.3 3.3c0-.6.5-1 1-1h9.4c.6 0 1 .4 1 1v6.4c0 .6-.4 1-1 1H7.4L4.3 13.5v-2.8h-1c-.5 0-1-.4-1-1z" />,
  checkFill: <><circle cx="8" cy="8" r="7" fill="currentColor" stroke="none" /><path d="m4.9 8.2 2.1 2.1 4.1-4.3" stroke="var(--background)" strokeWidth="1.7" /></>,
  xFill: <><circle cx="8" cy="8" r="7" fill="currentColor" stroke="none" /><path d="m5.6 5.6 4.8 4.8m0-4.8-4.8 4.8" stroke="var(--background)" strokeWidth="1.7" /></>,
  stopFill: <><circle cx="8" cy="8" r="7" fill="currentColor" stroke="none" /><path d="M5.3 8h5.4" stroke="var(--background)" strokeWidth="1.7" /></>,
  dotFill: <><circle cx="8" cy="8" r="6.2" /><circle cx="8" cy="8" r="3" fill="currentColor" stroke="none" /></>,
  law: <path d="M8 1.8v12.4M3.5 14.2h9M2 4.2h12M4 4.2 1.8 9.3a2.2 2.2 0 0 0 4.4 0zM12 4.2l-2.2 5.1a2.2 2.2 0 0 0 4.4 0z" />,
  pulse: <path d="M1.2 8h3l1.8-4.5 3.4 9 1.8-4.5h3.6" />,
  commit: <><circle cx="8" cy="8" r="2.6" /><path d="M1 8h4.4M10.6 8H15" /></>,
  desktop: <><rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.2" /><path d="M5.5 13.8h5M8 11v2.8" /></>,
  zip: <><path d="M3.5 1.8h5.8l3.2 3.2v9.2h-9z" /><path d="M7 3v1.2M7 5.4v1.2M7 7.8V9" /></>,
  eyeClosed: <path d="M1.8 6.2S4 9.8 8 9.8s6.2-3.6 6.2-3.6M3.8 8.5l-1.2 1.8M12.2 8.5l1.2 1.8M8 9.8v2" />,
  shield: <path d="M8 1.5 2.8 3.4v4c0 3.2 2.2 5.8 5.2 7.1 3-1.3 5.2-3.9 5.2-7.1v-4z" />,
  people: <><circle cx="5.8" cy="5.2" r="2.3" /><path d="M1.6 13.3a4.2 4.2 0 0 1 8.4 0M10.8 3.2a2.2 2.2 0 0 1 0 4.2M12 9.4a3.6 3.6 0 0 1 2.4 3.4" /></>,
  inbox: <path d="M1.8 9.2 3.6 3.3c.1-.4.5-.8 1-.8h6.8c.5 0 .9.4 1 .8l1.8 5.9v3.3c0 .6-.4 1-1 1H2.8c-.6 0-1-.4-1-1zM1.8 9.2h3.6l1 1.8h3.2l1-1.8h3.6" />,
};
export type OctName = keyof typeof OCT | keyof typeof GENERIC;

export function Oct({ name, size = 16, className, style }: { name: OctName; size?: number; className?: string; style?: CSSProperties }) {
  // Icon's 24px grid pads its glyphs more than the 16px octicons: draw 25% larger inside the same box.
  if (name in GENERIC)
    return <Icon name={GENERIC[name as keyof typeof GENERIC]} size={size * 1.25} className={cn('inline-block', className)}
      style={{ margin: size * -0.125, ...style }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" className={cn('inline-block shrink-0', className)} style={style}>
      {OCT[name]}
    </svg>
  );
}

/** The block's logo mark (a stand-in for the host's logo). */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0 text-foreground">
      <circle cx="16" cy="16" r="15" fill="currentColor" />
      <ellipse cx="16" cy="16" rx="10.5" ry="4.6" fill="none" stroke="var(--background)" strokeWidth="2.2" transform="rotate(-28 16 16)" />
      <circle cx="16" cy="16" r="3.6" fill="var(--background)" />
    </svg>
  );
}

/* ── Label chip ── light: the label color as a fill; dark: a tinted chip with a lighter label, like GitHub. */
function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
export function LabelChip({ label, dark, className }: { label: Label; dark: boolean; className?: string }) {
  const [r, g, b] = rgb(label.color);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const lift = (v: number) => Math.round(v + (255 - v) * (lum < 0.5 ? 0.45 : 0.15));
  const style: CSSProperties = dark
    ? { background: `rgba(${r},${g},${b},.18)`, color: `rgb(${lift(r)},${lift(g)},${lift(b)})`, boxShadow: `inset 0 0 0 1px rgba(${r},${g},${b},.4)` }
    : { background: label.color, color: lum > 0.6 ? '#1f2328' : '#fff' };
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full px-[7px] text-[12px] leading-none font-medium whitespace-nowrap', className)} style={style}>
      {label.name}
    </span>
  );
}

/* ── Issue / PR state glyphs and pills ── */
const STATE: Record<string, { icon: OctName; color: string; label: string }> = {
  open: { icon: 'issue', color: 'var(--gh-open)', label: 'Open' },
  closed: { icon: 'issueClosed', color: 'var(--gh-done)', label: 'Closed' },
  prOpen: { icon: 'pr', color: 'var(--gh-open)', label: 'Open' },
  merged: { icon: 'merged', color: 'var(--gh-done)', label: 'Merged' },
  prClosed: { icon: 'prClosed', color: 'var(--gh-closed)', label: 'Closed' },
  draft: { icon: 'prDraft', color: 'var(--muted-foreground)', label: 'Draft' },
};
export type StateKind = keyof typeof STATE;

export function StateIcon({ state, className }: { state: StateKind; className?: string }) {
  const s = STATE[state];
  return <Oct name={s.icon} className={className} style={{ color: s.color }} />;
}

export function StatePill({ state }: { state: StateKind }) {
  const s = STATE[state];
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-white"
      style={{ background: state === 'draft' ? '#59636e' : state === 'prOpen' || state === 'open' ? '#1f883d' : s.color }}>
      <Oct name={s.icon} />
      {s.label}
    </span>
  );
}

/** A small gray count bubble (tab counts, button counts). */
export function Counter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary-strong px-1.5 text-[12px] leading-none font-medium text-foreground', className)}>
      {children}
    </span>
  );
}

/** Overlapping avatars (assignees, contributors). */
export function AvatarStack({ users, size = 20 }: { users: User[]; size?: number }) {
  return (
    <span className="flex">
      {users.map((u, i) => (
        <Avatar key={u.login} c={u} size={size} className="ring-2 ring-background" style={{ marginLeft: i ? -size / 3 : 0 }} />
      ))}
    </span>
  );
}

/* ── Underline tabs ── a TabViewTab styled as GitHub's UnderlineNav: icon, label, count, coral underline. */
export function UnderlineTab({ id, icon, label, count }: { id: string; icon?: OctName; label: string; count?: ReactNode }) {
  return (
    <TabViewTab id={id} textValue={label} className="group relative flex shrink-0 items-center py-2 outline-none data-selected:font-semibold">
      <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[14px] leading-5 text-foreground group-data-hovered:bg-secondary group-data-focus-visible:ring-2 group-data-focus-visible:ring-primary">
        {icon ? <Oct name={icon} className="text-muted-foreground" /> : null}
        <span className="whitespace-nowrap">{label}</span>
        {count != null ? <Counter>{count}</Counter> : null}
      </span>
      <TabViewIndicator className="inset-x-1 -bottom-px z-1 h-0.5 rounded-full bg-[var(--gh-tab)]" />
    </TabViewTab>
  );
}

/** A tab panel that flows with the page (TabViewPanel is absolutely positioned by default). */
export function FlowPanel({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <TabViewPanel id={id} className={cn('relative inset-auto overflow-visible data-exiting:hidden', className)}>
      {children}
    </TabViewPanel>
  );
}

/** GitHub's bordered "Box": rounded, 1px border, optional header row. */
export function Box({ header, children, className }: { header?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-background', className)}>
      {header ? <div className="flex min-h-[46px] items-center gap-2 border-b border-border bg-muted px-4 py-2 text-[14px]">{header}</div> : null}
      {children}
    </div>
  );
}

/** Class string for GitHub's default (gray) button; add `primary` for the green one. */
export const ghButton = (primary?: boolean) =>
  cn(
    'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-[14px] font-medium outline-none whitespace-nowrap',
    'data-focus-visible:ring-2 data-focus-visible:ring-primary data-focus-visible:ring-offset-1',
    primary
      ? 'border-[rgba(31,35,40,.15)] bg-[#1f883d] text-white data-hovered:bg-[#1c8139]'
      : 'border-border bg-[var(--gh-btn)] text-foreground data-hovered:bg-[var(--gh-btn-hover)]',
  );

/** MarkdownView overrides for GitHub's markdown look. Docstream's sheet is unlayered, so these need `!`. */
export const githubMarkdown = cn(
  'text-foreground [&_[data-docstream-blocks]>:first-child]:mt-0! [&_[data-docstream-blocks]>:last-child]:mb-0!',
  '[&_h1]:mt-0! [&_h1]:mb-4! [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2! [&_h1]:text-[32px]! [&_h1]:font-semibold!',
  '[&_h2]:mt-6! [&_h2]:mb-4! [&_h2]:pb-2! [&_h2]:text-[24px]! [&_h2]:font-semibold!',
  '[&_li]:my-1! [&_pre]:rounded-md!',
);

/* ── Code view ── GitHub's blob view: 12px mono, 20px lines, a line-number gutter (SyntaxHighlighting, ghost). */
export function CodeView({ path, code }: { path: string; code: string }) {
  return (
    <SyntaxHighlighting variant="ghost" code={code} language={languageFromPath(path)} lineNumbers aria-label={path}
      className="[--bl-syntax-font-size:12px] [--bl-syntax-line-height:20px] [--bl-syntax-padding-y:8px]" />
  );
}

/* ── Unified diff ── parses `@@` hunks into rows with old/new line numbers. */
type DiffRow = { t: 'hunk' | 'ctx' | 'add' | 'del'; text: string; o?: number; n?: number };
export function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let o = 0;
  let n = 0;
  for (const line of patch.split('\n')) {
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
    if (h) {
      o = +h[1];
      n = +h[2];
      rows.push({ t: 'hunk', text: line });
    } else if (line[0] === '+') rows.push({ t: 'add', text: line.slice(1), n: n++ });
    else if (line[0] === '-') rows.push({ t: 'del', text: line.slice(1), o: o++ });
    else rows.push({ t: 'ctx', text: line.slice(1), o: o++, n: n++ });
  }
  return rows;
}

/** Five little squares: GitHub's diffstat. */
export function DiffStat({ add, del }: { add: number; del: number }) {
  const total = add + del || 1;
  const g = Math.round((add / total) * 5);
  const r = Math.min(5 - g, Math.round((del / total) * 5));
  return (
    <span className="flex items-center gap-2 font-mono text-[12px] font-semibold">
      <span className="text-[var(--gh-open)]">+{add}</span>
      <span className="text-[var(--gh-closed)]">−{del}</span>
      <span className="flex gap-px">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={cn('size-2 rounded-[1px]', i < g ? 'bg-[var(--gh-open)]' : i < g + r ? 'bg-[var(--gh-closed)]' : 'bg-secondary-strong')} />
        ))}
      </span>
    </span>
  );
}

const ROW_BG = { add: 'bg-[var(--gh-add)]', del: 'bg-[var(--gh-del)]', hunk: 'bg-[var(--gh-hunk)]', ctx: '' };
const NUM_BG = { add: 'bg-[var(--gh-add-num)]', del: 'bg-[var(--gh-del-num)]', hunk: 'bg-[var(--gh-hunk)]', ctx: '' };
export function DiffView({ path, patch, add, del }: { path: string; patch: string; add: number; del: number }) {
  const [open, setOpen] = useState(true);
  const rows = useMemo(() => parsePatch(patch), [patch]);
  /* The diff's code lines are lexed as one source (hunk headers left out), so strings and comments that span
     lines keep their context; each row then shows its own line's tokens inside the +/- backgrounds. */
  const source = useMemo(() => rows.filter((r) => r.t !== 'hunk').map((r) => r.text).join('\n'), [rows]);
  const { lines, highlighter } = useSyntaxTokens(source, { language: languageFromPath(path) });
  let k = 0;
  return (
    <div id={'diff-' + path} className="overflow-hidden rounded-md border border-border">
      <div className="sticky top-0 z-2 flex min-h-11 items-center gap-2 border-b border-border bg-muted px-2 py-1.5">
        <button type="button" onClick={() => setOpen(!open)} aria-label={open ? 'Collapse file' : 'Expand file'}
          className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground hover:bg-secondary">
          <Oct name={open ? 'chevDown' : 'chevRight'} />
        </button>
        <DiffStat add={add} del={del} />
        <span className="min-w-0 truncate font-mono text-[12px] font-semibold text-foreground">{path}</span>
        <Oct name="copy" size={14} className="shrink-0 text-muted-foreground" />
      </div>
      {open ? (
        <div className="overflow-x-auto font-mono text-[12px] leading-5">
          <table className="w-full border-collapse" data-highlighter={highlighter} data-language={languageFromPath(path)}>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={ROW_BG[r.t]}>
                  {r.t === 'hunk' ? (
                    <td colSpan={3} className="px-3 py-1 whitespace-pre text-[var(--gh-hunk-fg)]">{r.text}</td>
                  ) : (
                    <>
                      <td className={cn('w-[1%] min-w-[44px] px-2 text-right align-top text-tertiary-foreground select-none', NUM_BG[r.t])}>{r.o ?? ''}</td>
                      <td className={cn('w-[1%] min-w-[44px] px-2 text-right align-top text-tertiary-foreground select-none', NUM_BG[r.t])}>{r.n ?? ''}</td>
                      <td className="pr-6 pl-2 whitespace-pre text-foreground">
                        <span className="inline-block w-4 text-muted-foreground select-none">{r.t === 'add' ? '+' : r.t === 'del' ? '−' : ' '}</span>
                        <SyntaxTokens tokens={lines[k++] ?? [{ type: 'plain', text: r.text }]} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/* ── File tree ── nested folders, the selected file highlighted with a tint bar. */
export function FileTree({ nodes, selected, onSelect, depth = 0, defaultOpen }: {
  nodes: FileNode[]; selected?: string; onSelect: (node: FileNode) => void; depth?: number; defaultOpen?: boolean;
}) {
  return (
    <ul role={depth ? 'group' : 'tree'} className="m-0 list-none p-0">
      {nodes.map((n) => <TreeItem key={n.path} node={n} selected={selected} onSelect={onSelect} depth={depth} defaultOpen={defaultOpen} />)}
    </ul>
  );
}

function TreeItem({ node, selected, onSelect, depth, defaultOpen }: {
  node: FileNode; selected?: string; onSelect: (node: FileNode) => void; depth: number; defaultOpen?: boolean;
}) {
  // Folders on the way to the selection open themselves until the user toggles them.
  const [toggled, setOpen] = useState<boolean | null>(null);
  const open = toggled ?? (defaultOpen || (!!selected && (selected === node.path || selected.startsWith(node.path + '/'))));
  const active = selected === node.path;
  return (
    <li role="treeitem" aria-expanded={node.type === 'dir' ? open : undefined} aria-selected={active}>
      <button type="button"
        onClick={() => (node.type === 'dir' ? setOpen(!open) : onSelect(node))}
        className={cn(
          'relative flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent pr-2 text-left text-[14px] text-foreground hover:bg-secondary',
          active && 'bg-secondary before:absolute before:inset-y-1.5 before:left-0 before:w-1 before:rounded-full before:bg-primary',
        )}
        style={{ paddingLeft: 8 + depth * 16 }}>
        {node.type === 'dir' ? (
          <>
            <Oct name={open ? 'chevDown' : 'chevRight'} size={12} className="text-muted-foreground" />
            <Oct name="folder" className="text-[var(--gh-folder)]" />
          </>
        ) : (
          <Oct name="file" className="ml-[18px] text-muted-foreground" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === 'dir' && open && node.children ? (
        <FileTree nodes={node.children} selected={selected} onSelect={onSelect} depth={depth + 1} defaultOpen={defaultOpen} />
      ) : null}
    </li>
  );
}

/* ── Shared screen types ── */

/** Width class the screens adapt to (measured from the block's own box). */
export interface Layout {
  phone: boolean;
  wide: boolean;
  dark: boolean;
}

/** Navigation the screens call back into (page.tsx owns the state). */
export type Nav = {
  openPath: (p: string) => void;
  openPr: (n: number | null) => void;
  clone: () => void;
  labels: () => void;
};

export const PR_STATE: Record<PullRequest['state'], StateKind> = { open: 'prOpen', draft: 'draft', merged: 'merged', closed: 'prClosed' };

/** A branch name chip. */
export function Branch({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[12px] text-primary">{children}</span>;
}
