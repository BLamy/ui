/* GitHub-flavoured writing and reading. <Md> draws a comment or README with GitHub's autolinks (#12, owner/repo#3, @user,
   commit shas), repository-relative links and images resolved, and links that stay in the block when they point at this
   repository. <MarkdownField> is GitHub's comment box: Write / Preview, the formatting toolbar, ⌘↵ to submit. Plain Enter
   always means a new line, so a half-written comment can't be posted by accident. GitHub has no API for uploading
   attachments, so there's no paperclip here: paste a link instead. */
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { TextArea, TextField } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { MarkdownView } from '@/components/ui/markdown-view';
import { cn } from '@/lib/utils';
import { Oct, githubMarkdown, type OctName } from './parts';
import { useLoad, useRepo } from './repo-context';

const API_SAFE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Outside code spans and fences, runs `fn` over the text. */
function outsideCode(md: string, fn: (text: string) => string): string {
  return md.split(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/).map((part, i) => (i % 2 ? part : fn(part))).join('');
}

/** Turns GitHub's autolinks in Markdown into real links. */
export function autolink(md: string, full: string): string {
  const base = `https://github.com/${full}`;
  return outsideCode(md, (text) => text
    // Don't touch existing links' targets: split them out first.
    .split(/(\[[^\]]*\]\([^)]*\)|<[^>]+>|https?:\/\/\S+)/)
    .map((part, i) => {
      if (i % 2) return part;
      return part
        .replace(/(^|[\s(])([\w.-]+\/[\w.-]+)#(\d+)\b/g, (_, a: string, repo: string, n: string) => `${a}[${repo}#${n}](https://github.com/${repo}/issues/${n})`)
        .replace(/(^|[\s(,:;])#(\d+)\b/g, (_, a: string, n: string) => `${a}[#${n}](${base}/issues/${n})`)
        .replace(/(^|[\s(,:;])GH-(\d+)\b/g, (_, a: string, n: string) => `${a}[GH-${n}](${base}/issues/${n})`)
        .replace(/(^|[\s(,:;])@([A-Za-z0-9][A-Za-z0-9-]*(?:\[bot\])?)/g, (_, a: string, u: string) => `${a}[@${u}](https://github.com/${u})`)
        .replace(/(^|[\s(,:;])([0-9a-f]{7,40})\b/g, (m, a: string, sha: string) => (/[a-f]/.test(sha) && /\d/.test(sha) ? `${a}[${sha.slice(0, 7)}](${base}/commit/${sha})` : m));
    })
    .join(''));
}

/** Points a README's relative links at the repository and its relative images at the raw file. */
export function resolveRelative(md: string, full: string, ref: string, dir: string): string {
  const join = (href: string) => {
    const parts = [...dir.split('/').filter(Boolean)];
    for (const p of href.split('/')) {
      if (p === '..') parts.pop();
      else if (p !== '.' && p) parts.push(p);
    }
    return parts.join('/');
  };
  const fix = (href: string, image: boolean) => {
    if (API_SAFE.test(href)) return href;
    const [path, hash = ''] = href.split('#');
    const absolute = path.startsWith('/') ? path.slice(1) : join(path);
    return image
      ? `https://raw.githubusercontent.com/${full}/${ref}/${absolute}`
      : `https://github.com/${full}/blob/${ref}/${absolute}${hash ? '#' + hash : ''}`;
  };
  return outsideCode(md, (text) => text
    .replace(/(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_, bang: string, label: string, href: string, title: string) => `${bang}[${label}](${fix(href, !!bang)}${title})`)
    .replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (_, a: string, href: string, b: string) => `${a}${fix(href, true)}${b}`));
}

/** A link to `javascript:` and friends keeps its words and loses its target: GitHub strips them too. */
export const withoutScriptLinks = (md: string) => md.replace(/\[([^\]]*)\]\(\s*(?:javascript|vbscript|data):[^)]*\)/gi, '$1');

/** Every task in Markdown as a renderer sees it: outside fences and indented code, including in quotes and nested lists. */
export function taskPositions(md: string): { start: number; checked: boolean }[] {
  const out: { start: number; checked: boolean }[] = [];
  let at = 0;
  let fence: string | null = null;
  let inList = false;
  for (const line of md.split('\n')) {
    const bare = line.replace(/^(?:\s*>)+\s?/, '');
    const f = /^\s{0,3}(```+|~~~+)/.exec(bare);
    if (fence) {
      if (f && f[1].startsWith(fence)) fence = null;
    } else if (f) {
      fence = f[1];
      // A fence at the left margin ends any list above it.
      if (!/^\s/.test(bare)) inList = false;
    } else {
      const m = /^(\s*(?:>\s*)*\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/.exec(line);
      const indented = /^(?: {4}|\t)/.test(line);
      // Four spaces is code unless it continues a list.
      if (m && (!indented || inList)) out.push({ start: at + m[1].length, checked: m[2] !== ' ' });
      if (/^\s*(?:>\s*)*\s*(?:[-*+]|\d+[.)])\s/.test(line)) inList = !indented || inList;
      else if (line.trim() && !indented) inList = false;
    }
    at += line.length + 1;
  }
  return out;
}

/** Flips the `index`th task in Markdown; null when there's no such task. */
export function toggleTask(md: string, index: number): string | null {
  const task = taskPositions(md)[index];
  if (!task) return null;
  return md.slice(0, task.start) + (task.checked ? ' ' : 'x') + md.slice(task.start + 1);
}

/** Whether the caret is inside code, where @ and # are just characters. */
export function inCode(textBefore: string): boolean {
  const fences = textBefore.split('\n').filter((l) => /^\s{0,3}(```|~~~)/.test(l)).length;
  if (fences % 2) return true;
  const line = textBefore.slice(textBefore.lastIndexOf('\n') + 1);
  if (/^(?: {4}|\t)/.test(line)) return true;
  return (line.match(/`/g)?.length ?? 0) % 2 === 1;
}

/** Markdown as GitHub shows it. `dir` set: a file in the repository, whose relative links resolve from that folder. */
export function Md({ markdown, className, dir, gitRef, onTaskToggle }: { markdown: string; className?: string; dir?: string; gitRef?: string; onTaskToggle?: (next: string) => void }) {
  const { source, nav, repo } = useRepo();
  const resolved = dir !== undefined ? resolveRelative(markdown, source.full, gitRef || repo?.branch || 'HEAD', dir) : markdown;
  // `{%` opens a block in the renderer's dialect; on GitHub it's just text.
  const text = autolink(withoutScriptLinks(resolved), source.full).replace(/\{%/g, '{\\%');
  const root = useRef<HTMLDivElement>(null);
  // Task boxes are real checkboxes in the rendered Markdown: they work when you can edit it, and say they don't otherwise.
  useEffect(() => {
    const boxes = [...(root.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [])];
    // Toggling writes to the source: if the boxes on screen aren't exactly the tasks we can find there, don't guess which is which.
    const tasks = taskPositions(markdown);
    const mapped = boxes.length === tasks.length && boxes.every((b, i) => b.checked === tasks[i].checked);
    for (const box of boxes) box.disabled = !onTaskToggle || !mapped;
    // Keyboard users scroll wide tables and code with the arrow keys.
    for (const el of root.current?.querySelectorAll<HTMLElement>('pre,table') ?? []) el.tabIndex = 0;
  });
  const follow = (e: MouseEvent) => {
    const box = (e.target as Element).closest('input[type="checkbox"]');
    if (box) {
      e.preventDefault();
      e.stopPropagation();
      if (!onTaskToggle || (box as HTMLInputElement).disabled) return;
      const index = [...(root.current?.querySelectorAll('input[type="checkbox"]') ?? [])].indexOf(box);
      const next = toggleTask(markdown, index);
      if (next != null) onTaskToggle(next);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = (e.target as Element).closest('a');
    const href = a?.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    nav.open(href);
  };
  return (
    // A click on a link inside rendered Markdown; the links themselves stay keyboard-reachable anchors.
    <div ref={root} onClickCapture={follow}>
      {/* Wide tables and long code scroll inside the comment rather than being cut off by it. */}
      <MarkdownView markdown={text} className={cn(githubMarkdown, 'bg-background text-detail leading-[1.5] break-words [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto', className)} />
    </div>
  );
}

const TOOLS: { icon: OctName; label: string; wrap?: [string, string]; line?: string; key?: string }[] = [
  { icon: 'heading', label: 'Heading', line: '### ' },
  { icon: 'bold', label: 'Bold', wrap: ['**', '**'], key: 'b' },
  { icon: 'italic', label: 'Italic', wrap: ['_', '_'], key: 'i' },
  { icon: 'quote', label: 'Quote', line: '> ' },
  { icon: 'code', label: 'Code', wrap: ['`', '`'], key: 'e' },
  { icon: 'link', label: 'Link', wrap: ['[', '](url)'], key: 'k' },
  { icon: 'list', label: 'Bulleted list', line: '- ' },
  { icon: 'listOrdered', label: 'Numbered list', line: '1. ' },
  { icon: 'tasklist', label: 'Task list', line: '- [ ] ' },
];

export interface MarkdownFieldProps {
  value: string;
  onChange: (v: string) => void;
  /** ⌘↵ / Ctrl↵. */
  onSubmit?: () => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** How tall the box starts, in rows. */
  rows?: number;
  disabled?: boolean;
  footer?: ReactNode;
  className?: string;
}

export function MarkdownField({ value, onChange, onSubmit, label, placeholder = 'Add your comment here…', autoFocus, rows = 6, disabled, footer, className }: MarkdownFieldProps) {
  const { source } = useRepo();
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const area = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  /* @people and #issues while typing: the word at the caret, and what it could be. */
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  /** -1 until you arrow into the list: Enter is a new line until you've chosen something. */
  const [at, setAt] = useState(-1);
  const before = value.slice(0, caret);
  const word = inCode(before) ? null : /(?:^|[\s(])([@#])([\w-]*)$/.exec(before);
  const asking = !dismissed && tab === 'write' && word ? word[1] : null;
  const typed = word?.[2] ?? '';
  const people = useLoad(`${source.id}:assignable:${asking === '@'}`, () => (asking === '@' ? source.assignable() : [])).data ?? [];
  const items = useLoad(`${source.id}:ref-suggestions:${asking === '#' ? typed : ''}:${asking === '#'}`, () => (asking === '#' ? source.searchIssues(`${typed} sort:updated-desc`, 1) : null)).data?.items ?? [];
  const pulls = useLoad(`${source.id}:ref-suggestions-pulls:${asking === '#' ? typed : ''}:${asking === '#'}`, () => (asking === '#' ? source.searchPulls(`${typed} sort:updated-desc`, 1) : null)).data?.items ?? [];
  const suggestions: { insert: string; text: string; detail?: string }[] = asking === '@'
    ? people.filter((u) => `${u.login} ${u.f} ${u.l}`.toLowerCase().includes(typed.toLowerCase())).slice(0, 6).map((u) => ({ insert: '@' + u.login, text: u.login, detail: `${u.f} ${u.l}`.trim() }))
    : asking === '#' ? [...items, ...pulls].filter((i) => !typed || String(i.number).startsWith(typed) || i.title.toLowerCase().includes(typed.toLowerCase())).sort((a, b) => b.number - a.number).slice(0, 6).map((i) => ({ insert: '#' + i.number, text: `#${i.number}`, detail: i.title })) : [];
  const accept = (s: { insert: string }) => {
    const start = caret - typed.length - 1;
    const next = value.slice(0, start) + s.insert + ' ' + value.slice(caret);
    onChange(next);
    const to = start + s.insert.length + 1;
    setCaret(to);
    setAt(-1);
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(to, to); });
  };
  const apply = (t: (typeof TOOLS)[number]) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const selected = value.slice(a, b);
    let next: string;
    let cursor: [number, number];
    if (t.wrap) {
      next = value.slice(0, a) + t.wrap[0] + selected + t.wrap[1] + value.slice(b);
      cursor = [a + t.wrap[0].length, b + t.wrap[0].length];
    } else {
      const start = value.lastIndexOf('\n', a - 1) + 1;
      const block = value.slice(start, b);
      const prefixed = block.split('\n').map((l, i) => (t.line === '1. ' ? `${i + 1}. ` : t.line) + l).join('\n');
      next = value.slice(0, start) + prefixed + value.slice(b);
      cursor = [start + prefixed.length, start + prefixed.length];
    }
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursor[0], cursor[1]); });
  };
  const tabButton = (id: 'write' | 'preview', text: string) => (
    <Button aria-pressed={tab === id} onPress={() => setTab(id)}
      className={cn('h-9 cursor-pointer rounded-t-md border border-b-0 px-3 text-detail outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:h-11',
        tab === id ? 'border-border bg-background font-semibold text-foreground' : 'border-transparent bg-transparent text-muted-foreground')}>
      {text}
    </Button>
  );
  return (
    <div data-slot="markdown-field" className={cn('rounded-md border border-border bg-muted', className)}>
      <div className="flex flex-wrap items-end gap-1 border-b border-border px-2 pt-2">
        {tabButton('write', 'Write')}
        {tabButton('preview', 'Preview')}
        {tab === 'write' ? (
          <div role="toolbar" aria-label="Formatting" className="ml-auto flex flex-wrap items-center pb-1">
            {TOOLS.map((t) => (
              <Button key={t.label} aria-label={t.label} onPress={() => apply(t)} isDisabled={disabled}
                className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary group-data-[phone=true]/gh:size-11">
                <Oct name={t.icon} size={14} />
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="bg-background p-2">
        {tab === 'write' ? (
          <>
          <TextField aria-label={label} value={value} onChange={onChange} isDisabled={disabled} className="flex">
            <TextArea ref={area} rows={rows} placeholder={placeholder} autoFocus={autoFocus}
              aria-autocomplete="list" aria-controls={suggestions.length ? listId : undefined} aria-activedescendant={suggestions.length && at >= 0 ? `${listId}-${Math.min(at, suggestions.length - 1)}` : undefined}
              onSelect={(e) => { const c = e.currentTarget.selectionStart; if (c !== caret) { setCaret(c); setDismissed(false); setAt(-1); } }}
              onKeyDown={(e) => {
                const mod = e.metaKey || e.ctrlKey;
                if (suggestions.length && !mod) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setAt((x) => (x + 1) % suggestions.length); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setAt((x) => (x <= 0 ? suggestions.length : x) - 1); return; }
                  if (e.key === 'Tab') { e.preventDefault(); accept(suggestions[Math.max(at, 0)]); return; }
                  if (e.key === 'Enter' && at >= 0) { e.preventDefault(); accept(suggestions[Math.min(at, suggestions.length - 1)]); return; }
                  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissed(true); return; }
                }
                if (mod && e.key === 'Enter') { e.preventDefault(); onSubmit?.(); return; }
                const tool = mod ? TOOLS.find((t) => t.key === e.key) : undefined;
                if (tool) { e.preventDefault(); apply(tool); }
              }}
              className="box-border block w-full min-w-0 resize-y rounded-md border border-border bg-muted px-2 py-1.5 font-sans text-detail leading-5 text-foreground outline-none select-text placeholder:text-muted-foreground data-focused:border-primary data-focused:bg-background data-focused:ring-1 data-focused:ring-primary" />
          </TextField>
          {suggestions.length ? (
            <>
              <span role="status" className="sr-only">{suggestions.length} suggestions. Arrow keys to choose, Enter or Tab to insert.</span>
              <ul id={listId} role="listbox" aria-label={asking === '@' ? 'People to mention' : 'Issues and pull requests to reference'} className="mx-0 mt-1 mb-0 list-none overflow-hidden rounded-md border border-border bg-popover p-0">
                {suggestions.map((s, i) => (
                  <li key={s.insert} id={`${listId}-${i}`} role="option" aria-selected={i === at} onMouseDown={(e) => { e.preventDefault(); accept(s); }}
                    className={cn('flex min-h-8 w-full cursor-pointer items-center gap-2 px-2 py-1 text-left text-caption text-foreground hover:bg-accent group-data-[phone=true]/gh:min-h-11', i === at && 'bg-accent')}>
                    <b className="shrink-0 font-semibold">{s.text}</b><span className="min-w-0 truncate text-muted-foreground">{s.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          </>
        ) : (
          <div className="min-h-24 rounded-md border border-transparent px-2 py-1.5" aria-label={`${label} preview`}>
            {value.trim() ? <Md markdown={value} /> : <p className="m-0 text-detail text-muted-foreground italic">Nothing to preview</p>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-b-md border-t border-border bg-muted px-2 py-1.5 text-caption text-muted-foreground">
        <span className="flex items-center gap-1.5"><Oct name="book" size={14} />Markdown is supported. ⌘↵ to submit.</span>
        {footer}
      </div>
    </div>
  );
}
