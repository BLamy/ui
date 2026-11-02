/* Small GitHub-flavoured pieces the page composes: the palette, octicon-style glyphs, label chips, state icons,
   underline tabs, a line-numbered code view, a unified diff view and a file tree. Code is highlighted by the
   library's SyntaxHighlighting (gpu-lexer on WebGPU), recolored with Primer's syntax palette below. */
import { useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { SyntaxHighlighting } from '@/components/ui/syntax-highlighting';
import { TabViewIndicator, TabViewPanel, TabViewTab } from '@/components/ui/tab-view';
import { Tree, type TreeNode } from '@/components/ui/tree';
import { Icon, type IconName } from '@/lib/icon';
import { languageFromPath } from '@/lib/syntax';
import { cn } from '@/lib/utils';
import type { FileNode, Label, PullRequest, User } from './data';

/* ── Palette ──
   GitHub's Primer colors. The block is an app with its own palette: `GITHUB_THEME` overrides the theme's shadcn
   variables on the block's root (BLProvider / WorkbenchTheme `style`), so every utility and library part inside picks
   them up. The --gh-* extras are GitHub's state / diff / button colors; --bl-syntax-* recolor SyntaxHighlighting
   with Primer's prettylights palette. */
const PRIMER = {
  light: {
    bg: '#ffffff', bg2: '#f6f8fa', inset: '#f6f8fa', label: '#1f2328', label2: '#59636e', label3: '#818b98',
    sep: '#d1d9e0', fill: 'rgba(129,139,152,.12)', fill2: 'rgba(129,139,152,.22)', tint: '#0969da', green: '#1a7f37', red: '#d1242f',
    done: '#8250df', attention: '#9a6700', btn: '#f6f8fa', btnHover: '#eff2f5', folder: '#54aeff',
    add: '#dafbe1', addNum: '#aceebb', del: '#ffebe9', delNum: '#ffcecb', hunk: '#ddf4ff',
    kw: '#cf222e', str: '#0a3069', num: '#0550ae', com: '#59636e', fn: '#8250df', type: '#953800', hl: '#fff8c5', hlBar: '#d4a72c',
  },
  dark: {
    bg: '#0d1117', bg2: '#151b23', inset: '#010409', label: '#f0f6fc', label2: '#9198a1', label3: '#656c76',
    sep: '#3d444d', fill: 'rgba(101,108,118,.2)', fill2: 'rgba(101,108,118,.4)', tint: '#4493f8', green: '#3fb950', red: '#f85149',
    done: '#ab7df8', attention: '#d29922', btn: '#212830', btnHover: '#262c36', folder: '#7d8590',
    add: 'rgba(46,160,67,.15)', addNum: 'rgba(63,185,80,.3)', del: 'rgba(248,81,73,.1)', delNum: 'rgba(248,81,73,.3)', hunk: 'rgba(56,139,253,.1)',
    kw: '#ff7b72', str: '#a5d6ff', num: '#79c0ff', com: '#9198a1', fn: '#d2a8ff', type: '#ffa657', hl: 'rgba(187,128,9,.15)', hlBar: '#9e6a03',
  },
} as const;

/** Colors GitHub uses in both appearances: the green merge / primary button, the gray draft pill, the tab underline,
    dark ink on light label chips. */
const PRIMER_FIXED = { merge: '#1f883d', mergeHover: '#1c8139', mergeBorder: 'rgba(31,35,40,.15)', draft: '#59636e', tab: '#fd8c73', ink: '#1f2328' } as const;

function primerVars(dark: boolean): CSSProperties {
  const c = PRIMER[dark ? 'dark' : 'light'];
  return {
    '--background': c.bg, '--foreground': c.label, '--card': c.bg, '--card-foreground': c.label,
    '--popover': c.bg2, '--popover-foreground': c.label, '--primary': c.tint, '--ring': c.tint,
    '--secondary': c.fill, '--secondary-foreground': c.label, '--input': c.fill, '--muted': c.bg2, '--muted-foreground': c.label2,
    '--accent': c.fill, '--accent-foreground': c.label, '--destructive': c.red, '--border': c.sep,
    '--sidebar': c.inset, '--sidebar-foreground': c.label, '--sidebar-accent': c.fill, '--sidebar-accent-foreground': c.label,
    '--sidebar-border': c.sep, '--sidebar-primary': c.tint, '--sidebar-ring': c.tint,
    '--success': c.green, '--tertiary-foreground': c.label3, '--secondary-strong': c.fill2,
    '--bar': c.bg, '--sticky': c.bg, '--link': c.tint, '--code': c.bg2, '--code-foreground': c.label,
    '--bl-syntax-keyword': c.kw, '--bl-syntax-operator': c.label, '--bl-syntax-string': c.str, '--bl-syntax-number': c.num,
    '--bl-syntax-constant': c.num, '--bl-syntax-comment': c.com, '--bl-syntax-comment-style': 'normal', '--bl-syntax-function': c.fn,
    '--bl-syntax-type': c.type, '--bl-syntax-fg': c.label, '--bl-syntax-surface': c.bg, '--bl-syntax-line-number': c.label3,
    '--bl-syntax-highlight': c.hl, '--bl-syntax-highlight-bar': c.hlBar,
    '--gh-inset': c.inset, '--gh-open': c.green, '--gh-done': c.done, '--gh-closed': c.red, '--gh-attention': c.attention,
    '--gh-btn': c.btn, '--gh-btn-hover': c.btnHover, '--gh-add': c.add, '--gh-add-num': c.addNum, '--gh-del': c.del,
    '--gh-del-num': c.delNum, '--gh-hl': c.hl, '--gh-hunk': c.hunk, '--gh-hunk-fg': c.label2, '--gh-folder': c.folder,
    '--gh-tab': PRIMER_FIXED.tab, '--gh-merge': PRIMER_FIXED.merge, '--gh-merge-hover': PRIMER_FIXED.mergeHover,
    '--gh-merge-border': PRIMER_FIXED.mergeBorder, '--gh-draft': PRIMER_FIXED.draft, '--gh-ink': PRIMER_FIXED.ink,
  } as CSSProperties;
}

/** The block root's theme override (shadcn variables + GitHub extras), per appearance. */
export const GITHUB_THEME = { light: primerVars(false), dark: primerVars(true) } as const;
/** GitHub's accent blue, per appearance (the `tint` of the block's BLProvider / WorkbenchTheme). */
export const GITHUB_TINT = { light: PRIMER.light.tint, dark: PRIMER.dark.tint } as const;

/* ── Octicon-style glyphs (16px grid, drawn for this block) ──
   GitHub's domain marks (repo, branch, PR, issue, CI states…) are drawn here; generic UI glyphs come from the
   library's Icon (regular weight at 1.25× lands on the octicons' 1.5px stroke). */
const GENERIC = {
  check: 'check', x: 'xmark', chevDown: 'chevron-down', chevRight: 'chevron-right', chevLeft: 'chevron-left',
  search: 'magnifyingglass', plus: 'plus', bell: 'bell', menu: 'menu', link: 'link', gear: 'gear', copy: 'copy',
  kebab: 'ellipsis', sidebar: 'sidebar', star: 'star', lock: 'lock', retry: 'arrow-clockwise', external: 'arrow-up-right',
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
  pencil: <path d="m10.8 2.6 2.6 2.6-8 8-3.3.7.7-3.3zM9.4 4l2.6 2.6" />,
  trash: <path d="M2.8 4.2h10.4M6.2 4.2V2.6h3.6v1.6M4.2 4.2l.7 9.2h6.2l.7-9.2M6.8 6.8v4.4M9.2 6.8v4.4" />,
  smile: <><circle cx="8" cy="8" r="6.25" /><path d="M5.4 9.6c.6 1 1.5 1.5 2.6 1.5s2-.5 2.6-1.5" /><circle cx="5.9" cy="6.3" r=".8" fill="currentColor" stroke="none" /><circle cx="10.1" cy="6.3" r=".8" fill="currentColor" stroke="none" /></>,
  quote: <path d="M2 3.5h12M6 8h8M6 12.5h8M2.5 7.5v5.5" />,
  pin: <path d="M9.8 1.8 14.2 6.2l-1 1-.9-.2-2.9 2.9.2 2.6-1.1 1.1-2.7-2.7-3.2 3.2M6.3 6.5l-2.6-.2-1 1 2.6 2.7M6.3 6.5l2.9-2.9-.2-.9z" />,
  bold: <path d="M4.5 2.8h4.1a2.6 2.6 0 0 1 0 5.2H4.5zM4.5 8h4.9a2.6 2.6 0 0 1 0 5.2H4.5z" />,
  italic: <path d="M6.6 2.8h5M4.4 13.2h5M9.2 2.8 6.8 13.2" />,
  list: <path d="M6 3.6h8M6 8h8M6 12.4h8M2.2 3.6h.6M2.2 8h.6M2.2 12.4h.6" />,
  listOrdered: <path d="M6.4 3.6h7.6M6.4 8h7.6M6.4 12.4h7.6M2 2.8l.9-.6v3.6M1.9 7.4c.3-.7 1.9-.6 1.9.4 0 .9-1.9 1.6-1.9 2.2h1.9M2 11.6h1.8l-.9 1.1c.8 0 1 .4 1 .8 0 .9-1.5 1-1.9.5" />,
  tasklist: <path d="M2 3.4l1.3 1.3L5.5 2.4M8 3.6h6M2 11.2l1.3 1.3 2.2-2.3M8 8h6M8 12.4h6M2.5 7.3h2.5" />,
  heading: <path d="M3.5 2.8v10.4M12.5 2.8v10.4M3.5 8h9" />,
  filter: <path d="M1.8 3.5h12.4M4.2 8h7.6M6.6 12.5h2.8" />,
  download: <path d="M8 2.2v8.2M4.6 7.2 8 10.6l3.4-3.4M2.4 13.8h11.2" />,
  upload: <path d="M8 10.6V2.4M4.6 5.8 8 2.4l3.4 3.4M2.4 13.8h11.2" />,
  signout: <path d="M6.2 2.5H3.2a.9.9 0 0 0-.9.9v9.2c0 .5.4.9.9.9h3M10.4 4.8 13.6 8l-3.2 3.2M13.4 8H6" />,
  globe: <><circle cx="8" cy="8" r="6.25" /><path d="M1.8 8h12.4M8 1.8c2 2 2.7 4 2.7 6.2S10 12.2 8 14.200M8 1.800C6 3.8 5.3 5.8 5.3 8S6 12.2 8 14.2" /></>,
  archive: <path d="M1.8 3h12.400v3H1.800zM2.8 6v7h10.400V6M6.4 8.800h3.2" />,
  calendar: <path d="M2.2 3.400h11.600v10.400H2.200zM2.2 6.600h11.600M5.2 1.800v3M10.8 1.800v3" />,
  milestone: <path d="M8 1.800v2.600M8 11.200v3M2.8 4.400h9l2.2 3.4-2.2 3.400h-9z" />,
  rocket: <path d="M9.4 2.200c2.2-.7 3.7-.7 4.4 0 .7.7.7 2.2 0 4.400L9.3 11.1 4.9 6.700zM4.9 6.700H2.200L4.4 4.500h2.800M9.3 11.100v2.700l2.2-2.200V8.800M4.4 11.600l-2.2 2.2" />,
  graph: <path d="M2 2v12h12M5 11V8M8 11V5M11 11V7" />,
  sliders: <path d="M2.2 4.400h6.600M12 4.400h1.800M2.2 11.600h1.800M7.2 11.600h6.600M10.4 2.800v3.200M5.6 10v3.2" />,
  columns: <path d="M2 2.800h12v10.400H2zM8 2.800v10.4" />,
  rows: <path d="M2 2.800h12v10.400H2zM2 8h12" />,
  fileAdd: <><path d="M3.5 1.800h5.800l3.2 3.200v9.200h-9z" /><path d="M9.2 1.800v3.300h3.300M8 7.500v4M6 9.500h4" /></>,
  key: <><circle cx="5" cy="11" r="3" /><path d="m7.2 8.8 6-6M10.4 5.600l1.8 1.800M12.2 3.800l1.4 1.4" /></>,
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
    : { background: label.color };
  return (
    <span className={cn('inline-flex h-5 items-center rounded-full px-[7px] text-caption leading-none font-medium whitespace-nowrap',
      !dark && (lum > 0.6 ? 'text-(--gh-ink)' : 'text-white'), className)} style={style}>
      {label.name}
    </span>
  );
}

/* ── Issue / PR state glyphs and pills ── */
/* icon, glyph color, pill fill (open states use the merge-button green, draft a fixed gray). */
const STATE = {
  open: { icon: 'issue', text: 'text-(--gh-open)', pill: 'bg-(--gh-merge)', label: 'Open' },
  closed: { icon: 'issueClosed', text: 'text-(--gh-done)', pill: 'bg-(--gh-done)', label: 'Closed' },
  prOpen: { icon: 'pr', text: 'text-(--gh-open)', pill: 'bg-(--gh-merge)', label: 'Open' },
  merged: { icon: 'merged', text: 'text-(--gh-done)', pill: 'bg-(--gh-done)', label: 'Merged' },
  prClosed: { icon: 'prClosed', text: 'text-(--gh-closed)', pill: 'bg-(--gh-closed)', label: 'Closed' },
  draft: { icon: 'prDraft', text: 'text-muted-foreground', pill: 'bg-(--gh-draft)', label: 'Draft' },
} satisfies Record<string, { icon: OctName; text: string; pill: string; label: string }>;
export type StateKind = keyof typeof STATE;

export function StateIcon({ state, className }: { state: StateKind; className?: string }) {
  const s = STATE[state];
  return <Oct name={s.icon} className={cn(s.text, className)} />;
}

export function StatePill({ state, label }: { state: StateKind; label?: string }) {
  const s = STATE[state];
  return (
    <span className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-detail font-medium text-white', s.pill)}>
      <Oct name={s.icon} />
      {label ?? s.label}
    </span>
  );
}

/** A small gray count bubble (tab counts, button counts). */
export function Counter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-secondary-strong px-1.5 text-caption leading-none font-medium text-foreground', className)}>
      {children}
    </span>
  );
}

/** Overlapping avatars (assignees, contributors). */
export function AvatarStack({ users, size = 20 }: { users: User[]; size?: number }) {
  return (
    <span className="flex">
      {users.map((u, i) => (
        <Avatar key={u.login} c={u} src={u.avatar} size={size} className="ring-2 ring-background" style={{ marginLeft: i ? -size / 3 : 0 }} />
      ))}
    </span>
  );
}

/* ── Underline tabs ── a TabViewTab styled as GitHub's UnderlineNav: icon, label, count, coral underline. */
export function UnderlineTab({ id, icon, label, count }: { id: string; icon?: OctName; label: string; count?: ReactNode }) {
  return (
    <TabViewTab id={id} textValue={label} className="group relative flex shrink-0 items-center py-2 outline-none data-selected:font-semibold">
      <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-detail leading-5 text-foreground group-data-hovered:bg-secondary group-data-focus-visible:ring-2 group-data-focus-visible:ring-primary">
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
export function Box({ header, children, className, ...rest }: { header?: ReactNode; children?: ReactNode; className?: string } & Omit<HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-background', className)} {...rest}>
      {header ? <div className="flex min-h-row items-center gap-2 border-b border-border bg-muted px-4 py-2 text-detail">{header}</div> : null}
      {children}
    </div>
  );
}

/** Class string for GitHub's default (gray) button; add `primary` for the green one. */
export const ghButton = (primary?: boolean) =>
  cn(
    'inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-detail font-medium outline-none whitespace-nowrap',
    'data-focus-visible:ring-2 data-focus-visible:ring-primary data-focus-visible:ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    'data-disabled:cursor-not-allowed data-disabled:opacity-55 disabled:cursor-not-allowed disabled:opacity-55',
    // Finger-sized on the phone layout (the block's root says which layout it's in).
    'group-data-[phone=true]/gh:h-11 group-data-[phone=true]/gh:min-w-11',
    primary
      ? 'border-(--gh-merge-border) bg-(--gh-merge) text-white data-hovered:bg-(--gh-merge-hover)'
      : 'border-border bg-(--gh-btn) text-foreground data-hovered:bg-(--gh-btn-hover)',
  );

/** MarkdownView overrides for GitHub's markdown look. Docstream's sheet is unlayered, so these need `!`. */
export const githubMarkdown = cn(
  'text-foreground [&_[data-docstream-blocks]>:first-child]:mt-0! [&_[data-docstream-blocks]>:last-child]:mb-0!',
  '[&_h1]:mt-0! [&_h1]:mb-4! [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2! [&_h1]:text-[32px]! [&_h1]:font-semibold!',
  '[&_h2]:mt-6! [&_h2]:mb-4! [&_h2]:pb-2! [&_h2]:text-[24px]! [&_h2]:font-semibold!',
  '[&_li]:my-1! [&_pre]:rounded-md!',
);

/* ── Code view ── GitHub's blob view: 12px mono, 20px lines, a line-number gutter (SyntaxHighlighting, ghost). */
export function CodeView({ path, code, lineNumbers = true }: { path: string; code: string; lineNumbers?: boolean }) {
  return (
    <SyntaxHighlighting variant="ghost" code={code} language={languageFromPath(path)} lineNumbers={lineNumbers} aria-label={path}
      className="[--bl-syntax-font-size:12px] [--bl-syntax-line-height:20px] [--bl-syntax-padding-y:8px]" />
  );
}

/** Five little squares: GitHub's diffstat. */
export function DiffStat({ add, del }: { add: number; del: number }) {
  const total = add + del || 1;
  const g = Math.round((add / total) * 5);
  const r = Math.min(5 - g, Math.round((del / total) * 5));
  return (
    <span className="flex items-center gap-2 font-mono text-caption font-semibold">
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

/* ── File tree ── the library's Tree (Trees): folders open to the selected file; choosing a file opens it. */
const treeNodes = (nodes: readonly FileNode[]): TreeNode[] =>
  nodes.map((n) => ({ id: n.path, name: n.name, ...(n.type === 'dir' ? { children: treeNodes(n.children ?? []) } : {}) }));

export function FileTree({ nodes, selected, onSelect, defaultOpen }: {
  nodes: FileNode[]; selected?: string; onSelect: (node: FileNode) => void; defaultOpen?: boolean;
}) {
  const items = useMemo(() => treeNodes(nodes), [nodes]);
  const byPath = useMemo(() => {
    const m = new Map<string, FileNode>();
    const walk = (list: readonly FileNode[]) => list.forEach((n) => { m.set(n.path, n); if (n.children) walk(n.children); });
    walk(nodes);
    return m;
  }, [nodes]);
  // The folders on the way to the selection.
  const ancestors = selected ? selected.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/')) : [];
  return (
    <Tree aria-label="Files" items={items} defaultExpanded={defaultOpen ? 'all' : ancestors} expandedIds={ancestors}
      selectedIds={selected ? [selected] : []}
      onSelectionChange={([path]) => { const n = path ? byPath.get(path) : undefined; if (n?.type === 'file') onSelect(n); }}
      className="h-[min(70vh,640px)]" />
  );
}

/* ── Shared screen types ── */

/** Width class the screens adapt to (measured from the block's own box). */
export interface Layout {
  phone: boolean;
  wide: boolean;
  dark: boolean;
}

export const PR_STATE: Record<PullRequest['state'], StateKind> = { open: 'prOpen', draft: 'draft', merged: 'merged', closed: 'prClosed' };

/** A branch name chip. */
export function Branch({ children }: { children: ReactNode }) {
  return <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-caption text-primary">{children}</span>;
}
